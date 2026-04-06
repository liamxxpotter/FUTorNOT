-- Migration 002: votes table
-- Records every vote. Session-pair uniqueness enforced at the DB level.

CREATE TABLE IF NOT EXISTS votes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  winner_id  UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  loser_id   UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  voted_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT different_songs CHECK (winner_id <> loser_id)
);

-- Prevents a session from voting on the same pair twice, regardless of order.
-- LEAST/GREATEST normalises (A,B) and (B,A) to the same canonical pair.
CREATE UNIQUE INDEX IF NOT EXISTS idx_votes_session_pair
  ON votes (
    session_id,
    LEAST(winner_id::text, loser_id::text),
    GREATEST(winner_id::text, loser_id::text)
  );

CREATE INDEX IF NOT EXISTS idx_votes_winner  ON votes (winner_id);
CREATE INDEX IF NOT EXISTS idx_votes_loser   ON votes (loser_id);
CREATE INDEX IF NOT EXISTS idx_votes_session ON votes (session_id);
