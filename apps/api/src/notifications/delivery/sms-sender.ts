export const SMS_SENDER = Symbol('SMS_SENDER');

export interface SmsMessage {
  /** Destination in E.164 format. */
  to: string;
  body: string;
}

export interface SmsSender {
  /** Deliver a transactional SMS. Throws on Publish failure. */
  send(msg: SmsMessage): Promise<{ messageId?: string }>;
}
