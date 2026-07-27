-- AlterTable
ALTER TABLE "surveyor_profiles" ADD COLUMN IF NOT EXISTS "rating_avg" DOUBLE PRECISION;
ALTER TABLE "surveyor_profiles" ADD COLUMN IF NOT EXISTS "rating_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "surveyor_profiles" ADD COLUMN IF NOT EXISTS "bld_verified" BOOLEAN NOT NULL DEFAULT false;
