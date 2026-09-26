"""Media metadata / direct-URL extractors.

These are the *real* extraction routines the original ``main-platform`` gateway
used in production, preserved here with the same behaviour:

* :func:`extract_tiktok_media`  — uses the public tikwm JSON API to get a clean,
  watermark-free MP4 plus the HD cover and the audio track.
* :func:`extract_youtube_thumb` — derives a guaranteed thumbnail from the video id.
* :func:`fetch_opengraph_media` — scrapes ``og:image`` / ``og:title`` with the
  Facebook crawler user-agent, which most platforms allow without auth.
* :func:`extract_media_with_ytdlp` — yt-dlp metadata extraction (``download=False``).

No API keys are required by any of them.
"""

from __future__ import annotations

import asyncio
import html
import json
import logging
import re
import urllib.parse
import urllib.request
from typing import Any, Dict, Optional

from ..utils.config import settings

logger = logging.getLogger("saverfrom.extractors")

# Realistic desktop Chrome UA — datacenter IPs get blocked faster with bot/crawler UAs
BROWSER_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)
FACEBOOK_BOT_UA = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)"

# Rotate through a small set of common desktop UAs so consecutive requests
# from the same server IP look less like a single automated client.
_UA_POOL = [
    BROWSER_UA,
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
]


def _pick_ua() -> str:
    import random
    return random.choice(_UA_POOL)


def _ytdlp_base_opts() -> Dict[str, Any]:
    """Base yt-dlp options tuned for public/shared hosting (anti-block).

    High concurrency (64–128) from a datacenter IP looks like a scraper and
    gets rate-limited or blocked. Keep concurrency low in production.
    """
    from pathlib import Path
    from ..utils.config import settings

    is_prod = settings.is_production
    opts: Dict[str, Any] = {
        "quiet": True,
        "no_warnings": True,
        "noprogress": True,
        "no_color": True,
        "skip_download": True,
        "noplaylist": True,
        "socket_timeout": 20 if is_prod else 12,
        "retries": 3 if is_prod else 1,
        "extractor_retries": 2 if is_prod else 1,
        "fragment_retries": 3 if is_prod else 1,
        # Low concurrency on public IPs avoids bot detection / IP bans
        "concurrent_fragment_downloads": 4 if is_prod else 16,
        "nocheckcertificate": True,
        "geo_bypass": True,
        "http_headers": {
            "User-Agent": _pick_ua(),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate, br",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Sec-Fetch-Dest": "document",
            "Sec-Ch-Ua": '"Chromium";v="131", "Not_A Brand";v="24"',
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": '"Windows"',
        },
    }
    # YouTube bot-check bypass: path to Netscape cookies.txt from a real browser
    cookies = (getattr(settings, "COOKIES_FILE", None) or "").strip()
    if cookies and Path(cookies).is_file():
        opts["cookiefile"] = cookies
    return opts


# ────────────────────────────────────────────────────────────────────────────
# TikTok — public tikwm API (no key required)
# ─────────────────────────────────────────────────────────────────────────────
def extract_tiktok_media(url: str) -> Optional[Dict[str, Any]]:
    """Fetch real video metadata, HD cover thumbnail and clean MP4 stream."""
    try:
        api_url = f"https://www.tikwm.com/api/?url={urllib.parse.quote(url)}"
        request = urllib.request.Request(api_url, headers={"User-Agent": BROWSER_UA})
        with urllib.request.urlopen(request, timeout=6) as response:
            data = json.loads(response.read().decode("utf-8"))

        if data.get("code") != 0 or "data" not in data:
            return None

        payload = data["data"]
        title = payload.get("title") or "TikTok Video"
        thumb = payload.get("cover") or payload.get("origin_cover")
        play_url = payload.get("play") or payload.get("wmplay")
        duration = payload.get("duration")
        duration_str = (
            f"{int(duration // 60):02d}:{int(duration % 60):02d}" if duration else "00:30"
        )
        music_url = (payload.get("music_info") or {}).get("play")

        if not play_url:
            return None

        return {
            "title": title,
            "thumbnail": thumb,
            "download_url": play_url,
            "audio_url": music_url or play_url,
            "duration": duration_str,
            "uploader": (payload.get("author") or {}).get("nickname") or "",
        }
    except Exception as exc:
        logger.info("TikTok fast-extractor unavailable: %s", exc)
        return None


# ────────────────────────────────────────────────────────────────────────────
# YouTube — guaranteed thumbnail from the video id
# ────────────────────────────────────────────────────────────────────────────
def extract_youtube_thumb(url: str) -> Optional[str]:
    match = re.search(
        r"(?:v=|/|youtu\.be/|embed/|shorts/)([0-9A-Za-z_-]{11})", url or ""
    )
    if match:
        return f"https://i.ytimg.com/vi/{match.group(1)}/hqdefault.jpg"
    return None


# ─────────────────────────────────────────────────────────────────────────────
# OpenGraph scraping — generic real-title/thumbnail fallback
# ────────────────────────────────────────────────────────────────────────────
def fetch_opengraph_media(url: str) -> Dict[str, Optional[str]]:
    """Scrape OpenGraph meta tags using the Facebook crawler user-agent."""
    try:
        request = urllib.request.Request(
            url,
            headers={
                "User-Agent": FACEBOOK_BOT_UA,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.5",
            },
        )
        with urllib.request.urlopen(request, timeout=8) as response:
            content = response.read().decode("utf-8", errors="ignore")

        img_match = re.search(
            r"<meta\s+(?:property|name)=[\"']og:image[\"']\s+content=[\"']([^\"']+)[\"']",
            content,
            re.I,
        ) or re.search(
            r"<meta\s+content=[\"']([^\"']+)[\"']\s+(?:property|name)=[\"']og:image[\"']",
            content,
            re.I,
        )
        title_match = re.search(
            r"<meta\s+(?:property|name)=[\"']og:title[\"']\s+content=[\"']([^\"']+)[\"']",
            content,
            re.I,
        ) or re.search(
            r"<meta\s+content=[\"']([^\"']+)[\"']\s+(?:property|name)=[\"']og:title[\"']",
            content,
            re.I,
        )

        return {
            "image": html.unescape(img_match.group(1)) if img_match else None,
            "title": html.unescape(title_match.group(1)) if title_match else None,
        }
    except Exception as exc:
        logger.info("OpenGraph scrape failed for %s: %s", url, exc)
        return {}
