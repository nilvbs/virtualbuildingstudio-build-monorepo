export const EMAIL_SENDER = Symbol('EMAIL_SENDER');

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface EmailSender {
  /** Deliver a transactional email. Never throws — failures are logged. */
  send(msg: EmailMessage): Promise<void>;
}
