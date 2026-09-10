-- Image / file attachments on help-desk messages (JSON array).

ALTER TABLE "help_ticket_messages"
  ADD COLUMN IF NOT EXISTS "attachments" JSONB NOT NULL DEFAULT '[]'::jsonb;
