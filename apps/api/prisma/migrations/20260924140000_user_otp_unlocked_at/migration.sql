-- Admin can clear OTP abuse lockouts without deleting historical codes.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "otp_unlocked_at" TIMESTAMPTZ(6);
