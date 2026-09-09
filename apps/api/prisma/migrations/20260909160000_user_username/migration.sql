-- Unique public handle derived from first + last name.
-- Real names stay on the user row for self + admin; marketplace peers see username only.

ALTER TABLE users
  ADD COLUMN first_name TEXT,
  ADD COLUMN last_name TEXT,
  ADD COLUMN username TEXT;

-- Backfill from existing full_name.
UPDATE users
SET
  first_name = COALESCE(
    NULLIF(trim(split_part(full_name, ' ', 1)), ''),
    'User'
  ),
  last_name = CASE
    WHEN position(' ' IN trim(full_name)) > 0
      THEN trim(substr(trim(full_name), position(' ' IN trim(full_name)) + 1))
    ELSE ''
  END;

-- Provisional usernames from first.last (lowercase alphanumerics).
UPDATE users
SET username = lower(
  regexp_replace(
    regexp_replace(first_name, '[^A-Za-z0-9]+', '', 'g')
      || CASE
           WHEN coalesce(nullif(regexp_replace(last_name, '[^A-Za-z0-9]+', '', 'g'), ''), '') = ''
             THEN ''
           ELSE '.' || regexp_replace(last_name, '[^A-Za-z0-9]+', '', 'g')
         END,
    '\.+',
    '.',
    'g'
  )
);

UPDATE users SET username = 'user' || substr(replace(id::text, '-', ''), 1, 8)
WHERE username IS NULL OR username = '' OR username = '.';

-- Resolve collisions with a stable id suffix (unique across all rows).
WITH ranked AS (
  SELECT
    id,
    username,
    row_number() OVER (PARTITION BY username ORDER BY created_at, id) AS rn
  FROM users
)
UPDATE users u
SET username = left(ranked.username, 40) || '_' || substr(replace(u.id::text, '-', ''), 1, 6)
FROM ranked
WHERE u.id = ranked.id AND ranked.rn > 1;

ALTER TABLE users
  ALTER COLUMN first_name SET NOT NULL,
  ALTER COLUMN last_name SET NOT NULL,
  ALTER COLUMN username SET NOT NULL;

CREATE UNIQUE INDEX uq_users_username ON users (username);
