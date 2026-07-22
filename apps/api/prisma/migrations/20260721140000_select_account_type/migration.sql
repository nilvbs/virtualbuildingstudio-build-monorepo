-- First onboarding glance: choose individual vs company before Terms/NDA.
-- Additive only. Existing in-progress users keep their current step.

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_onboarding_step_check;

ALTER TABLE users
  ADD CONSTRAINT users_onboarding_step_check
  CHECK (onboarding_step IN (
    'select_account_type',
    'accept_terms',
    'verify_contact',
    'complete_profile',
    'portfolio',
    'done'
  ));

ALTER TABLE users
  ALTER COLUMN onboarding_step SET DEFAULT 'select_account_type';
