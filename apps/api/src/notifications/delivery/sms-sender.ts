export const SMS_SENDER = Symbol('SMS_SENDER');

export interface SmsMessage {
  /** Destination in E.164 format. */
  to: string;
  body: string;
}

export interface SmsSender {
  /** Deliver a transactional SMS. Never throws — failures are logged. */
  send(msg: SmsMessage): Promise<void>;
}
