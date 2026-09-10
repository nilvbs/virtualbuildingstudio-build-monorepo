-- Immutable activity timeline for projects, matches, and help-desk tickets.
-- Powers future date-wise visibility (submitted → assigned → completed, etc.).

ALTER TABLE "matches"
  ADD COLUMN IF NOT EXISTS "proposed_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "accepted_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "declined_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "cancelled_at" TIMESTAMPTZ(6);

UPDATE "matches"
SET "proposed_at" = COALESCE("proposed_at", "created_at")
WHERE "proposed_at" IS NULL;

ALTER TABLE "help_tickets"
  ADD COLUMN IF NOT EXISTS "first_response_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "closed_at" TIMESTAMPTZ(6);

CREATE TABLE IF NOT EXISTS "activity_logs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "entity_type" TEXT NOT NULL,
  "entity_id" UUID NOT NULL,
  "project_id" UUID REFERENCES "projects"("id") ON DELETE SET NULL,
  "match_id" UUID REFERENCES "matches"("id") ON DELETE SET NULL,
  "help_ticket_id" UUID REFERENCES "help_tickets"("id") ON DELETE SET NULL,
  "action" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "actor_user_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "activity_logs_entity_type_check" CHECK (
    "entity_type" IN ('project', 'match', 'help_ticket', 'feedback')
  )
);

CREATE INDEX IF NOT EXISTS "idx_activity_logs_entity"
  ON "activity_logs" ("entity_type", "entity_id", "occurred_at");
CREATE INDEX IF NOT EXISTS "idx_activity_logs_project_id"
  ON "activity_logs" ("project_id", "occurred_at");
CREATE INDEX IF NOT EXISTS "idx_activity_logs_help_ticket_id"
  ON "activity_logs" ("help_ticket_id", "occurred_at");
CREATE INDEX IF NOT EXISTS "idx_activity_logs_occurred_at"
  ON "activity_logs" ("occurred_at" DESC);
