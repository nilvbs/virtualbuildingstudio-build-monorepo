-- Staff RBAC: super_admin vs admin + permission presets / custom grants.

ALTER TABLE admin_profiles
  ADD COLUMN IF NOT EXISTS staff_level TEXT NOT NULL DEFAULT 'admin',
  ADD COLUMN IF NOT EXISTS permission_preset TEXT NOT NULL DEFAULT 'matcher',
  ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_admin_profiles_staff_level'
  ) THEN
    ALTER TABLE admin_profiles
      ADD CONSTRAINT chk_admin_profiles_staff_level
      CHECK (staff_level IN ('super_admin', 'admin'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_admin_profiles_permission_preset'
  ) THEN
    ALTER TABLE admin_profiles
      ADD CONSTRAINT chk_admin_profiles_permission_preset
      CHECK (permission_preset IN ('viewer', 'matcher', 'full', 'custom'));
  END IF;
END $$;
