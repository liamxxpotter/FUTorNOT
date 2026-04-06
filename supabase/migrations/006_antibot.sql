-- ─── Sessions table ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  session_id  TEXT PRIMARY KEY,
  first_seen  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  vote_count  INTEGER NOT NULL DEFAULT 0,
  is_flagged  BOOLEAN NOT NULL DEFAULT FALSE
);

-- Only service role can read sessions; record_vote() is SECURITY DEFINER so
-- it bypasses RLS when writing.
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
-- No anon policies — sessions are private admin data only.

CREATE INDEX IF NOT EXISTS idx_sessions_flagged    ON sessions (is_flagged) WHERE is_flagged = TRUE;
CREATE INDEX IF NOT EXISTS idx_sessions_vote_count ON sessions (vote_count DESC);

-- ─── record_vote() — rate limit + session upsert ───────────────────────────────
CREATE OR REPLACE FUNCTION record_vote(
  p_winner_id  UUID,
  p_loser_id   UUID,
  p_session_id TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_winner          songs%ROWTYPE;
  v_loser           songs%ROWTYPE;
  v_k               CONSTANT NUMERIC := 32;
  v_exp_w           NUMERIC;
  v_new_w           NUMERIC;
  v_new_l           NUMERIC;
  v_winner_elo_snap NUMERIC(8,2);
  v_loser_elo_snap  NUMERIC(8,2);
  v_first           UUID;
  v_second          UUID;
BEGIN
  -- ① Rate limit: max 30 votes per session per 60 seconds
  IF (
    SELECT COUNT(*)
    FROM   votes
    WHERE  session_id = p_session_id
      AND  voted_at  > NOW() - INTERVAL '60 seconds'
  ) >= 30 THEN
    RAISE EXCEPTION 'Rate limit exceeded';
  END IF;

  -- ② Lock in UUID order to prevent deadlocks
  IF p_winner_id < p_loser_id THEN
    v_first := p_winner_id; v_second := p_loser_id;
  ELSE
    v_first := p_loser_id;  v_second := p_winner_id;
  END IF;

  SELECT * INTO v_winner FROM songs WHERE id = v_first  FOR UPDATE;
  SELECT * INTO v_loser  FROM songs WHERE id = v_second FOR UPDATE;

  -- Re-align winner/loser after sorted lock
  IF p_winner_id <> v_first THEN
    DECLARE tmp songs%ROWTYPE;
    BEGIN
      tmp := v_winner; v_winner := v_loser; v_loser := tmp;
    END;
  END IF;

  -- ③ Duplicate-vote check
  IF EXISTS (
    SELECT 1 FROM votes
    WHERE  session_id             = p_session_id
      AND  LEAST(winner_id, loser_id)    = LEAST(p_winner_id, p_loser_id)
      AND  GREATEST(winner_id, loser_id) = GREATEST(p_winner_id, p_loser_id)
  ) THEN
    RAISE EXCEPTION 'Duplicate vote';
  END IF;

  -- ④ Snapshot ELOs before calculation
  v_winner_elo_snap := v_winner.elo;
  v_loser_elo_snap  := v_loser.elo;

  -- ⑤ ELO math
  v_exp_w := 1.0 / (1.0 + POWER(10, (v_loser_elo_snap - v_winner_elo_snap) / 400.0));
  v_new_w := v_winner_elo_snap + v_k * (1.0 - v_exp_w);
  v_new_l := v_loser_elo_snap  + v_k * (0.0 - (1.0 - v_exp_w));

  UPDATE songs SET elo = v_new_w, match_count = match_count + 1 WHERE id = p_winner_id;
  UPDATE songs SET elo = v_new_l, match_count = match_count + 1 WHERE id = p_loser_id;

  INSERT INTO votes (winner_id, loser_id, session_id, winner_elo_before, loser_elo_before)
  VALUES (p_winner_id, p_loser_id, p_session_id, v_winner_elo_snap, v_loser_elo_snap);

  -- ⑥ Track session (SECURITY DEFINER bypasses RLS)
  INSERT INTO sessions (session_id, first_seen, last_seen, vote_count)
  VALUES (p_session_id, NOW(), NOW(), 1)
  ON CONFLICT (session_id) DO UPDATE
    SET last_seen  = NOW(),
        vote_count = sessions.vote_count + 1;

  RETURN jsonb_build_object(
    'winner_elo', ROUND(v_new_w, 2),
    'loser_elo',  ROUND(v_new_l, 2)
  );
END;
$$;

-- ─── Manual flag helper (run via service role when you spot bad actors) ─────────
CREATE OR REPLACE FUNCTION flag_session(p_session_id TEXT)
RETURNS VOID LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE sessions SET is_flagged = TRUE WHERE session_id = p_session_id;
$$;
-- No anon grant — only callable with service role key

-- ─── Anomaly views ─────────────────────────────────────────────────────────────

-- 1. Suspicious sessions: flagged, >50 votes, or avg <3s between votes
CREATE OR REPLACE VIEW suspicious_sessions AS
SELECT
  s.session_id,
  s.vote_count,
  s.first_seen,
  s.last_seen,
  s.is_flagged,
  CASE
    WHEN s.vote_count > 1 THEN
      ROUND(
        EXTRACT(EPOCH FROM (s.last_seen - s.first_seen))
        / (s.vote_count - 1)::NUMERIC,
        2
      )
    ELSE NULL
  END AS avg_seconds_per_vote
FROM sessions s
WHERE s.is_flagged
   OR s.vote_count > 50
   OR (
        s.vote_count > 5
        AND EXTRACT(EPOCH FROM (s.last_seen - s.first_seen)) / (s.vote_count - 1) < 3
      )
ORDER BY s.vote_count DESC;

-- 2. ELO outliers: songs with unusually large ELO swings (min 10 matches)
CREATE OR REPLACE VIEW elo_outliers AS
SELECT
  id,
  title,
  artist,
  fifa_year,
  ROUND(elo, 2)         AS elo,
  match_count,
  ROUND(elo - 1500, 2)  AS elo_delta
FROM songs
WHERE match_count >= 10
  AND ABS(elo - 1500) > 200
ORDER BY ABS(elo - 1500) DESC;

-- 3. Vote concentration: songs where >30% of appearances came from one session
CREATE OR REPLACE VIEW vote_concentration AS
WITH all_appearances AS (
  SELECT winner_id AS song_id, session_id FROM votes
  UNION ALL
  SELECT loser_id  AS song_id, session_id FROM votes
),
per_session AS (
  SELECT song_id, session_id, COUNT(*) AS session_appearances
  FROM   all_appearances
  GROUP  BY song_id, session_id
)
SELECT
  s.id   AS song_id,
  s.title,
  s.artist,
  s.match_count,
  ps.session_id,
  ps.session_appearances,
  ROUND(100.0 * ps.session_appearances / s.match_count, 1) AS pct_of_appearances
FROM   songs s
JOIN   per_session ps ON ps.song_id = s.id
WHERE  s.match_count >= 20
  AND  ps.session_appearances * 100.0 / s.match_count > 30
ORDER  BY pct_of_appearances DESC;
