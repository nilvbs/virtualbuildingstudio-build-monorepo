-- SurveyLink Phase 1 — initial schema.
-- Implements the founding brief verbatim: PostGIS GEOGRAPHY(Point, 4326)
-- locations, JSONB flexible lists with GIN indexes, money as BIGINT cents,
-- timestamptz UTC everywhere, UUID primary keys, and CHECK-constrained status
-- columns acting as explicit state machines.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name       TEXT NOT NULL,
  email           TEXT NOT NULL UNIQUE,
  phone           TEXT NOT NULL UNIQUE,
  email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
  phone_verified  BOOLEAN NOT NULL DEFAULT FALSE,
  role_hint       TEXT NOT NULL DEFAULT 'client'
                  CHECK (role_hint IN ('client','surveyor','both')),
  status          TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','suspended')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE surveyor_profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL UNIQUE REFERENCES users(id),
  bio             TEXT,
  services        JSONB NOT NULL DEFAULT '[]',
  equipment       JSONB NOT NULL DEFAULT '[]',
  base_location   GEOGRAPHY(Point, 4326),
  base_city       TEXT,
  radius_km       INTEGER NOT NULL DEFAULT 25,
  day_rate_cents  BIGINT,
  portfolio       JSONB NOT NULL DEFAULT '[]',
  is_matchable    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_surveyor_geo      ON surveyor_profiles USING GIST (base_location);
CREATE INDEX idx_surveyor_services ON surveyor_profiles USING GIN (services);

CREATE TABLE projects (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID NOT NULL REFERENCES users(id),
  title           TEXT NOT NULL,
  services        JSONB NOT NULL DEFAULT '[]',
  location        GEOGRAPHY(Point, 4326),
  location_text   TEXT,
  building_type   TEXT,
  building_age    TEXT,
  floors          INTEGER,
  area_sqft       INTEGER,
  needed_within   TEXT,
  notes           TEXT,
  status          TEXT NOT NULL DEFAULT 'submitted'
                  CHECK (status IN ('submitted','matching','matched',
                    'confirmed','completed','cancelled')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_geo    ON projects USING GIST (location);

CREATE TABLE matches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id),
  surveyor_id     UUID NOT NULL REFERENCES surveyor_profiles(id),
  matched_by      UUID NOT NULL REFERENCES users(id),
  status          TEXT NOT NULL DEFAULT 'proposed'
                  CHECK (status IN ('proposed','accepted','declined',
                    'completed','cancelled')),
  admin_notes     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_matches_project  ON matches(project_id);
CREATE INDEX idx_matches_surveyor ON matches(surveyor_id);

CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id),
  kind        TEXT NOT NULL,
  title       TEXT NOT NULL,
  body        TEXT,
  channel     TEXT NOT NULL DEFAULT 'in_app'
              CHECK (channel IN ('in_app','email','sms')),
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notif_user ON notifications(user_id, read_at);
