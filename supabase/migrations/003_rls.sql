-- Migration 003: Row Level Security
-- Songs are read-only from the client.
-- Votes can be inserted by anyone (anon); ELO is updated only inside the
-- SECURITY DEFINER record_vote() function — clients cannot touch elo directly.

ALTER TABLE songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

-- Songs: public read, no client writes
CREATE POLICY "songs_select_all"
  ON songs FOR SELECT
  TO anon
  USING (TRUE);

-- Votes: anon users may insert
CREATE POLICY "votes_insert_anon"
  ON votes FOR INSERT
  TO anon
  WITH CHECK (TRUE);

-- Votes: anon users may read (needed for session-pair dedup in get_pair)
CREATE POLICY "votes_select_anon"
  ON votes FOR SELECT
  TO anon
  USING (TRUE);
