-- Company names are unique per account (case- and whitespace-insensitive).
ALTER TABLE "account_profiles" ADD COLUMN "company_name_key" TEXT;

-- Backfill: the earliest profile keeps the key; later duplicates stay NULL until renamed.
UPDATE "account_profiles" AS ap
SET "company_name_key" = ranked.key
FROM (
    SELECT
        id,
        key,
        ROW_NUMBER() OVER (PARTITION BY key ORDER BY created_at ASC, id ASC) AS rn
    FROM (
        SELECT
            id,
            created_at,
            lower(btrim(regexp_replace("company_name", '\s+', ' ', 'g'))) AS key
        FROM "account_profiles"
        WHERE "company_name" IS NOT NULL AND btrim("company_name") <> ''
    ) normalized
) ranked
WHERE ap.id = ranked.id AND ranked.rn = 1;

CREATE UNIQUE INDEX "account_profiles_company_name_key_key" ON "account_profiles"("company_name_key");
