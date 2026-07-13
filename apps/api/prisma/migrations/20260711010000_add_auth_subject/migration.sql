-- Link local users to their managed-auth identity (Auth0 in Phase 1).
-- Provider-agnostic columns so the identity provider can change without a
-- schema rewrite. Nullable to stay additive; new signups populate them.

ALTER TABLE users ADD COLUMN auth_provider TEXT;
ALTER TABLE users ADD COLUMN auth_subject  TEXT;

ALTER TABLE users
  ADD CONSTRAINT users_auth_subject_key UNIQUE (auth_subject);

CREATE INDEX idx_users_auth_subject ON users(auth_subject);
