"""
parsers.py — HTML parsing logic for fifplay.com soundtrack pages.

Scraping strategy:
  1. Find all <a> tags whose href contains youtube.com/watch?v=  → extract VIDEO_ID
  2. From each YouTube anchor, locate the adjacent song title link
     (/fifa-XX/soundtrack/slug/) and artist text node
  3. For FIFA 20+, split HTML at the VOLTA heading to tag songs correctly

Wikipedia fallback strategy (FIFA 21-23):
  - Fetch the Wikipedia article for "FIFA XX soundtrack"
  - Parse the wikitable rows for Title + Artist columns
  - Use youtube-search-python to resolve each Title + Artist to a YouTube ID
"""

import re
import time
import sys
from typing import Optional
import requests
from bs4 import BeautifulSoup, NavigableString

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}

YT_ID_RE = re.compile(r"[?&]v=([A-Za-z0-9_-]{11})")
SOUNDTRACK_SLUG_RE = re.compile(r"/fifa-\d+/soundtrack/")
WIKIPEDIA_BASE = "https://en.wikipedia.org/wiki/FIFA_{year}_soundtrack"

# ─── fifplay parsing ──────────────────────────────────────────────────────────

def _extract_yt_id(href: str) -> Optional[str]:
    m = YT_ID_RE.search(href)
    return m.group(1) if m else None


def _extract_songs_from_html(html: str, fifa_year: int, is_volta: bool) -> list:
    """
    Parse a chunk of fifplay HTML and return song dicts.

    Actual page structure (confirmed from live page inspection):
      <tr>
        <td class="play">
          <a href="https://www.youtube.com/watch?v=VIDEO_ID" ...>
            <img alt="SONG TITLE" src="/img/icons/play.svg"/>
          </a>
        </td>
        <td>
          <div><a href="/fifa-XX/soundtrack/slug/">SONG TITLE</a></div>
          <div>ARTIST NAME</div>
        </td>
        <td><a class="itunes" ...></a></td>
      </tr>

    Strategy: iterate over <tr> rows, find the YouTube link in the first <td>,
    then extract title and artist from the <div> elements in the second <td>.
    """
    soup = BeautifulSoup(html, "html.parser")
    songs = []
    seen = set()

    for row in soup.find_all("tr"):
        tds = row.find_all("td", recursive=False)
        if len(tds) < 2:
            continue

        # First <td>: YouTube play link
        yt_anchor = tds[0].find("a", href=YT_ID_RE)
        if not yt_anchor:
            continue
        yt_id = _extract_yt_id(yt_anchor.get("href", ""))
        if not yt_id or yt_id in seen:
            continue

        # Second <td>: two <div>s — first has title link, second has artist
        info_td = tds[1]
        divs = info_td.find_all("div", recursive=False)

        if len(divs) >= 2:
            # Normal structure: <div><a>Title</a></div><div>Artist</div>
            title_link = divs[0].find("a")
            song_title = title_link.get_text(strip=True) if title_link else divs[0].get_text(strip=True)
            artist = divs[1].get_text(strip=True)
        elif len(divs) == 1:
            # Fallback: title and artist may be in one div separated by <br>
            title_link = divs[0].find("a", href=SOUNDTRACK_SLUG_RE)
            song_title = title_link.get_text(strip=True) if title_link else ""
            # Artist follows the <br> tag
            br = divs[0].find("br")
            artist = br.next_sibling.strip() if br and br.next_sibling else ""
        else:
            # Last resort: try any <a> with a soundtrack slug
            title_link = info_td.find("a", href=SOUNDTRACK_SLUG_RE)
            if not title_link:
                continue
            song_title = title_link.get_text(strip=True)
            artist = info_td.get_text(strip=True).replace(song_title, "").strip(" -—|")

        if not song_title or not artist:
            continue

        seen.add(yt_id)
        songs.append({
            "title": song_title,
            "artist": artist,
            "youtube_id": yt_id,
            "fifa_year": 2000 + fifa_year,
            "is_volta": is_volta,
        })

    return songs


