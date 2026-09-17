export const EMAIL_SENDER = Symbol('EMAIL_SENDER');

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface EmailSender {
  /**
   * Deliver a transactional email.
   * Throws when delivery is required but not configured, or the provider rejects the send.
   */
  send(msg: EmailMessage): Promise<void>;
}
