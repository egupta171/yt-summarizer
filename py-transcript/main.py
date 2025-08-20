from typing import Optional, List
from datetime import datetime
import platform
from importlib.metadata import version, PackageNotFoundError
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from youtube_transcript_api import YouTubeTranscriptApi, TranscriptsDisabled, NoTranscriptFound

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
    # Build language preference list (no duplicates)
    print("Video ID is:"+videoId)
    

    try:
        # Simple, direct call (works on 0.6.2)
        print("Starting fetch")
        ytt_api = YouTubeTranscriptApi()
        fetched_transcript = ytt_api.fetch(videoId)

    except AttributeError:
        # If your environment lacks get_transcript, use the minimal fallback via list_transcripts
        tlist = YouTubeTranscriptApi.list_transcripts(videoId)
        for l in langs:
            try:
                fetched = tlist.find_transcript([l]).fetch()
                text = normalize(" ".join(p.get("text", "") for p in fetched if p.get("text")))
                if text:
                    return {"ok": True, "videoId": videoId, "lang": l, "text": text}
            except Exception:
                continue
        raise HTTPException(status_code=422, detail="NO_TRANSCRIPT")

    except TranscriptsDisabled:
        raise HTTPException(status_code=422, detail="TRANSCRIPTS_DISABLED")
    except NoTranscriptFound:
        raise HTTPException(status_code=422, detail="NO_TRANSCRIPT")
    except Exception as e:
        # Surface the actual library/HTTP error simply
        raise HTTPException(status_code=502, detail=str(e))

    # Happy path
    trans_text = ""
    for snippet in fetched_transcript:
        trans_text = trans_text + snippet.text + " "
    
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