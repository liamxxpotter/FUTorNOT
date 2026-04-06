#!/usr/bin/env python3
"""
scrape.py — FUTorNOT data scraper

Scrapes FIFA soundtrack data from fifplay.com (FIFA 08-20) and falls back
to Wikipedia + YouTube search for FIFA 21-23 where fifplay returns HTTP 500.

Usage:
    python scrape.py > songs.json

Output:
    JSON array of song objects:
    [
      {
        "title": "Song Title",
        "artist": "Artist Name",
        "youtube_id": "dQw4w9WgXcQ",
        "fifa_year": 2012,
        "is_volta": false
      },
      ...
    ]
"""

import json
import sys
import time
from parsers import parse_fifplay_page, parse_wikipedia_soundtrack

# FIFA years with VOLTA sections (FIFA 20+)
VOLTA_YEARS = {20, 21, 22, 23}

# fifplay.com URL pattern
FIFPLAY_URL = "https://www.fifplay.com/fifa-{year:02d}-soundtrack/"


def scrape_year(year: int) -> list[dict]:
    """Scrape one FIFA year. Returns a list of song dicts."""
    year_full = 2000 + year
    has_volta = year in VOLTA_YEARS

    url = FIFPLAY_URL.format(year=year)
    print(f"FIFA {year_full}: fetching {url}", file=sys.stderr)
    songs = parse_fifplay_page(url, year, has_volta=has_volta)

    if songs is None:
        print(f"FIFA {year_full}: fifplay failed → Wikipedia fallback", file=sys.stderr)
        songs = parse_wikipedia_soundtrack(year, is_volta_section=has_volta)

    return songs or []


def main():
    all_songs = []
    seen_yt_ids = set()

    for year in range(8, 24):  # FIFA 08 through FIFA 23
        songs = scrape_year(year)

        # Deduplicate by YouTube ID across all years
        unique = []
        for s in songs:
            if s["youtube_id"] not in seen_yt_ids:
                seen_yt_ids.add(s["youtube_id"])
                unique.append(s)
            else:
                print(f"  Skipping duplicate youtube_id {s['youtube_id']} ({s['title']})", file=sys.stderr)

        print(f"  → {len(unique)} unique songs", file=sys.stderr)
        all_songs.extend(unique)

        # Polite crawl delay between pages
        if year < 23:
            time.sleep(1.5)

    print(f"\nTotal songs: {len(all_songs)}", file=sys.stderr)
    print(json.dumps(all_songs, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
