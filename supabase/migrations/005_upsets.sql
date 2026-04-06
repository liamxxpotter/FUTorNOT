-- Step 1: Add ELO snapshot columns to votes (nullable so existing rows unaffected)
ALTER TABLE votes
  ADD COLUMN IF NOT EXISTS winner_elo_before NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS loser_elo_before  NUMERIC(8,2);

-- Index to speed up upset queries
CREATE INDEX IF NOT EXISTS idx_votes_upset
  ON votes (loser_elo_before DESC, winner_elo_before ASC)
  WHERE winner_elo_before IS NOT NULL AND winner_elo_before < loser_elo_before;

-- Step 2: Replace record_vote() to snapshot ELOs before computing new values
CREATE OR REPLACE FUNCTION record_vote(
  p_winner_id UUID,
  p_loser_id  UUID,
  p_session_id TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_winner songs%ROWTYPE;
  v_loser  songs%ROWTYPE;
  v_k      CONSTANT NUMERIC := 32;
  v_exp_w  NUMERIC;
  v_new_w  NUMERIC;
  v_new_l  NUMERIC;
  v_winner_elo_snap NUMERIC(8,2);
  v_loser_elo_snap  NUMERIC(8,2);
  -- Lock in consistent UUID order to prevent deadlocks
  v_first  UUID;
  v_second UUID;
BEGIN
  IF p_winner_id < p_loser_id THEN
    v_first := p_winner_id; v_second := p_loser_id;
  ELSE
    v_first := p_loser_id;  v_second := p_winner_id;
  END IF;

  SELECT * INTO v_winner FROM songs WHERE id = v_first  FOR UPDATE;
  SELECT * INTO v_loser  FROM songs WHERE id = v_second FOR UPDATE;

  -- Re-fetch in correct winner/loser order after locking
  IF p_winner_id <> v_first THEN
    -- Swap so v_winner / v_loser match the actual winner/loser
    DECLARE tmp songs%ROWTYPE;
    BEGIN
      tmp := v_winner; v_winner := v_loser; v_loser := tmp;
    END;
  END IF;

  -- Duplicate-vote check (unique index enforces atomically too)
  IF EXISTS (
    SELECT 1 FROM votes
    WHERE session_id = p_session_id
      AND LEAST(winner_id, loser_id)    = LEAST(p_winner_id, p_loser_id)
      AND GREATEST(winner_id, loser_id) = GREATEST(p_winner_id, p_loser_id)
  ) THEN
    RAISE EXCEPTION 'Duplicate vote';
  END IF;

  -- Snapshot ELOs BEFORE computing new values
  v_winner_elo_snap := v_winner.elo;
  v_loser_elo_snap  := v_loser.elo;

  -- ELO calculation
  v_exp_w := 1.0 / (1.0 + POWER(10, (v_loser_elo_snap - v_winner_elo_snap) / 400.0));
  v_new_w := v_winner_elo_snap + v_k * (1.0 - v_exp_w);
  v_new_l := v_loser_elo_snap  + v_k * (0.0 - (1.0 - v_exp_w));

  UPDATE songs SET elo = v_new_w, match_count = match_count + 1 WHERE id = p_winner_id;
  UPDATE songs SET elo = v_new_l, match_count = match_count + 1 WHERE id = p_loser_id;

  INSERT INTO votes (winner_id, loser_id, session_id, winner_elo_before, loser_elo_before)
  VALUES (p_winner_id, p_loser_id, p_session_id, v_winner_elo_snap, v_loser_elo_snap);

  RETURN jsonb_build_object(
    'winner_elo', ROUND(v_new_w, 2),
    'loser_elo',  ROUND(v_new_l, 2)
  );
END;
$$;

-- Step 3: New get_upsets() RPC — top 25 biggest upsets (low-ELO beat high-ELO)
CREATE OR REPLACE FUNCTION get_upsets()
RETURNS TABLE (
  vote_id            UUID,
  voted_at           TIMESTAMPTZ,
  winner_title       TEXT,
  winner_artist      TEXT,
  winner_elo_before  NUMERIC(8,2),
  loser_title        TEXT,
  loser_artist       TEXT,
  loser_elo_before   NUMERIC(8,2),
  upset_margin       NUMERIC(8,2)
)
LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT
    v.id,
    v.voted_at,
    w.title,
    w.artist,
    v.winner_elo_before,
    l.title,
    l.artist,
    v.loser_elo_before,
    (v.loser_elo_before - v.winner_elo_before) AS upset_margin
  FROM votes v
  JOIN songs w ON w.id = v.winner_id
  JOIN songs l ON l.id = v.loser_id
  WHERE v.winner_elo_before IS NOT NULL
    AND v.winner_elo_before < v.loser_elo_before
  ORDER BY upset_margin DESC
  LIMIT 25;
$$;

GRANT EXECUTE ON FUNCTION get_upsets() TO anon;
