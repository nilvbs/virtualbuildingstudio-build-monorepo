export const PHONE_VERIFIER = Symbol('PHONE_VERIFIER');

export interface PhoneVerifier {
  /** Generate an OTP, store its hash, and send it by SMS to the E.164 number. */
  startVerification(userId: string, phone: string): Promise<{ messageId?: string }>;
  /** Returns true when the code matches the outstanding OTP for that user/number. */
  checkVerification(userId: string, phone: string, code: string): Promise<boolean>;
}