def parse_fifplay_page(url: str, fifa_year: int, has_volta: bool = False) -> Optional[list]:
    """
    Fetch a fifplay.com soundtrack page and return a list of song dicts.
    Returns None if the fetch fails (non-200 response).
    """
    try:
        resp = requests.get(url, headers=HEADERS, timeout=20)
        resp.raise_for_status()
    except requests.RequestException as e:
        print(f"  fifplay fetch failed: {e}", file=sys.stderr)
        return None

    html = resp.text

    if not has_volta:
        return _extract_songs_from_html(html, fifa_year, is_volta=False)

    # Split HTML at the VOLTA heading to separate main vs. VOLTA songs
    volta_markers = [
        "volta football soundtrack",
        "volta soundtrack",
        "fifa volta",
    ]
    split_idx = -1
    for marker in volta_markers:
        idx = html.lower().find(marker)
        if idx != -1:
            split_idx = idx
            break

    if split_idx == -1:
        # No VOLTA section found — treat everything as main
        return _extract_songs_from_html(html, fifa_year, is_volta=False)

    main_html  = html[:split_idx]
    volta_html = html[split_idx:]
    return (
        _extract_songs_from_html(main_html, fifa_year, is_volta=False)
        + _extract_songs_from_html(volta_html, fifa_year, is_volta=True)
    )


# ─── Wikipedia fallback (FIFA 21-23) ─────────────────────────────────────────

def _resolve_youtube_id(title: str, artist: str) -> Optional[str]:
    """
    Use youtube-search-python to find a YouTube video ID for a song.
    Returns None if nothing is found.
    """
    try:
        from youtubesearchpython import VideosSearch
        query = f"{title} {artist} official"
        results = VideosSearch(query, limit=1).result()
        items = results.get("result", [])
        if items:
            return items[0].get("id")
    except Exception as e:
        print(f"  YouTube search failed for '{title}': {e}", file=sys.stderr)
    return None


def parse_wikipedia_soundtrack(fifa_year: int, is_volta_section: bool = False) -> list:
    """
    Fetch the Wikipedia FIFA XX soundtrack article and extract song data.
    For years with VOLTA sections, parses both tables.
    YouTube IDs are resolved via youtube-search-python (rate-limited with sleep).
    """
    year_full = 2000 + fifa_year
    url = WIKIPEDIA_BASE.format(year=year_full)
    print(f"  Trying Wikipedia: {url}", file=sys.stderr)

    try:
        resp = requests.get(url, headers=HEADERS, timeout=20)
        resp.raise_for_status()
    except requests.RequestException as e:
        print(f"  Wikipedia fetch failed: {e}", file=sys.stderr)
        return []

    soup = BeautifulSoup(resp.text, "html.parser")
    songs = []

    # Wikipedia soundtrack tables use class "wikitable"
    # Columns vary, but "Title" and "Artist" are always present
    tables = soup.find_all("table", class_="wikitable")

    for table_idx, table in enumerate(tables):
        headers = [th.get_text(strip=True).lower() for th in table.find_all("th")]
        if "title" not in headers:
            continue

        try:
            title_col  = headers.index("title")
            artist_col = headers.index("artist") if "artist" in headers else None
        except ValueError:
            continue

        is_volta = (table_idx > 0 and fifa_year >= 20)

        rows = table.find_all("tr")[1:]  # skip header row
        for row in rows:
            cells = row.find_all(["td", "th"])
            if len(cells) <= title_col:
                continue

            title  = cells[title_col].get_text(strip=True).strip('"').strip('"').strip('"')
            artist = cells[artist_col].get_text(strip=True) if artist_col is not None and len(cells) > artist_col else "Unknown"

            if not title or title.lower() in ("title", "song"):
                continue

            print(f"  Searching YouTube: {title} — {artist}", file=sys.stderr)
            yt_id = _resolve_youtube_id(title, artist)
            time.sleep(0.5)  # polite rate limit

            if not yt_id:
                print(f"  WARNING: No YouTube ID found for '{title}' by '{artist}'", file=sys.stderr)
                continue

            songs.append({
                "title": title,
                "artist": artist,
                "youtube_id": yt_id,
                "fifa_year": year_full,
                "is_volta": is_volta,
            })

    return songs
