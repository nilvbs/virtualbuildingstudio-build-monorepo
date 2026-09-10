-- Help desk tickets + threaded messages (client/surveyor ↔ admin).

CREATE TABLE IF NOT EXISTS "help_tickets" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "ticket_number" TEXT NOT NULL,
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "workspace" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "priority" TEXT NOT NULL DEFAULT 'normal',
  "subject" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'open',
  "project_id" UUID REFERENCES "projects"("id") ON DELETE SET NULL,
  "assigned_to_user_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "resolved_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "help_tickets_workspace_check" CHECK ("workspace" IN ('client', 'surveyor')),
  CONSTRAINT "help_tickets_category_check" CHECK (
    "category" IN ('account', 'billing', 'project', 'matching', 'technical', 'other')
  ),
  CONSTRAINT "help_tickets_priority_check" CHECK (
    "priority" IN ('low', 'normal', 'high', 'urgent')
  ),
  CONSTRAINT "help_tickets_status_check" CHECK (
    "status" IN ('open', 'in_progress', 'waiting', 'resolved', 'closed')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_help_tickets_ticket_number"
  ON "help_tickets" ("ticket_number");
CREATE INDEX IF NOT EXISTS "idx_help_tickets_user_id" ON "help_tickets" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_help_tickets_status" ON "help_tickets" ("status");
CREATE INDEX IF NOT EXISTS "idx_help_tickets_created_at" ON "help_tickets" ("created_at" DESC);

CREATE TABLE IF NOT EXISTS "help_ticket_messages" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "ticket_id" UUID NOT NULL REFERENCES "help_tickets"("id") ON DELETE CASCADE,
  "author_user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "body" TEXT NOT NULL,
  "is_staff" BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "help_ticket_messages_body_len_check" CHECK (char_length(trim("body")) >= 2)
);

CREATE INDEX IF NOT EXISTS "idx_help_ticket_messages_ticket_id"
  ON "help_ticket_messages" ("ticket_id", "created_at");
