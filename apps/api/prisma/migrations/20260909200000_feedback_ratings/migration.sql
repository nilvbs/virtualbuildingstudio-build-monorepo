-- Feedback & ratings: client ↔ surveyor reviews after a completed match.
-- Also stores aggregate ratings for clients on account_profiles.

ALTER TABLE "account_profiles"
  ADD COLUMN IF NOT EXISTS "rating_avg" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "rating_count" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "feedbacks" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "match_id" UUID NOT NULL REFERENCES "matches"("id") ON DELETE CASCADE,
  "project_id" UUID NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "from_user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "to_user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "from_role" TEXT NOT NULL,
  "rating" INTEGER NOT NULL,
  "comment" TEXT NOT NULL,
  "aspects" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "recommend" BOOLEAN,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "feedbacks_from_role_check" CHECK ("from_role" IN ('client', 'surveyor')),
  CONSTRAINT "feedbacks_rating_check" CHECK ("rating" >= 1 AND "rating" <= 5),
  CONSTRAINT "feedbacks_comment_len_check" CHECK (char_length(trim("comment")) >= 10)
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_feedbacks_match_from_user"
  ON "feedbacks" ("match_id", "from_user_id");

CREATE INDEX IF NOT EXISTS "idx_feedbacks_project_id" ON "feedbacks" ("project_id");
CREATE INDEX IF NOT EXISTS "idx_feedbacks_to_user_id" ON "feedbacks" ("to_user_id");
CREATE INDEX IF NOT EXISTS "idx_feedbacks_from_user_id" ON "feedbacks" ("from_user_id");
CREATE INDEX IF NOT EXISTS "idx_feedbacks_created_at" ON "feedbacks" ("created_at" DESC);
