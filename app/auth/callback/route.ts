import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

function getOriginFromForwarded(reqUrl: string) {
  const h = headers();
  const url = new URL(reqUrl);
  const proto = h.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const host  = h.get("x-forwarded-host") ?? h.get("host") ?? url.host;
  return `${proto}://${host}`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (code) {
    const supabase = createRouteHandlerClient({ cookies });
    await supabase.auth.exchangeCodeForSession(code);
  }

  const origin = getOriginFromForwarded(request.url);

  // ─── TEMP DEBUG (remove after verifying) ──────────────────────────────────────
  // console.log("[CB] request.url =", request.url);
  // console.log("[CB] xfp/xfh/host =", headers().get("x-forwarded-proto"), headers().get("x-forwarded-host"), headers().get("host"));
  // console.log("[CB] redirecting to =", origin);
  // ─────────────────────────────────────────────────────────────────────────────

  return NextResponse.redirect(new URL("/", origin));
}
