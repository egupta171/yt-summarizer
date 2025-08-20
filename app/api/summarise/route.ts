import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { extractYouTubeId, chunkText } from "@/lib/youtube";
import { serverSupabase } from "@/lib/supabase";
import OpenAI from "openai";
import ytdl from "ytdl-core";
import { YoutubeTranscript } from "youtube-transcript";

export const runtime = "nodejs"; // needed for ytdl-core

const bodySchema = z.object({
  url: z.string().url(),
  instructions: z.string().max(4000).optional()
});

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => ({}));
  const parse = bodySchema.safeParse(json);
  if (!parse.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { url, instructions } = parse.data;
  const videoId = extractYouTubeId(url);
  if (!videoId) {
    return NextResponse.json({ error: "Could not parse YouTube URL" }, { status: 400 });
  }

  const supabase = serverSupabase();

  // Pre-insert a 'pending' record
  const { data: insertRow, error: insertErr } = await supabase
    .from("video_summaries")
    .insert({
      video_url: url,
      instructions: instructions || null,
      status: "pending",
      // if you have auth later:
      // if you have auth later:
     
    })
    .select()
    .single();

  if (insertErr) {
    // We still continue, but return info—client doesn't need to know DB detail
    console.error("Supabase insert error", insertErr);
  }

  // Fetch metadata (title) & transcript
  let videoTitle = "";
  try {
    const info = await ytdl.getBasicInfo(videoId);
    videoTitle = info.videoDetails?.title ?? "";
  } catch {
    // ignore if metadata fails
  }

  let transcriptText = "";
  try {
    // prefer English, then any available (auto-captions also work)
    const entries = await YoutubeTranscript.fetchTranscript(videoId, { lang: "en" })
      .catch(() => YoutubeTranscript.fetchTranscript(videoId));
    transcriptText = entries.map((e) => e.text).join(" ").replace(/\s+/g, " ").trim();
  } catch (err) {
    console.error("Transcript fetch failed:", err);
    return await finalizeAndRespond({
      supabase,
      rowId: insertRow?.id,
      status: "failed",
      videoTitle,
      summary: null,
      transcript: null,
      errorMsg: "Transcript not available for this video."
    });
  }

  if (!transcriptText) {
    return await finalizeAndRespond({
      supabase,
      rowId: insertRow?.id,
      status: "failed",
      videoTitle,
      summary: null,
      transcript: null,
      errorMsg: "Empty transcript."
    });
  }

  // Summarize with OpenAI Responses API
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini"; // override if you like

  const system = [
    "You are a world-class summarizer.",
    "Write in crisp, structured bullets.",
    "Include key takeaways and optional timestamps if evident.",
    "Be faithful to the source; avoid hallucinations."
  ].join(" ");

  const userInstruction = instructions?.trim()
    ? `Special instructions:\n${instructions.trim()}`
    : "No special instructions.";

  // For very long transcripts, summarize in chunks then compress.
  const chunks = chunkText(transcriptText, 14000);
  const chunkSummaries: string[] = [];

  try {
    for (let i = 0; i < chunks.length; i++) {
      const part = chunks[i];
      const res = await client.responses.create({
        model,
        input: [
          { role: "system", content: system },
          {
            role: "user",
            content:
              `Video title: ${videoTitle}\n` +
              `${userInstruction}\n\n` +
              `TRANSCRIPT (Part ${i + 1}/${chunks.length}):\n` +
              part
          }
        ]
      });
      chunkSummaries.push(res.output_text ?? "");
    }

    // If multiple chunks, compress into a final single summary
    let finalSummary = chunkSummaries.join("\n\n");
    if (chunks.length > 1) {
      const res2 = await client.responses.create({
        model,
        input: [
          { role: "system", content: system },
          {
            role: "user",
            content:
              `Combine and de-duplicate these partial summaries into one cohesive summary with clear sections (Overview, Key Points, Action Items, Memorable Quotes if any):\n\n${finalSummary}`
          }
        ]
      });
      finalSummary = res2.output_text ?? finalSummary;
    }

    return await finalizeAndRespond({
      supabase,
      rowId: insertRow?.id,
      status: "success",
      videoTitle,
      summary: finalSummary,
      transcript: process.env.STORE_TRANSCRIPTS === "true" ? transcriptText : null,
      errorMsg: null
    });
  } catch (err: any) {
    console.error("OpenAI error", err);
    return await finalizeAndRespond({
      supabase,
      rowId: insertRow?.id,
      status: "failed",
      videoTitle,
      summary: null,
      transcript: null,
      errorMsg: "Summarization failed. Please try again."
    });
  }
}

async function finalizeAndRespond({
  supabase,
  rowId,
  status,
  videoTitle,
  summary,
  transcript,
  errorMsg
}: {
  supabase: ReturnType<typeof serverSupabase>;
  rowId?: string;
  status: "success" | "failed";
  videoTitle?: string;
  summary: string | null;
  transcript: string | null;
  errorMsg: string | null;
}) {
  if (rowId) {
    await supabase
      .from("video_summaries")
      .update({
        video_title: videoTitle ?? null,
        status,
        error: errorMsg
      })
      .eq("id", rowId);
  }

  if (status === "failed") {
    return NextResponse.json({ error: errorMsg ?? "Failed." }, { status: 500 });
  }
  return NextResponse.json({ id: rowId, videoTitle, summary });
}
