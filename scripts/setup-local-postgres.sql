-- SurveyLink local DB bootstrap (pgAdmin / psql as superuser "postgres").
-- Prerequisites:
--   1. Windows service postgresql-x64-18 is Running
--   2. Port 5433 is free (Docker surveylink-db must be stopped)
--   3. PostGIS for PostgreSQL 18 installed (Application Stack Builder)

-- 1) Create app role
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'surveylink') THEN
    CREATE ROLE surveylink LOGIN PASSWORD 'surveylink' CREATEDB;
  ELSE
    ALTER ROLE surveylink WITH LOGIN PASSWORD 'surveylink' CREATEDB;
  END IF;
END
$$;

-- 2) Create database (skip if it already exists — run manually in that case)
-- In pgAdmin: Databases → Create → Database → Name: surveylink, Owner: surveylink
-- Or in psql:
--   CREATE DATABASE surveylink OWNER surveylink;

-- 3) After connecting to database "surveylink", enable extensions:
--   CREATE EXTENSION IF NOT EXISTS pgcrypto;
--   CREATE EXTENSION IF NOT EXISTS postgis;

-- 4) Then from the repo root:
--   pnpm db:migrate
