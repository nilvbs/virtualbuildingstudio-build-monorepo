-- One-time fix for: ERROR: permission denied for schema public
-- (PostgreSQL 15+ no longer grants CREATE on public to every role.)
--
-- Run as a superuser against the surveylink database, e.g.:
--   sudo -u postgres psql -d surveylink -f grant-surveylink-schema.sql
--   # or if Postgres is in Docker on the host:
--   docker exec -i <postgres-container> psql -U postgres -d surveylink < grant-surveylink-schema.sql

GRANT CONNECT ON DATABASE surveylink TO surveylink;
GRANT USAGE, CREATE ON SCHEMA public TO surveylink;
ALTER SCHEMA public OWNER TO surveylink;
ALTER DATABASE surveylink OWNER TO surveylink;

-- Existing objects (if any) created by another role:
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO surveylink;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO surveylink;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO surveylink;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO surveylink;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO surveylink;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO surveylink;
