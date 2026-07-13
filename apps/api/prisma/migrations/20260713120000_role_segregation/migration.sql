-- Role segregation: marketplace memberships + dedicated profile tables.
-- Keeps users as shared identity; client / surveyor / admin data lives apart.

CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('client', 'surveyor', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_user_roles_user_role UNIQUE (user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles (user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles (role);

CREATE TABLE IF NOT EXISTS client_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
  company_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Backfill marketplace roles from legacy role_hint.
INSERT INTO user_roles (user_id, role)
SELECT id, 'client'
FROM users
WHERE role_hint IN ('client', 'both')
ON CONFLICT ON CONSTRAINT uq_user_roles_user_role DO NOTHING;

INSERT INTO user_roles (user_id, role)
SELECT id, 'surveyor'
FROM users
WHERE role_hint IN ('surveyor', 'both')
ON CONFLICT ON CONSTRAINT uq_user_roles_user_role DO NOTHING;

INSERT INTO client_profiles (user_id)
SELECT id
FROM users
WHERE role_hint IN ('client', 'both')
ON CONFLICT (user_id) DO NOTHING;
