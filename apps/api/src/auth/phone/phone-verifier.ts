export const PHONE_VERIFIER = Symbol('PHONE_VERIFIER');

export interface PhoneVerifier {
  /** Send an OTP (SMS) to the given E.164 number. */
  startVerification(phone: string): Promise<void>;
  /** Returns true when the code matches the outstanding OTP for that number. */
  checkVerification(phone: string, code: string): Promise<boolean>;
}
