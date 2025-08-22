"use client";

import React, { useEffect, useState } from "react";
import { browserSupabase } from "@/lib/supabaseBrowser";
import type { Session } from "@supabase/supabase-js";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  LogIn,
  LogOut,
  ShieldCheck,
  Sparkles,
  Zap,
  Video,
  ListChecks,
  Wand2,
} from "lucide-react";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// --- Types ---
type ApiResponse = { summary?: string; videoTitle?: string; id?: string; error?: string };
function normalizeMd(s: string) {
  return (s || "")
    .replace(/\r\n/g, "\n")
    // turn en/em-dash bullets into markdown bullets
    .replace(/^\s*[–—]\s+/gm, "- ");
}

export default function Page() {
  const supabase = browserSupabase();

  // Auth + profile
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<{ credits: number; email: string } | null>(null);

  // Form state
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResponse | null>(null);
  const isAuthed = !!session;

  // --- Effects: session + profile ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession((data.session as Session) ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession((s as Session) ?? null));
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    const loadProfile = async () => {
      if (!session?.user) { setProfile(null); return; }
      const { data } = await supabase
        .from("profiles")
        .select("credits, email")
        .eq("id", session.user.id)
        .single();
      setProfile((data as any) ?? null);
    };
    loadProfile();
  }, [session, supabase]);

  // --- Auth actions ---
  const signIn = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setResult(null);
  };

  // --- Submit flow (uses your existing API) ---
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!session?.user) { await signIn(); return; }

    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/summarise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, instructions: notes }),
        cache: "no-store",
      });

      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("application/json")) {
        const text = await res.text(); // likely an HTML error/redirect
        throw new Error(`Non-JSON (${res.status}) → ${text.slice(0, 180)}`);
      }

      const data = (await res.json()) as ApiResponse;
      setResult(data);

      // refresh credits regardless of outcome
      const { data: p } = await supabase.from("profiles").select("credits, email").single();
      if (p) setProfile(p as any);
    } catch (err: any) {
      setResult({ error: err?.message ?? "Something went wrong" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* NAV */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="grid h-7 w-7 place-items-center rounded-xl bg-white/5 ring-1 ring-white/10">
              <Sparkles className="h-4 w-4" />
            </div>
            <span className="text-sm font-semibold tracking-wide">Vedyug AI • Built in 🇮🇳 for the 🌍</span>
          </div>
          {!session ? (
          <nav className="hidden items-center gap-6 text-sm text-white/70 sm:flex">
            <a href="#features" className="hover:text-white">Features</a>
            <a href="#how" className="hover:text-white">How it works</a>
            <a href="#summarize" className="hover:text-white">Try it</a>
          </nav>):(<div></div>)}
          <div className="flex items-center gap-2">
            {session ? (
              <div className="hidden items-center gap-2 pr-2 text-xs text-white/70 sm:flex">
                <span className="truncate max-w-[26ch]" title={profile?.email || session.user?.email || undefined}>
                  {profile?.email || (session as any)?.user?.email}
                </span>
                <span className="mx-1">•</span>
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-emerald-300">
                  <Zap className="h-3 w-3" /> {profile?.credits ?? "…"} credits
                </span>
              </div>
            ) : null}
            {!session ? (
              <button onClick={signIn} className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10">
                <LogIn className="h-4 w-4" /> Sign in
              </button>
            ) : (
              <button onClick={signOut} className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10">
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            )}
          </div>
        </div>
      </header>

      {/* BODY: if not authed → marketing sections; if authed → only form/result */}
      {!isAuthed && (
        <>
          {/* HERO – with transparent 16:9 image */}
          <section className="relative overflow-hidden border-b border-white/10">
          <BackdropGlow />
          <div className="relative mx-auto max-w-6xl px-4 pt-16 pb-10 sm:pt-24 sm:pb-16">
            <div className="grid items-center gap-10 md:grid-cols-2">
              {/* Left: text + CTAs */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-wider text-white/70">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Get 10 free credits on sign-up
                </div>

                <h1 className="mt-5 text-4xl font-semibold leading-tight sm:text-6xl">
                  Summarize YouTube videos with
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-white/40"> clarity </span>
                  in seconds
                </h1>

                <p className="mt-4 max-w-xl text-lg text-white/70">
                  Paste a link. We fetch the transcript and deliver beautifully structured notes you can
                  skim and share.
                </p>

                <div className="mt-8 flex flex-wrap items-center gap-3">
                  {!session ? (
                    <button
                      onClick={signIn}
                      className="group inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black shadow-sm hover:bg-white/90"
                    >
                      <LogIn className="h-4 w-4" /> Sign in with Google
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </button>
                  ) : (
                    <a
                      href="#summarize"
                      className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black shadow-sm hover:bg-white/90"
                    >
                      Start summarizing <ArrowRight className="h-4 w-4" />
                    </a>
                  )}

                  <a
                    href="#how"
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/0 px-5 py-3 text-sm text-white/90 hover:bg-white/5"
                  >
                    See how it works
                  </a>
                </div>
              </motion.div>

              {/* Right: responsive 16:9 transparent image */}
              <motion.figure
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.05 }}
                className="relative"
              >
                <div className="relative mx-auto aspect-[16/9] w-full max-w-[720px]">
                  <Image
                    src="/hero.png"               // <-- your transparent PNG in /public
                    alt="AI-styled hero illustration for YT Summarizer"
                    fill
                    priority
                    sizes="(max-width: 640px) 92vw, (max-width: 1024px) 50vw, 640px"
                    className="object-contain drop-shadow-[0_0_40px_rgba(143,240,198,0.25)]"
                  />
                </div>
              </motion.figure>
            </div>

            {/* Social proof pills - keep as is */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }} className="mt-12">
              <ShowcaseCard />
            </motion.div>
            <div className="mt-10 grid grid-cols-2 gap-4 text-xs text-white/50 sm:grid-cols-4">
              <ProofPill icon={<Video className="h-3.5 w-3.5" />} text="Works with long videos" />
              <ProofPill icon={<ShieldCheck className="h-3.5 w-3.5" />} text="Private by default (RLS)" />
              <ProofPill icon={<ListChecks className="h-3.5 w-3.5" />} text="Clean, scannable bullets" />
              <ProofPill icon={<Wand2 className="h-3.5 w-3.5" />} text="Prompt-tuned outputs" />
            </div>
          </div>
          </section>

          {/* FEATURES */}

          
          <section id="features" className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              <FeatureCard icon={<Zap className="h-5 w-5" />} title="Lightning‑fast" desc="Optimized pipeline pulls transcripts and drafts in seconds." />
              <FeatureCard icon={<ShieldCheck className="h-5 w-5" />} title="Secure" desc="Supabase Auth + row‑level security. Your data stays yours." />
              <FeatureCard icon={<Sparkles className="h-5 w-5" />} title="Beautiful output" desc="Readable structure: key takeaways, timestamps, action items." />
            </div>
          </section>
          
          {/* HOW IT WORKS */}
          <section id="how" className="mx-auto max-w-6xl px-4 pb-16">
            <h2 className="text-2xl font-semibold sm:text-3xl">How it works</h2>
            <ol className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StepCard step={1} title="Sign in" desc="Use Google — we auto‑create your profile and add free credits." />
              <StepCard step={2} title="Paste a link" desc="Drop a YouTube URL and (optionally) your focus/instructions." />
              <StepCard step={3} title="Get results" desc="Receive a crisp summary with highlights and next steps." />
            </ol>
          </section>
        </>
      )}

      {/* SUMMARIZE SECTION (Form + result only when signed in) */}
      <section id="summarize" className="mx-auto max-w-4xl px-4 pb-24 mt-12">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-8">
          {!session ? (
            <div className="text-center">
              <p className="text-white/80">Sign in to start summarizing</p>
              <button onClick={signIn} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black hover:bg-white/90">
                <LogIn className="h-4 w-4" /> Sign in with Google
              </button>
            </div>
          ) : (
            <>
              {/* Header inside card */}

              {/* Form */}
              <form onSubmit={onSubmit} className="rounded-2xl border border-[#1e2b3b] bg-black/40 p-4 sm:p-6">
                <label className="block text-sm text-white/70">YouTube URL</label>
                <div className="mt-2">
                  <input
                    type="url"
                    required
                    placeholder="https://www.youtube.com/watch?v=VIDEO_ID"
                    className="w-full rounded-xl border border-[#27384d] bg-[#0f1621] px-4 py-3 text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                  />
                </div>

                <label className="mt-5 block text-sm text-white/70">Special instructions (optional)</label>
                <textarea
                  placeholder="e.g. 5 bullets, include timestamps & action items"
                  className="mt-2 w-full min-h-[120px] rounded-xl border border-[#27384d] bg-[#0f1621] px-4 py-3 text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />

                <div className="mt-5 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => { setUrl(""); setNotes(""); setResult(null); }}
                    className="rounded-xl border border-[#2a3a4f] px-4 py-2 text-sm text-white/80 hover:bg-[#101826]"
                  >
                    Reset
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-black disabled:opacity-60"
                  >
                    {loading ? "Summarizing…" : "Summarize"}
                  </button>
                </div>
              </form>

              {/* Result */}
              {result && (
                <section className="mt-6 rounded-2xl border border-[#1e2b3b] bg-black/40 p-4 sm:p-6">
                  {result.error ? (
                    <p className="text-red-400">{result.error}</p>
                  ) : (
                    <>
                      {result.videoTitle && (
                        <h3 className="mb-3 text-xl font-semibold sm:text-2xl">{result.videoTitle}</h3>
                      )}
                      {/*
                      <div className="prose prose-invert max-w-none leading-7 [&>p]:mb-3">
                        <pre className="whitespace-pre-wrap text-[0.98rem]">{result.summary}</pre>
                      </div>
                      */}
                      <div className="text-[0.98rem] leading-7">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            p:   ({children}) => <p className="mb-3">{children}</p>,
                            strong: ({children}) => <strong className="font-semibold text-white">{children}</strong>,
                            ul:  ({children}) => <ul className="my-3 list-disc space-y-2 pl-5 marker:text-white/50">{children}</ul>,
                            ol:  ({children}) => <ol className="my-3 list-decimal space-y-2 pl-5 marker:text-white/50">{children}</ol>,
                            li:  ({children}) => <li className="[&>p]:m-0">{children}</li>,
                            h1:  ({children}) => <h1 className="mb-2 text-xl font-bold">{children}</h1>,
                            h2:  ({children}) => <h2 className="mb-2 text-lg font-semibold">{children}</h2>,
                            code:({children}) => <code className="rounded bg-white/10 px-1 py-0.5 text-[0.9em]">{children}</code>,
                            blockquote: ({children}) => <blockquote className="my-3 border-l-2 border-white/20 pl-4 text-white/80">{children}</blockquote>,
                          }}
                        >
                          {normalizeMd(result.summary || "")}
                        </ReactMarkdown>
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
            </>
          )}
        </div>
      </section>

      {/* CTA STRIP (hidden when signed in) */}
      {!isAuthed && (
        <section className="border-t border-white/10 bg-white/[0.02]">
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-12 text-center sm:flex-row sm:justify-between sm:text-left">
            <h3 className="text-xl font-semibold sm:text-2xl">Try it free — get started in seconds</h3>
            {!session ? (
              <button onClick={signIn} className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black hover:bg-white/90">
                <LogIn className="h-4 w-4" /> Sign in with Google
              </button>
            ) : (
              <a href="#summarize" className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/0 px-5 py-3 text-sm hover:bg-white/5">
                Go to app <ArrowRight className="h-4 w-4" />
              </a>
            )}
          </div>
        </section>
      )}

      {/* FOOTER */}
      <footer className="border-t border-white/10 py-10 text-center text-xs text-white/50">
        <div className="mx-auto max-w-6xl px-4">
          © {new Date().getFullYear()} Vedyug Daily 🇮🇳
          <span className="mx-2 text-white/20">•</span>
          <a href="https://instagram.com/vedyug.daily" target="_blank" rel="noopener noreferrer" className="hover:text-white">Instagram</a>
          <span className="mx-2 text-white/20">•</span>
          <a href="https://youtube.com/@vedyugdaily" target="_blank" rel="noopener noreferrer" className="hover:text-white">YouTube</a>
        </div>
      </footer>
    </div>
  );
}

/* ————— Components ————— */
function BackdropGlow() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -top-24 -left-24 h-80 w-80 rounded-full bg-emerald-400/20 blur-3xl" />
      <div className="absolute -bottom-20 -right-20 h-96 w-96 rounded-full bg-indigo-400/20 blur-3xl" />
    </div>
  );
}

