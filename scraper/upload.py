#!/usr/bin/env python3
"""
upload.py — Seeds the Supabase songs table from a songs.json file.

Usage:
    SUPABASE_URL=https://xxx.supabase.co \
    SUPABASE_SERVICE_KEY=your-service-role-key \
    python upload.py songs.json

Uses upsert on youtube_id so the script is safe to re-run (e.g. after adding
more songs for FIFA 21-23 once fifplay.com recovers).
"""

import json
import os
import sys
from supabase import create_client

BATCH_SIZE = 200


def main():
    if len(sys.argv) < 2:
        print("Usage: python upload.py songs.json", file=sys.stderr)
        sys.exit(1)

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        print(
            "Set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables.",
            file=sys.stderr,
        )
        sys.exit(1)

    with open(sys.argv[1]) as f:
        songs = json.load(f)

    print(f"Uploading {len(songs)} songs to Supabase…")
    client = create_client(url, key)

    total = 0
    for i in range(0, len(songs), BATCH_SIZE):
        chunk = songs[i : i + BATCH_SIZE]
        result = (
            client.table("songs")
            .upsert(chunk, on_conflict="youtube_id")
            .execute()
        )
        total += len(chunk)
        print(f"  {total}/{len(songs)} uploaded")

    print(f"Done. {total} songs upserted.")


if __name__ == "__main__":
    main()
