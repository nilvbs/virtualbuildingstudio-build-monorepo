-- Onboarding flow: contact OTP verification → personal profile → (surveyor) portfolio.
-- Additive only — existing rows default into the new steps based on verification flags.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS avatar_key TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_step TEXT NOT NULL DEFAULT 'verify_contact';

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_onboarding_step_check;

ALTER TABLE users
  ADD CONSTRAINT users_onboarding_step_check
  CHECK (onboarding_step IN ('verify_contact', 'complete_profile', 'portfolio', 'done'));

-- Backfill: already-verified accounts skip contact OTP; Google-style verified email → profile.
UPDATE users
SET onboarding_step = CASE
  WHEN email_verified OR phone_verified THEN 'complete_profile'
  ELSE 'verify_contact'
END
WHERE onboarding_step = 'verify_contact';

CREATE TABLE IF NOT EXISTS contact_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  destination TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT contact_otps_channel_check CHECK (channel IN ('email', 'phone'))
);

CREATE INDEX IF NOT EXISTS idx_contact_otps_user_channel
  ON contact_otps (user_id, channel);

CREATE INDEX IF NOT EXISTS idx_contact_otps_expires
  ON contact_otps (expires_at);
