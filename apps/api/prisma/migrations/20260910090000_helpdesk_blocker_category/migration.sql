-- Allow blocker tickets (urgent issues that stop client/surveyor progress).

ALTER TABLE "help_tickets" DROP CONSTRAINT IF EXISTS "help_tickets_category_check";

ALTER TABLE "help_tickets"
  ADD CONSTRAINT "help_tickets_category_check" CHECK (
    "category" IN (
      'blocker',
      'account',
      'billing',
      'project',
      'matching',
      'technical',
      'other'
    )
  );
