export const SMS_SENDER = Symbol('SMS_SENDER');

export interface SmsMessage {
  /** Destination in E.164 format. */
  to: string;
  body: string;
  /**
   * Twilio trial accounts reject custom bodies (error 572006).
   * When set, the sender retries with this template name (e.g. sms_2fa).
   */
  trialTemplate?: string;
}

export interface SmsSendResult {
  messageId?: string;
  /** Actual `body` param accepted by Twilio (custom text or trial template name). */
  bodyUsed: string;
}

export interface SmsSender {
  /** Deliver a transactional SMS. Throws on Publish failure. */
  send(msg: SmsMessage): Promise<SmsSendResult>;
}
