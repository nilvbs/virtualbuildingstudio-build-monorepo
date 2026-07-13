import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sgMail from '@sendgrid/mail';
import type { EmailMessage, EmailSender } from './email-sender';

/**
 * Transactional email via SendGrid. If SENDGRID_API_KEY / SENDGRID_FROM_EMAIL
 * are not set (local dev, CI), it degrades to a log-only stub so the rest of the
 * flow keeps working. Delivery failures are logged, never thrown — a dropped
 * email must not roll back a match.
 */
@Injectable()
export class SendgridEmailSender implements EmailSender {
  private readonly logger = new Logger(SendgridEmailSender.name);
  private readonly from?: string;
  private readonly fromName?: string;
  private readonly configured: boolean;

  constructor(config: ConfigService) {
    const apiKey = config.get<string>('SENDGRID_API_KEY');
    this.from = config.get<string>('SENDGRID_FROM_EMAIL');
    this.fromName = config.get<string>('SENDGRID_FROM_NAME') ?? 'SurveyLink';
    this.configured = Boolean(apiKey && this.from);
    if (this.configured && apiKey) sgMail.setApiKey(apiKey);
  }

  async send(msg: EmailMessage): Promise<void> {
    if (!this.configured || !this.from) {
      this.logger.log(`[stub email] to=${msg.to} subject="${msg.subject}"`);
      return;
    }
    try {
      await sgMail.send({
        to: msg.to,
        from: { email: this.from, name: this.fromName },
        subject: msg.subject,
        text: msg.text,
        ...(msg.html ? { html: msg.html } : {}),
      });
    } catch (err) {
      this.logger.warn(`SendGrid send to ${msg.to} failed: ${(err as Error).message}`);
    }
  }
}
