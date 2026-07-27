-- Run in pgAdmin connected as postgres on localhost:5433

ALTER ROLE surveylink WITH LOGIN PASSWORD 'surveylink' CREATEDB;

SELECT datname, pg_catalog.pg_get_userbyid(datdba) AS owner
FROM pg_database
WHERE datname = 'surveylink';

-- If no row above, create the DB:
-- CREATE DATABASE surveylink OWNER surveylink;

-- Ensure ownership + privileges if DB already exists:
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_database WHERE datname = 'surveylink') THEN
    EXECUTE 'ALTER DATABASE surveylink OWNER TO surveylink';
  END IF;
END $$;

GRANT ALL PRIVILEGES ON DATABASE surveylink TO surveylink;

-- Then open Query Tool on database "surveylink" and run:
-- CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- CREATE EXTENSION IF NOT EXISTS postgis;
