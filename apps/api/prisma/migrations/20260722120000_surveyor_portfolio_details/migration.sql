-- AlterTable
ALTER TABLE "surveyor_profiles" ADD COLUMN IF NOT EXISTS "details" JSONB NOT NULL DEFAULT '{}';
