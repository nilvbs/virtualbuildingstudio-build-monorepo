-- Track explicit individual/company choice on the first onboarding screen.
-- Only finished users are treated as already selected; in-progress users must pick.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS account_type_selected_at TIMESTAMPTZ;

UPDATE users
SET account_type_selected_at = COALESCE(account_type_selected_at, now())
WHERE account_type_selected_at IS NULL
  AND onboarding_step = 'done';
