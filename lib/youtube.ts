export function extractYouTubeId(input: string): string | null {
    try {
      const u = new URL(input);
      if (u.hostname.includes("youtu.be")) {
        return u.pathname.slice(1) || null;
      }
      if (u.hostname.includes("youtube.com")) {
        const id = u.searchParams.get("v");
        if (id) return id;
        const paths = u.pathname.split("/");
        const shortsIdx = paths.indexOf("shorts");
        if (shortsIdx >= 0 && paths[shortsIdx + 1]) return paths[shortsIdx + 1];
      }
      return null;
    } catch {
      return null;
    }
  }
  
  export function chunkText(txt: string, maxChars = 14000) {
    if (txt.length <= maxChars) return [txt];
    const chunks: string[] = [];
    for (let i = 0; i < txt.length; i += maxChars) {
      chunks.push(txt.slice(i, i + maxChars));
    }
    return chunks;
  }
  