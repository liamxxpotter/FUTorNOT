#!/usr/bin/env python3
"""
seed_2123.py — Seed FIFA 21, 22, and 23 songs into Supabase.

Sources:
  FIFA 21 — hardcoded from YouTube compilation video description (mQOvgnhaGIA)
  FIFA 22 — scraped from Wikipedia (en.wikipedia.org/wiki/FIFA_22)
  FIFA 23 — hardcoded from YouTube video description (CZu7qRdO7I8)

For each song, yt-dlp searches YouTube for the best matching video ID.
"""

import os, sys, time, subprocess
from typing import Optional
import requests
from bs4 import BeautifulSoup
from supabase import create_client

# ─── Tracklists ───────────────────────────────────────────────────────────────

FIFA21 = [
    ("070 Shake",                                     "Morrow"),
    ("Aitch",                                         "MICE"),
    ("Alfie Templeman",                               "Wish I Was Younger"),
    ("Anitta, Myke Towers & Cardi B",                 "Me Gusta"),
    ("Biig Piig",                                     "Don't Turn Around"),
    ("Buju Banton",                                   "Unity"),
    ("Carlos Sadness & Bomba Estero",                 "Aloha"),
    ("Celeste",                                       "Stop This Flame"),
    ("Chloe Black",                                   "Sacrifice"),
    ("De Lux",                                        "Cool Up"),
    ("Domino Saints",                                 "BUYA"),
    ("Dua Lipa & The Blessed Madonna",                "Love Is Religion (The Blessed Madonna Remix)"),
    ("Dylan Fraser",                                  "Vipers"),
    ("Everything Is Recorded, Infinite Coles & BERWYN", "01:32AM / Walk Alone"),
    ("Fireboy DML",                                   "Scatter"),
    ("Glass Animals",                                 "Heat Waves"),
    ("ICEKIID",                                       "ErruDumEllaHvad"),
    ("KAWALA",                                        "Ticket To Ride"),
    ("LA Priest",                                     "Beginning"),
    ("LARRY PINK THE HUMAN",                          "MIGHT DELETE LATER"),
    ("Leyma",                                         "been a minute"),
    ("Louis The Child & EARTHGANG",                   "Big Love"),
    ("Madame Gandhi",                                 "Bad Habits"),
    ("Mike Sabath",                                   "Good Energy"),
    ("Nia Wyn",                                       "Who Asked You"),
    ("Nnena",                                         "Work It Out"),
    ("Oliver Malcolm",                                "Switched Up"),
    ("Oscar Lang",                                    "Apple Juice"),
    ("Park Hye Jin",                                  "Like This"),
    ("Royal Blood",                                   "Trouble's Coming"),
    ("Steam Down & Afronaut Zu",                      "Etcetera"),
    ("Still Woozy",                                   "Window"),
    ("Tame Impala",                                   "Is It True"),
    ("tha Supreme & Dani Faiv",                       "no14"),
    ("The Snuts",                                     "That's All It Is"),
    ("Zaia",                                          "SHADE"),
]

FIFA23 = [
    ("Lane 8 ft. Arctic Lake",          "All I Want"),
    ("San Holo",                         "All The Highs"),
    ("Danger Mouse & Black Thought ft. Michael Kiwanuka", "Aquamarine"),
    ("Gorillaz",                         "Baby Queen"),
    ("M.I.A.",                           "Beep"),
    ("Odesza",                           "Behind The Sun"),
    ("SOFY",                             "Big Talk"),
    ("Hak Baker",                        "Bricks In The Wall"),
    ("Venice",                           "Can't Sleep"),
    ("Wings of Desire",                  "Choose A Life"),
    ("Harry Stone",                      "Daydreaming"),
    ("MILKBLOOD",                        "Disco Closure"),
    ("moa moa",                          "Drive"),
    ("Biig Piig",                        "FUN"),
    ("Sea Girls",                        "Falling Apart"),
    ("Crooked Colours",                  "Feel It"),
    ("Stromae",                          "Fils de joie"),
    ("Pheelz ft. BNXN",                 "Finesse"),
    ("Phantoms ft. Big Wild",            "Firepit"),
    ("Ark Woods",                        "First Flight To Mars"),
    ("Nia Archives",                     "Forbidden Feelingz"),
    ("Chappaqua Wrestling",              "Full Round Table"),
    ("Nathan Day",                       "Hello Alien"),
    ("James BKS ft. The Big Hash",       "High Level"),
    ("Cryalot",                          "Hurt Me"),
    ("Atewya",                           "Jagna"),
    ("PONGO",                            "Kuzola"),
    ("Sampa The Great ft. Angelique Kidjo", "Let Me Be Great"),
    ("Labrinth",                         "Lift Off"),
    ("SOHN",                             "MIA"),
    ("Bakermat",                         "Madan (King)"),
    ("Ibeyi ft. Pa Salieu",              "Made of Gold"),
    ("Tseba ft. Electric Fields",        "Must Be Love"),
    ("FKA Twigs ft. Shygirl",           "Papi Bones"),
    ("George FitzGerald ft. Panda Bear", "Passed Tense"),
    ("Bru-C",                            "Playground"),
    ("Rose Gray",                        "Prettier Than You"),
    ("Young Fathers",                    "Rice"),
    ("Niko B",                           "Rips In Jeans"),
    ("ROSALIA",                          "Saoko"),
    ("Flume ft. Caroline Polachek",      "Sirens"),
    ("Muddy Monk",                       "Smthng"),
    ("Haich Ber Na",                     "So Sick Of Me"),
    ("Yeah Yeah Yeahs ft. Perfume Genius", "Spitting Off The Edge Of The World"),
    ("Greentea Peng",                    "Stuck In The Middle"),
    ("Trueno & Victor Heredia",          "TIERRA ZANTA"),
    ("Daniela Lalita",                   "Tenia Razon"),
    ("Phoenix ft. Ezra Koenig",          "Tonight"),
    ("Badshah, J Balvin & Tainy",        "Voodoo"),
    ("The Knocks ft. Totally Enormous Extinct Dinosaurs", "Walking On Water"),
    ("Willow Kayne",                     "White City"),
    ("blackwave. ft. Abhi The Nomad",    "a-okay"),
    ("ROLE MODEL",                       "forever&more"),
]

