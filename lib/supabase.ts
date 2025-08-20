import { createClient } from "@supabase/supabase-js";

export function serverSupabase() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!; // server-side only
  return createClient(url, key, {
    auth: { persistSession: false },
    global: { headers: { "X-Client-Info": "yt-summarizer-api" } }
  });
}
