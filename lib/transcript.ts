// lib/transcript.ts
type TranscriptOk = { ok: true; text: string; videoId: string; lang?: string };
type TranscriptErr = { ok?: false; detail?: any; error?: string };

function withTimeout<T>(p: Promise<T>, ms = 10000): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error("transcript timeout")), ms)),
  ]) as Promise<T>;
}

export async function fetchTranscript(videoId: string): Promise<string> {
  const base = process.env.TRANSCRIPT_API_URL;
  if (!base) throw new Error("TRANSCRIPT_API_URL is not set");

  const hit_url = `${base.replace(/\/$/, "")}/transcript?videoId=${encodeURIComponent(videoId)}`;

  console.log("URL being hit is: ",hit_url)

  const res = await fetch(hit_url, { method: 'GET' });
  console.log("Res is: ",res)
  
  const body = await res.json()
  console.log("body is: ",body)


  if (!res.ok) {
    const msg =
      (body as TranscriptErr)?.detail?.msg ||
      (body as TranscriptErr)?.detail ||
      (body as TranscriptErr)?.error ||
      `Transcript service ${res.status}`;
    throw new Error(String(msg));
  }

  if (!("ok" in body) || !body.ok) {
    throw new Error("Transcript service returned no data");
  }

  return body.text as string;
}
