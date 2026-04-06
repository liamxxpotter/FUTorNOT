-- ELO history snapshots
CREATE TABLE elo_snapshots (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id    UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  elo        NUMERIC(8,2) NOT NULL,
  snapped_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_snapshots_song_time ON elo_snapshots (song_id, snapped_at DESC);

ALTER TABLE elo_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "snapshots_read" ON elo_snapshots FOR SELECT TO anon USING (TRUE);

-- Snapshot function — called daily by a Supabase Edge Function cron
CREATE OR REPLACE FUNCTION take_elo_snapshot()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_count INTEGER;
BEGIN
  INSERT INTO elo_snapshots (song_id, elo)
  SELECT id, elo FROM songs;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
GRANT EXECUTE ON FUNCTION take_elo_snapshot() TO service_role;

-- Seed with today's values so sparklines aren't empty from day 1
INSERT INTO elo_snapshots (song_id, elo)
SELECT id, elo FROM songs;

-- NOTE: pg_cron is not available on the free tier.
-- To schedule daily snapshots, create a Supabase Edge Function that calls
-- take_elo_snapshot() and schedule it via the Supabase dashboard cron UI,
-- or use an external cron service to POST to the Edge Function daily.
