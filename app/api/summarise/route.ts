// app/api/summarise/route.ts
export const runtime = "nodejs";
import { NextResponse, NextRequest } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { serverSupabase } from "@/lib/supabase";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { fetchTranscript } from "@/lib/transcript";
import { cookies } from "next/headers";

// --- helpers ---
const BodySchema = z.object({
  url: z.string().url("Invalid URL"),
  instructions: z.string().max(3000).optional()
});

type Lvl = "info" | "warn" | "error";
function makeLogger(scope: string) {
  const requestId = crypto.randomUUID();
  const log = (level: Lvl, msg: string, data?: Record<string, unknown>) => {
    // JSON logs are easier to filter in Render
    const payload = {
      ts: new Date().toISOString(),
      level,
      scope,
      requestId,
      msg,
      ...(data ?? {})
    };
    // Use console[level] where available
    (console[level] ?? console.log)(JSON.stringify(payload));
  };
  return {
    requestId,
    info: (m: string, d?: Record<string, unknown>) => log("info", m, d),
    warn: (m: string, d?: Record<string, unknown>) => log("warn", m, d),
    error: (m: string, d?: Record<string, unknown>) => log("error", m, d)
  };
}

function errMsg(e: unknown) {
    return e instanceof Error ? e.message : String(e);
  }

function extractYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) {
      return u.pathname.slice(1) || null;
    }
    if (u.searchParams.get("v")) return u.searchParams.get("v");
    // Handle shorts & embed
    const m = u.pathname.match(/\/(shorts|embed)\/([^/?#]+)/);
    if (m?.[2]) return m[2];
  } catch {}
  return null;
}

async function fetchTitle(videoUrl: string): Promise<string | undefined> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`,
      { headers: { "user-agent": "yt-summarizer/1.0" } }
    );
    if (!res.ok) return undefined;
    const data = await res.json();
    return (data?.title as string) || undefined;
  } catch {
    return undefined;
  }
}

type RowStatus = "success" | "failed";

async function finalize({
  supabase,
  id,
  status,
  error
}: {
  supabase: ReturnType<typeof serverSupabase>;
  id?: string;
  status: RowStatus;
  error?: string | null;
}) {
  if (id) {
    await supabase.from("video_summaries").update({ status, error: error ?? null }).eq("id", id);
  }
}


export async function POST(req: NextRequest) {
  
    const supabaseAuth = createRouteHandlerClient({ cookies }); // RLS client (uses anon key + cookies)
    const { data: { session } } = await supabaseAuth.auth.getSession();
    if (!session?.user) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const user = session.user;



  const supabase = serverSupabase();
  const log = makeLogger("summarise");
  log.info("start");

  

  const sendError = (status: number, message: string, code?: string, ctx?: Record<string, unknown>) => {
    log.error(`HTTP ${status} ${code ?? ""} ${message}`, ctx);
    return NextResponse.json({ error: message, code, requestId: log.requestId }, { status });
  };

  // Guard: ensure service role really loaded
  try {
    const payload = JSON.parse(Buffer.from(String(process.env.SUPABASE_SERVICE_ROLE_KEY).split(".")[1], "base64").toString());
    if (payload?.role !== "service_role") {
      return NextResponse.json({ error: "Server misconfigured (wrong Supabase key)" }, { status: 500 });
    }
  } catch {}

  // Parse body
  let url: string, instructions: string | undefined;
  try {
    const body = await req.json();
    ({ url, instructions } = BodySchema.parse(body));
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Invalid request body" }, { status: 400 });
  }

  // Validate/normalize URL
  const videoId = extractYouTubeId(url);
  console.log("Video ID to be extracted is: ", videoId);
  if (!videoId) {
    return sendError(400, "Could not extract YouTube video ID from URL.", "BAD_URL", { url });
  }

  // *** ATOMIC CREDIT CHECK ***
  // call the RPC with the RLS client (works because function is SECURITY DEFINER)
  const { data: creditRes, error: creditErr } = await supabaseAuth.rpc("consume_credit", { p_user_id: user.id });
  if (creditErr) {
    return NextResponse.json({ error: `Credit check failed: ${creditErr.message}` }, { status: 500 });
  }
  if (!creditRes?.[0]?.ok) {
    const remaining = creditRes?.[0]?.remaining ?? 0;
    return NextResponse.json({ error: `You have no credits left. Please buy more credits.` }, { status: 402 });
  }

  // Insert pending row (no summary stored)
  let rowId: string | undefined;
  try {
    const { data, error } = await supabase
      .from("video_summaries")
      .insert({ user_id: user.id, video_url: url, instructions: instructions ?? null, status: "pending" })
      .select()
      .single();
    if (error) {
        return NextResponse.json({ error: `DB insert failed: ${error.message}` }, { status: 500 });
    }
    rowId = data.id;
  } catch (e: any) {
    // If we can't even insert, bail quickly
    return NextResponse.json({ error: `DB insert failed: ${e?.message ?? e}` }, { status: 500 });
  }

  try {
    // Fetch video title (best-effort)
    const videoTitle = await fetchTitle(url);
    console.log("Video Title: ", videoTitle);

    // ⬇️ call your Python service here
    const transcript = await fetchTranscript(videoId);

    // Summarize with OpenAI
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is missing");
    }
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    const prompt = [
      `Summarize the following YouTube transcript for a general audience.`,
      instructions ? `Special instructions: ${instructions}` : "",
      `Return concise, well-structured output. If relevant, include bullet points and key takeaways.`,
      `Transcript:\n${transcript}`
    ]
      .filter(Boolean)
      .join("\n\n");

    const resp = await openai.responses.create({
      model,
      input: prompt,
      temperature: 0.4
    });

    // Prefer the convenience getter if available
    // Fallback to digging into content parts if older SDK
    // @ts-ignore
    const summary: string =
      // @ts-ignore
      resp.output_text ??
      // @ts-ignore
      resp.content?.map((c: any) => c?.text).join("\n") ??
      JSON.stringify(resp);

    //await finalize({ supabase, id: rowId, status: "success", error: null });

    // Save summary (update the same row)
    await supabaseAuth
      .from("video_summaries")
      .update({ status: "success", error: null})
      .eq("id", rowId);
    
    return NextResponse.json({ id: rowId, videoTitle, summary }, { status: 200 });
  } catch (err: any) {
        const msg = typeof err?.message === "string" ? err.message : "Unexpected server error";
        //await finalize({ supabase, id: rowId, status: "failed", error: msg.slice(0, 500) });

        if (rowId) {
            await supabaseAuth
              .from("video_summaries")
              .update({ status: "failed", error: msg.slice(0, 500) })
              .eq("id", rowId);
        }
    
        const status =
        msg.includes("Transcript not available") ? 422 :
        msg.includes("OPENAI_API_KEY") ? 500 :
        500;
        return NextResponse.json({ error: msg }, { status });
  }
}
