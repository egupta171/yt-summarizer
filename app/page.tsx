"use client";

import React, { useEffect, useState } from "react";
import { browserSupabase } from "@/lib/supabaseBrowser";

type ApiResponse = { summary?: string; videoTitle?: string; id?: string; error?: string };

export default function Page() {
    const supabase = browserSupabase();

    const [session, setSession] = useState<any>(null);
    const [profile, setProfile] = useState<{ credits: number; email: string } | null>(null);

    const [url, setUrl] = useState("");
    const [notes, setNotes] = useState("");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<ApiResponse | null>(null);

    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
        const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
        return () => sub.subscription.unsubscribe();
      }, []);

    useEffect(() => {
    const loadProfile = async () => {
      if (!session?.user) { setProfile(null); return; }
      const { data } = await supabase
        .from("profiles")
        .select("credits, email")
        .eq("id", session.user.id)
        .single();
      setProfile(data ?? null);
    };
    loadProfile();
    }, [session]);

    const signIn = async () => {
        await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: `${window.location.origin}/auth/callback` }
        });
      };

    const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setResult(null);
    };

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // checks if the user is signed-in
        if (!session?.user) {
            await signIn();
            return;
        }  
        setLoading(true);
        setResult(null);
        try {
        const res = await fetch("/api/summarise", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url, instructions: notes })
        });
        const data = (await res.json()) as ApiResponse;
        setResult(data);

        // refresh credits after a run (success or fail)
        const { data: p } = await supabase.from("profiles").select("credits, email").single();
        if (p) setProfile(p);
        } 
        
        catch (err: any) {
        setResult({ error: err?.message ?? "Something went wrong" });
        } finally {
        setLoading(false);
        }
    };


    if (!session) {
        return (
          <main className="mx-auto max-w-2xl p-6">
            <header className="mb-6 flex items-center justify-between">
              <h1 className="text-2xl font-semibold">YT Summarizer</h1>
              <button onClick={signIn} className="rounded-lg border px-3 py-1.5 hover:bg-white/5">
                Sign in with Google
              </button>
            </header>
            <p className="text-sm text-subtle">On new user registration, you will get 5 credits. Each summary consumes 1 credit. Please sign in to use your credits.</p>
          </main>
        );
      }

  return (
    <main className="relative z-10 mx-auto max-w-3xl px-4 py-10 sm:py-16">
        <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Vedyug AI Tools • Built in 🇮🇳 for the 🌍 </h1>
          <p className="text-xs text-subtle">Namaste 🙏🏻 {profile?.email ?? "user"}, Credits: {profile?.credits ?? "…"}</p>
        </div>
        <button onClick={signOut} className="rounded-lg border px-3 py-1.5 hover:bg-white/5">
          Sign out
        </button>
      </header>
    {/*
      <header className="mb-6 sm:mb-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#203042] bg-card/60 px-3 py-1 text-xs text-subtle">
          
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-5xl">
          Summarize <span className="text-accent">YouTube</span> in seconds
        </h1>
        <p className="mt-3 text-subtle">
          Paste a video link, optionally add instructions. Get a clean, skimmable summary.
        </p>
      </header> */}

      {/* Card */}
      <form
        onSubmit={onSubmit}
        className="rounded-2xl border border-[#1e2b3b] bg-card/80 p-4 shadow-soft backdrop-blur sm:p-6"
      >
        <label className="block text-sm text-subtle">YouTube URL</label>
        <div className="mt-2">
          <input
            type="url"
            required
            placeholder="https://www.youtube.com/watch?v=VIDEO_ID"
            className="w-full rounded-xl border border-[#27384d] bg-[#0f1621] px-4 py-3 text-ink placeholder:text-subtle focus:border-accent/40 focus:outline-none focus:ring-2 focus:ring-accent/30"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>

        <label className="mt-5 block text-sm text-subtle">Special instructions (optional)</label>
        <textarea
          placeholder="e.g. 5 bullets, include timestamps & action items"
          className="mt-2 w-full min-h-[120px] rounded-xl border border-[#27384d] bg-[#0f1621] px-4 py-3 text-ink placeholder:text-subtle focus:border-accent/40 focus:outline-none focus:ring-2 focus:ring-accent/30"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              setUrl(""); setNotes(""); setResult(null);
            }}
            className="rounded-xl border border-[#2a3a4f] px-4 py-2 text-sm text-ink/80 hover:bg-[#101826]"
          >
            Reset
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-[#0a0f14] disabled:opacity-60"
          >
            {loading ? "Summarizing…" : "Summarize"}
          </button>
        </div>
      </form>

      {/* Result */}
      {result && (
        <section className="mt-6 rounded-2xl border border-[#1e2b3b] bg-card/80 p-4 shadow-soft backdrop-blur sm:p-6">
          {result.error ? (
            <p className="text-red-400">{result.error}</p>
          ) : (
            <>
              {result.videoTitle && (
                <h2 className="mb-3 text-xl font-semibold sm:text-2xl">{result.videoTitle}</h2>
              )}
              <div className="prose prose-invert max-w-none leading-7 [&>p]:mb-3">
                <pre className="whitespace-pre-wrap text-[0.98rem]">{result.summary}</pre>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(result.summary ?? "")}
                  className="rounded-xl border border-[#2a3a4f] px-4 py-2 text-sm hover:bg-[#101826]"
                >
                  Copy summary
                </button>
                <a
                  href={url}
                  target="_blank"
                  className="rounded-xl border border-[#2a3a4f] px-4 py-2 text-sm hover:bg-[#101826]"
                >
                  Open video
                </a>
              </div>
            </>
          )}
        </section>
      )}

      <footer className="mt-10 text-center text-xs text-subtle">
        © {new Date().getFullYear()} Vedyug Daily 🇮🇳 
        <span className="mx-2 text-ink/30">•</span>
        <a href="https://instagram.com/vedyug.daily" target="_blank" rel="noopener noreferrer" className="hover:text-accent">Instagram</a>
        <span className="mx-2 text-ink/30">•</span>
        <a href="https://youtube.com/@vedyugdaily" target="_blank" rel="noopener noreferrer" className="hover:text-accent">YouTube</a>
      </footer>
    </main>
  );
}
