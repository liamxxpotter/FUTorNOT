-- Migration 001: songs table
-- Stores all FIFA soundtrack songs scraped from fifplay.com

CREATE TABLE IF NOT EXISTS songs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  artist      TEXT NOT NULL,
  youtube_id  TEXT NOT NULL UNIQUE,
  fifa_year   SMALLINT NOT NULL CHECK (fifa_year BETWEEN 2008 AND 2030),
  is_volta    BOOLEAN NOT NULL DEFAULT FALSE,
  match_count INTEGER NOT NULL DEFAULT 0,
  elo         NUMERIC(8,2) NOT NULL DEFAULT 1500.00,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_songs_elo         ON songs (elo DESC);
CREATE INDEX IF NOT EXISTS idx_songs_match_count ON songs (match_count ASC);
CREATE INDEX IF NOT EXISTS idx_songs_fifa_year   ON songs (fifa_year);
