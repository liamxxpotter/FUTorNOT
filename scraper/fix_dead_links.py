#!/usr/bin/env python3
"""
fix_dead_links.py — Audit YouTube IDs in Supabase and replace dead ones.

Steps:
  1. Fetch all songs from Supabase
  2. Check each YouTube ID via the oEmbed API (no auth required)
  3. For dead videos: search YouTube via yt-dlp for a replacement
  4. Update Supabase with valid replacement IDs

Usage:
    SUPABASE_URL=... SUPABASE_SERVICE_KEY=... python fix_dead_links.py
"""

import os
import sys
import time
import json
import subprocess
import requests
from typing import Optional
from supabase import create_client

OEMBED_URL = "https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={vid}&format=json"
HEADERS = {"User-Agent": "Mozilla/5.0"}


def is_alive(youtube_id: str) -> bool:
    """Return True if the YouTube video is accessible and embeddable."""
    try:
        r = requests.get(OEMBED_URL.format(vid=youtube_id), headers=HEADERS, timeout=10)
        return r.status_code == 200
    except requests.RequestException:
        return False


def search_youtube(title: str, artist: str) -> Optional[str]:
    """Use yt-dlp to search YouTube and return the best matching video ID."""
    query = f"ytsearch1:{title} {artist} official"
    try:
        result = subprocess.run(
            ["venv/bin/yt-dlp", "--print", "id", "--no-playlist",
             "--default-search", "ytsearch", "--no-warnings",
             f"ytsearch1:{title} {artist}"],
            capture_output=True, text=True, timeout=20
        )
        vid = result.stdout.strip()
        if vid and len(vid) == 11:
            return vid
    except (subprocess.TimeoutExpired, FileNotFoundError):
        pass
    return None


def main():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        print("Set SUPABASE_URL and SUPABASE_SERVICE_KEY", file=sys.stderr)
        sys.exit(1)

    client = create_client(url, key)

    print("Fetching all songs from Supabase…")
    songs = []
    page = 0
    while True:
        chunk = client.table("songs").select("id, title, artist, youtube_id, fifa_year").range(page * 1000, page * 1000 + 999).execute()
        songs.extend(chunk.data)
        if len(chunk.data) < 1000:
            break
        page += 1
    print(f"  {len(songs)} songs loaded.\n")

    dead = []
    print("Checking YouTube links…")
    for i, song in enumerate(songs):
        alive = is_alive(song["youtube_id"])
        status = "✓" if alive else "✗ DEAD"
        print(f"  [{i+1}/{len(songs)}] {status}  FIFA {song['fifa_year']} — {song['title']} ({song['youtube_id']})")
        if not alive:
            dead.append(song)
        time.sleep(0.15)  # gentle rate limit

    print(f"\n{len(dead)} dead links found out of {len(songs)}.")

    if not dead:
        print("Nothing to fix!")
        return

    # Save dead list for reference
    with open("dead_links.json", "w") as f:
        json.dump(dead, f, indent=2)
    print(f"Dead list saved to dead_links.json\n")

    # Find replacements
    fixed = 0
    unfixed = []
    for song in dead:
        print(f"Searching replacement: {song['title']} — {song['artist']}")
        new_id = search_youtube(song["title"], song["artist"])
        if not new_id:
            print(f"  ✗ No replacement found")
            unfixed.append(song)
            continue
        if not is_alive(new_id):
            print(f"  ✗ Replacement {new_id} also dead, skipping")
            unfixed.append(song)
            continue
        print(f"  ✓ Replacement found: {new_id}")
        client.table("songs").update({"youtube_id": new_id}).eq("id", song["id"]).execute()
        fixed += 1
        time.sleep(0.5)

    print(f"\nDone. Fixed {fixed}/{len(dead)} dead links.")
    if unfixed:
        print(f"{len(unfixed)} songs still without a working video:")
        for s in unfixed:
            print(f"  - {s['title']} by {s['artist']} (FIFA {s['fifa_year']})")
        with open("unfixed.json", "w") as f:
            json.dump(unfixed, f, indent=2)
        print("Saved to unfixed.json")


if __name__ == "__main__":
    main()
