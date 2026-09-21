-- Staff invite: portal access link (3-day TTL, Mon–Fri redeem) + encrypted temp password.
ALTER TABLE "admin_profiles"
  ADD COLUMN IF NOT EXISTS "invite_token" TEXT,
  ADD COLUMN IF NOT EXISTS "invite_expires_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "invite_accepted_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "invite_password_enc" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "admin_profiles_invite_token_key"
  ON "admin_profiles"("invite_token");
