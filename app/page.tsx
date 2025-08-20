"use client";

import React, { useState } from "react";

type ApiResponse = { summary?: string; videoTitle?: string; id?: string; error?: string };

export default function Page() {
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResponse | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
    } catch (err: any) {
      setResult({ error: err?.message ?? "Something went wrong" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative z-10 mx-auto max-w-3xl px-4 py-10 sm:py-16">
      <header className="mb-6 sm:mb-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#203042] bg-card/60 px-3 py-1 text-xs text-subtle">
          Built with Next.js · Supabase · OpenAI
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-5xl">
          Summarize <span className="text-accent">YouTube</span> in seconds
        </h1>
        <p className="mt-3 text-subtle">
          Paste a video link, optionally add instructions. Get a clean, skimmable summary.
        </p>
      </header>

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
        © {new Date().getFullYear()} YT Summarizer
      </footer>
    </main>
  );
}
