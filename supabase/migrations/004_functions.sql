-- Migration 004: Postgres functions
-- get_pair()    — returns 2 songs biased toward fewer matches, avoiding already-voted pairs
-- record_vote() — atomically records a vote and updates ELO ratings (SECURITY DEFINER)

-- ─── get_pair ────────────────────────────────────────────────────────────────
-- Called by the frontend via supabase.rpc('get_pair', { p_session_id })
-- Returns 2 song rows. Biases toward songs with fewer matches to ensure
-- even coverage across the full catalogue.

CREATE OR REPLACE FUNCTION get_pair(p_session_id TEXT)
RETURNS SETOF songs
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  WITH
  -- Take the 100 least-played songs as our candidate pool.
  -- This naturally weights toward under-played songs without complex math.
  candidates AS (
    SELECT s.*
    FROM songs s
    ORDER BY s.match_count ASC, RANDOM()
    LIMIT 100
  ),
  -- Filter out songs this session has already voted on (conservative exclusion).
  -- The unique index in votes handles exact pair dedup atomically.
  eligible AS (
    SELECT c.*
    FROM candidates c
    WHERE NOT EXISTS (
      SELECT 1 FROM votes v
      WHERE v.session_id = p_session_id
        AND (v.winner_id = c.id OR v.loser_id = c.id)
    )
  )
  SELECT * FROM eligible
  ORDER BY RANDOM()
  LIMIT 2;
$$;


-- ─── record_vote ─────────────────────────────────────────────────────────────
-- Called by the frontend via supabase.rpc('record_vote', { ... })
-- Runs as SECURITY DEFINER so it can UPDATE elo/match_count despite RLS.
-- Locks both song rows, computes ELO delta, updates songs, inserts vote.

CREATE OR REPLACE FUNCTION record_vote(
  p_winner_id  UUID,
  p_loser_id   UUID,
  p_session_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_winner     songs%ROWTYPE;
  v_loser      songs%ROWTYPE;
  v_k          CONSTANT NUMERIC := 32;
  v_exp_winner NUMERIC;
  v_new_winner NUMERIC;
  v_new_loser  NUMERIC;
BEGIN
  -- Lock both rows in a deterministic order to prevent deadlocks
  IF p_winner_id < p_loser_id THEN
    SELECT * INTO v_winner FROM songs WHERE id = p_winner_id FOR UPDATE;
    SELECT * INTO v_loser  FROM songs WHERE id = p_loser_id  FOR UPDATE;
  ELSE
    SELECT * INTO v_loser  FROM songs WHERE id = p_loser_id  FOR UPDATE;
    SELECT * INTO v_winner FROM songs WHERE id = p_winner_id FOR UPDATE;
  END IF;

  IF v_winner.id IS NULL OR v_loser.id IS NULL THEN
    RAISE EXCEPTION 'Invalid song IDs: % or %', p_winner_id, p_loser_id;
  END IF;

  -- Check for duplicate vote from this session on this pair
  IF EXISTS (
    SELECT 1 FROM votes
    WHERE session_id = p_session_id
      AND LEAST(winner_id::text, loser_id::text)    = LEAST(p_winner_id::text, p_loser_id::text)
      AND GREATEST(winner_id::text, loser_id::text) = GREATEST(p_winner_id::text, p_loser_id::text)
  ) THEN
    RAISE EXCEPTION 'Duplicate vote for this pair by session %', p_session_id;
  END IF;

  -- Standard ELO: expected score for winner = 1 / (1 + 10^((Rb - Ra) / 400))
  v_exp_winner := 1.0 / (1.0 + POWER(10.0, (v_loser.elo - v_winner.elo) / 400.0));

  -- Winner scored 1, loser scored 0
  v_new_winner := v_winner.elo + v_k * (1.0 - v_exp_winner);
  v_new_loser  := v_loser.elo  + v_k * (0.0 - (1.0 - v_exp_winner));

  -- Update ELO and match count for both songs
  UPDATE songs
  SET elo = ROUND(v_new_winner, 2), match_count = match_count + 1
  WHERE id = p_winner_id;

  UPDATE songs
  SET elo = ROUND(v_new_loser, 2), match_count = match_count + 1
  WHERE id = p_loser_id;

  -- Record the vote
  INSERT INTO votes (winner_id, loser_id, session_id)
  VALUES (p_winner_id, p_loser_id, p_session_id);

  RETURN jsonb_build_object(
    'winner_elo', ROUND(v_new_winner, 2),
    'loser_elo',  ROUND(v_new_loser, 2)
  );
END;
$$;

-- Grant execute to anon so the frontend can call these via supabase.rpc()
GRANT EXECUTE ON FUNCTION get_pair(TEXT)           TO anon;
GRANT EXECUTE ON FUNCTION record_vote(UUID, UUID, TEXT) TO anon;
