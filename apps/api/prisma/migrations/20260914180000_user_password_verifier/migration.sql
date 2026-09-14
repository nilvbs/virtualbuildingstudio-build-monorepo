-- Local password verifier so signup/login can issue sessions when Auth0
-- Resource Owner Password Grant (password-realm) is disabled on the app.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_verifier" TEXT;
