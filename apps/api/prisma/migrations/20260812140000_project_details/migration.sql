-- Extended client project brief (posting wizard).
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "details" JSONB NOT NULL DEFAULT '{}';
