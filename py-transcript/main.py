from typing import Optional, List
from datetime import datetime
import platform
from importlib.metadata import version, PackageNotFoundError
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from youtube_transcript_api import YouTubeTranscriptApi, TranscriptsDisabled, NoTranscriptFound
import re, json, requests
from urllib.parse import urlparse, parse_qs

app = FastAPI(title="YT Transcript (minimal)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten later if you want
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

PREF_LANGS: List[str] = ["en", "en-US", "en-GB", "en-IN", "hi"]

def normalize(text: str) -> str:
    return " ".join(text.split())[:60000]

def pkg_ver(name: str) -> str:
    try:
        return version(name)
    except PackageNotFoundError:
        return "unknown"

@app.get("/transcript")

def transcript(videoId: str = Query(..., min_length=5)):
    url = "https://www.youtube.com/watch?v="+videoId
    # --- fetch watch page to grab API key + client version ---
    ua = {
        "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                       "AppleWebKit/537.36 (KHTML, like Gecko) "
                       "Chrome/124.0.0.0 Safari/537.36"),
        "Accept-Language": "en-US,en;q=0.9",
    }
    watch = requests.get(url, headers=ua, timeout=15)
    watch.raise_for_status()
    html = watch.text

    # innertube key + version
    key = re.search(r'"INNERTUBE_API_KEY":"([^"]+)"', html)
    ver = re.search(r'"INNERTUBE_CONTEXT_CLIENT_VERSION":"([^"]+)"', html)
    if not key:
        raise RuntimeError("INNERTUBE_API_KEY not found (age/region/login restrictions?).")
    key = key.group(1)
    client_version = ver.group(1) if ver else "2.20250530.01.00"

    # video id from URL variants
    p = urlparse(url)
    vid = ""
    if p.hostname and "youtu.be" in p.hostname:
        vid = p.path.lstrip("/")
    else:
        vid = parse_qs(p.query).get("v", [""])[0]
        if not vid and "/shorts/" in p.path:
            vid = p.path.split("/shorts/")[-1].split("/")[0]
        if not vid and "/embed/" in p.path:
            vid = p.path.split("/embed/")[-1].split("/")[0]
    if not vid:
        raise ValueError("Could not determine video id from URL.")

    context = {"client": {"hl": "en", "gl": "US", "clientName": "WEB", "clientVersion": client_version}}
    jheaders = {"Content-Type": "application/json", **ua}

    # --- 1) get transcript params from /youtubei/v1/next ---
    next_url = f"https://www.youtube.com/youtubei/v1/next?key={key}&prettyPrint=false"
    nr = requests.post(next_url, headers=jheaders, data=json.dumps({"context": context, "videoId": vid}), timeout=15)
    nr.raise_for_status()
    nxt = nr.json()

    def find_params(obj):
        if isinstance(obj, dict):
            if "getTranscriptEndpoint" in obj and isinstance(obj["getTranscriptEndpoint"], dict):
                ep = obj["getTranscriptEndpoint"]
                if "params" in ep:
                    return ep["params"]
            for v in obj.values():
                out = find_params(v)
                if out:
                    return out
        elif isinstance(obj, list):
            for v in obj:
                out = find_params(v)
                if out:
                    return out
        return None

    params = find_params(nxt)
    if not params:
        raise RuntimeError("Transcript params not found (no transcript for this video or gated).")

    # --- 2) fetch transcript JSON via /youtubei/v1/get_transcript ---
    gt_url = f"https://www.youtube.com/youtubei/v1/get_transcript?key={key}&prettyPrint=false"
    gr = requests.post(gt_url, headers=jheaders, data=json.dumps({"context": context, "params": params}), timeout=15)
    gr.raise_for_status()
    g = gr.json()

    # --- 3) collect cue texts and concatenate ---
    lines = []
    def walk(o):
        """
        Collects transcript text into the outer `lines` list from either:
        - transcriptSegmentRenderer { snippet: { simpleText | runs[] } }
        - transcriptCueRenderer { cue: { simpleText | runs[] } }   (older shape)
        """
        if isinstance(o, dict):
            # --- Newer searchable transcript shape ---
            if "transcriptSegmentRenderer" in o:
                seg = o["transcriptSegmentRenderer"]
                t = ""

                snip = seg.get("snippet", {})
                if isinstance(snip, dict):
                    if "simpleText" in snip and snip["simpleText"]:
                        t = snip["simpleText"]
                    elif "runs" in snip and isinstance(snip["runs"], list):
                        t = "".join(run.get("text", "") for run in snip["runs"] if run.get("text"))

                # Fallback: accessibility label (e.g., "1 minute, 12 seconds <text>")
                if not t:
                    label = (((seg.get("accessibility") or {})
                            .get("accessibilityData") or {})
                            .get("label") or "").strip()
                    if label:
                        # strip leading time phrase like "1 minute, 12 seconds "
                        t = re.sub(r"^\d+(?:\s+hours?)?(?:,\s*\d+\s+minutes?)?(?:,\s*\d+\s+seconds?)?\s*", "", label).strip()

                if t:
                    lines.append(t.strip())

            # --- Older transcript API shape (kept for compatibility) ---
            elif "transcriptCueRenderer" in o:
                cue = o["transcriptCueRenderer"]
                c = cue.get("cue", {})
                t = ""
                if "simpleText" in c and c["simpleText"]:
                    t = c["simpleText"]
                elif "runs" in c and isinstance(c["runs"], list):
                    t = "".join(run.get("text", "") for run in c["runs"] if run.get("text"))
                if t:
                    lines.append(t.strip())

            # Recurse
            for v in o.values():
                walk(v)

        elif isinstance(o, list):
            for v in o:
                walk(v)
    walk(g)

    if not lines:
        raise RuntimeError("Transcript cues not found in response (UI/format may have changed).")

    trans_text = " ".join(lines).strip()
    print(trans_text)
    if not trans_text:
        raise HTTPException(status_code=422, detail="NO_TRANSCRIPT")
    return {"ok": True, "videoId": videoId, "lang": "auto", "text": trans_text}


@app.get("/health")
def health(videoId: Optional[str] = None, deep: bool = Query(False)):
    """
    Lightweight health by default.
    Optional deep check: ?deep=1&videoId=<YOUTUBE_ID> (performs a real transcript call).
    """
    info = {
        "ok": True,
        "service": "yt-transcript",
        "time": datetime.utcnow().isoformat() + "Z",
        "python": platform.python_version(),
        "packages": {
            "fastapi": pkg_ver("fastapi"),
            "uvicorn": pkg_ver("uvicorn"),
            "youtube-transcript-api": pkg_ver("youtube-transcript-api"),
        },
        "mode": "basic",
    }

    if deep:
        if not videoId:
            # still a 200 so Render health checks don’t flap, just signal not-deep
            info["ok"] = False
            info["mode"] = "deep-missing-videoId"
            return info

        try:
            # use the same minimal path you’ve got working
            ytt_api = YouTubeTranscriptApi()
            parts = ytt_api.fetch(videoId)
            text = " ".join(getattr(p, "text", "") for p in parts if getattr(p, "text", ""))
            info["mode"] = "deep"
            info["videoId"] = videoId
            info["hasText"] = bool(text.strip())
            info["chars"] = len(text)
        except Exception as e:
            info["ok"] = False
            info["mode"] = "deep-error"
            info["error"] = str(e)

    return info