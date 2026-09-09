-- Auto-match offers: working-hours response deadline + source.

ALTER TABLE matches
  ADD COLUMN expires_at TIMESTAMPTZ(6),
  ADD COLUMN offer_source TEXT NOT NULL DEFAULT 'admin';

ALTER TABLE matches
  ADD CONSTRAINT matches_offer_source_check
  CHECK (offer_source IN ('admin', 'auto'));

CREATE INDEX idx_matches_expires_at ON matches (expires_at)
  WHERE status = 'proposed' AND expires_at IS NOT NULL;
