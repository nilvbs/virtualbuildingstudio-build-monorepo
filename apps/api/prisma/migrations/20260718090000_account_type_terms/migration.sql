-- Account type (company vs individual), Terms & NDA acceptance gate, and the
-- onboarding-collected account profile (address + company details).
-- Additive only. Existing users predate the terms gate and are treated as accepted.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'individual',
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS nda_accepted_at TIMESTAMPTZ;

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_account_type_check;

ALTER TABLE users
  ADD CONSTRAINT users_account_type_check
  CHECK (account_type IN ('individual', 'company'));

-- Widen the onboarding step machine with the new leading accept_terms step.
ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_onboarding_step_check;

ALTER TABLE users
  ADD CONSTRAINT users_onboarding_step_check
  CHECK (onboarding_step IN ('accept_terms', 'verify_contact', 'complete_profile', 'portfolio', 'done'));

ALTER TABLE users
  ALTER COLUMN onboarding_step SET DEFAULT 'accept_terms';

-- Existing accounts were created before Terms/NDA acceptance existed: do not lock
-- them out — mark them accepted so only new sign-ups must pass the gate.
UPDATE users SET terms_accepted_at = now() WHERE terms_accepted_at IS NULL;
UPDATE users SET nda_accepted_at = now() WHERE nda_accepted_at IS NULL;

-- Onboarding-collected account details (address + company fields).
CREATE TABLE IF NOT EXISTS account_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT,
  work_email TEXT,
  work_email_verified BOOLEAN NOT NULL DEFAULT false,
  registration_number TEXT,
  website TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Allow work-email OTPs to reuse the contact_otps table.
ALTER TABLE contact_otps
  DROP CONSTRAINT IF EXISTS contact_otps_channel_check;

ALTER TABLE contact_otps
  ADD CONSTRAINT contact_otps_channel_check
  CHECK (channel IN ('email', 'phone', 'work_email'));
