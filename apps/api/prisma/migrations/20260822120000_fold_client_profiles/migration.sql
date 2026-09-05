-- Fold client_profiles.company_name into account_profiles and drop the extra table.

ALTER TABLE account_profiles
  ADD COLUMN IF NOT EXISTS company_name TEXT;

INSERT INTO account_profiles (user_id, company_name)
SELECT cp.user_id, cp.company_name
FROM client_profiles cp
ON CONFLICT (user_id) DO UPDATE
SET
  company_name = COALESCE(account_profiles.company_name, EXCLUDED.company_name),
  updated_at = now();

DROP TABLE IF EXISTS client_profiles;
