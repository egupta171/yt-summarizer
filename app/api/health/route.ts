// app/api/health/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  const missing = ["OPENAI_API_KEY", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]
    .filter((k) => !process.env[k as keyof NodeJS.ProcessEnv]);

  return NextResponse.json({
    ok: missing.length === 0,
    missing
  }, { status: missing.length ? 500 : 200 });
}
