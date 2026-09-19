-- Allow first-party password-reset tokens in contact_otps.
ALTER TABLE contact_otps DROP CONSTRAINT IF EXISTS contact_otps_channel_check;
ALTER TABLE contact_otps
  ADD CONSTRAINT contact_otps_channel_check
  CHECK (channel IN ('email', 'phone', 'work_email', 'password_reset'));