HEADERS = {"User-Agent": "Mozilla/5.0"}


# ─── Helpers ──────────────────────────────────────────────────────────────────

def get_fifa22_from_wikipedia() -> list:
    """Scrape FIFA 22 soundtrack from Wikipedia."""
    print("  Fetching FIFA 22 from Wikipedia…")
    r = requests.get("https://en.wikipedia.org/wiki/FIFA_22", headers=HEADERS, timeout=15)
    soup = BeautifulSoup(r.text, "html.parser")
    songs = []
    for h in soup.find_all(["h2", "h3"]):
        if "soundtrack" in h.get_text().lower():
            tbl = h.find_next("table")
            if not tbl:
                break
            rows = tbl.find_all("tr")[1:]  # skip header
            for row in rows:
                cells = row.find_all(["td", "th"])
                if len(cells) >= 2:
                    artist = cells[0].get_text(strip=True)
                    title  = cells[1].get_text(strip=True).strip('"').strip('\u201c').strip('\u201d')
                    if artist and title:
                        songs.append((artist, title))
            break
    print(f"  {len(songs)} songs found in Wikipedia table.")
    return songs


def search_yt(artist: str, title: str, year: int) -> Optional[str]:
    """Use yt-dlp to find a YouTube video ID for a song."""
    query = f"{title} {artist} official"
    try:
        result = subprocess.run(
            ["venv/bin/yt-dlp", "--print", "id", "--no-playlist",
             "--no-warnings", f"ytsearch1:{query}"],
            capture_output=True, text=True, timeout=20
        )
        vid = result.stdout.strip()
        return vid if vid and len(vid) == 11 else None
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return None


def check_alive(youtube_id: str) -> bool:
    try:
        r = requests.get(
            f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={youtube_id}&format=json",
            headers=HEADERS, timeout=8
        )
        return r.status_code == 200
    except Exception:
        return False


# ─── Main ─────────────────────────────────────────────────────────────────────

def process_year(year: int, tracks: list, client) -> int:
    """Find YouTube IDs for each track and upsert into Supabase. Returns count inserted."""
    rows = []
    for artist, title in tracks:
        print(f"  Searching: {title} — {artist}")
        yt_id = search_yt(artist, title, year)
        if not yt_id:
            print(f"    ✗ No result")
            time.sleep(0.3)
            continue
        if not check_alive(yt_id):
            # Try once more with a slightly different query
            yt_id = search_yt(artist, title + " audio", year)
            if not yt_id or not check_alive(yt_id):
                print(f"    ✗ Video dead, skipping")
                time.sleep(0.3)
                continue
        print(f"    ✓ {yt_id}")
        rows.append({
            "title":      title,
            "artist":     artist,
            "youtube_id": yt_id,
            "fifa_year":  year,
            "is_volta":   False,
        })
        time.sleep(0.4)

    if rows:
        client.table("songs").upsert(rows, on_conflict="youtube_id").execute()
    return len(rows)


def main():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        print("Set SUPABASE_URL and SUPABASE_SERVICE_KEY", file=sys.stderr)
        sys.exit(1)

    client = create_client(url, key)

    print("=== FIFA 2021 ===")
    n21 = process_year(2021, FIFA21, client)
    print(f"  → {n21} songs inserted\n")

    print("=== FIFA 2022 ===")
    fifa22 = get_fifa22_from_wikipedia()
    n22 = process_year(2022, fifa22, client)
    print(f"  → {n22} songs inserted\n")

    print("=== FIFA 2023 ===")
    n23 = process_year(2023, FIFA23, client)
    print(f"  → {n23} songs inserted\n")

    print(f"Done. Total inserted: {n21 + n22 + n23}")


if __name__ == "__main__":
    main()