function ProofPill({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
      {icon}
      <span>{text}</span>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.5 }}
      className="rounded-3xl border border-white/10 bg-white/5 p-5"
    >
      <div className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-white/10">{icon}</div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-white/70">{desc}</p>
    </motion.div>
  );
}

function StepCard({ step, title, desc }: { step: number; title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="mb-3 inline-flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 text-xs font-semibold">{step}</div>
      <h4 className="text-base font-semibold">{title}</h4>
      <p className="mt-1 text-sm text-white/70">{desc}</p>
    </div>
  );
}

function ShowcaseCard() {
  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/5 to-white/[0.02] p-0">
      <div className="grid gap-0 sm:grid-cols-2">
        {/* Left: mock summary */}
        <div className="p-6 sm:p-8">
          <div className="mb-3 text-xs uppercase tracking-wide text-white/60">Preview</div>
          <h3 className="text-lg font-semibold">Get actionable notes from YouTube videos</h3>
          <ul className="mt-4 space-y-2 text-sm text-white/80">
            <li className="flex items-start gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-white/60" /> Lightning fast</li>
            <li className="flex items-start gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-white/60" /> Secure</li>
            <li className="flex items-start gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-white/60" /> Beautiful output</li>
            <li className="flex items-start gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-white/60" /> Action items with timestamps for quick revisits</li>
          </ul>
          <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
            <ListChecks className="h-3.5 w-3.5" /> Crisp, skimmable output
          </div>
        </div>
        {/* Right: elegant device-ish frame */}
        <div className="relative grid place-items-center bg-[radial-gradient(ellipse_at_center,_rgba(255,255,255,0.08),_rgba(0,0,0,0)_60%)] p-8">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-black/60 p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between text-xs text-white/50">
              <span>youtube.com</span>
              <span>12:36</span>
            </div>
            <div className="aspect-video w-full overflow-hidden rounded-lg border border-white/10 bg-white/5"></div>
            <div className="mt-4 rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-white/80">
              “This tool saves me hours every week. The summaries are shockingly good.”
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}