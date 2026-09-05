import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sgMail from '@sendgrid/mail';
import type { EmailMessage, EmailSender } from './email-sender';

/**
 * Transactional email via Twilio SendGrid (Mail Send API).
 * Used for email OTP verification and match notifications.
 *
 * Requires SENDGRID_API_KEY (or TWILIO_SENDGRID_API_KEY) and TWILIO_EMAIL_FROM
 * (verified sender / authenticated domain in SendGrid).
 * When unset, degrades to a log-only stub so local/CI keep working.
 * Delivery failures are logged, never thrown.
 */
@Injectable()
export class TwilioEmailSender implements EmailSender {
  private readonly logger = new Logger(TwilioEmailSender.name);
  private readonly from?: string;
  private readonly fromName: string;
  private readonly configured: boolean;

  constructor(config: ConfigService) {
    const apiKey = (
      config.get<string>('SENDGRID_API_KEY') ||
      config.get<string>('TWILIO_SENDGRID_API_KEY') ||
      ''
    ).trim();
    this.from = (
      config.get<string>('TWILIO_EMAIL_FROM') ||
      config.get<string>('SENDGRID_FROM_EMAIL') ||
      ''
    ).trim() || undefined;
    this.fromName = (
      config.get<string>('TWILIO_EMAIL_FROM_NAME') ||
      config.get<string>('SENDGRID_FROM_NAME') ||
      'BLD'
    ).trim();
    this.configured = Boolean(apiKey && this.from);
    if (this.configured && apiKey) {
      sgMail.setApiKey(apiKey);
      this.logger.log(`Twilio SendGrid email enabled (from=${this.fromName} <${this.from}>)`);
    } else {
      this.logger.warn(
        'Twilio SendGrid email disabled — set SENDGRID_API_KEY and TWILIO_EMAIL_FROM in .env, then restart the API',
      );
    }
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
      this.logger.log(`SendGrid email to ${msg.to} subject="${msg.subject}"`);
    } catch (err) {
      const detail =
        (err as { response?: { body?: unknown } })?.response?.body ??
        (err as Error).message;
      this.logger.warn(`SendGrid send to ${msg.to} failed: ${JSON.stringify(detail)}`);
    }
  }
}
