import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import twilio, { type Twilio } from 'twilio';
import type { SmsMessage, SmsSender } from './sms-sender';

/**
 * Transactional SMS via Twilio Programmable Messaging. Reuses the account
 * credentials already configured for Twilio Verify, plus a sender: a Messaging
 * Service SID (preferred) or a single from-number. Falls back to a log-only
 * stub when unconfigured; delivery failures are logged, never thrown.
 */
@Injectable()
export class TwilioSmsSender implements SmsSender {
  private readonly logger = new Logger(TwilioSmsSender.name);
  private readonly accountSid?: string;
  private readonly authToken?: string;
  private readonly messagingServiceSid?: string;
  private readonly fromNumber?: string;
  private client?: Twilio;

  constructor(config: ConfigService) {
    this.accountSid = config.get<string>('TWILIO_ACCOUNT_SID');
    this.authToken = config.get<string>('TWILIO_AUTH_TOKEN');
    this.messagingServiceSid = config.get<string>('TWILIO_MESSAGING_SERVICE_SID');
    this.fromNumber = config.get<string>('TWILIO_SMS_FROM');
  }

  private get configured(): boolean {
    return Boolean(
      this.accountSid && this.authToken && (this.messagingServiceSid || this.fromNumber),
    );
  }

  private twilio(): Twilio {
    if (!this.client) {
      this.client = twilio(this.accountSid, this.authToken);
    }
    return this.client;
  }

  async send(msg: SmsMessage): Promise<void> {
    if (!this.configured) {
      this.logger.log(`[stub sms] to=${msg.to} body="${msg.body}"`);
      return;
    }
    try {
      await this.twilio().messages.create({
        to: msg.to,
        body: msg.body,
        ...(this.messagingServiceSid
          ? { messagingServiceSid: this.messagingServiceSid }
          : { from: this.fromNumber }),
      });
    } catch (err) {
      this.logger.warn(`Twilio SMS to ${msg.to} failed: ${(err as Error).message}`);
    }
  }
}
