-- Rotating refresh tokens (hashed) for cookie / secure-store sessions.
CREATE TABLE "auth_refresh_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "family_id" UUID NOT NULL,
    "auth_subject" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "replaced_by_id" UUID,
    "user_agent" TEXT,
    "ip" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_refresh_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "auth_refresh_tokens_token_hash_key" ON "auth_refresh_tokens"("token_hash");
CREATE INDEX "idx_auth_refresh_tokens_subject" ON "auth_refresh_tokens"("auth_subject");
CREATE INDEX "idx_auth_refresh_tokens_family" ON "auth_refresh_tokens"("family_id");
CREATE INDEX "idx_auth_refresh_tokens_expires" ON "auth_refresh_tokens"("expires_at");
