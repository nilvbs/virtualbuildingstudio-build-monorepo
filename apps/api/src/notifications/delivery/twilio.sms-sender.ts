import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import twilio from 'twilio';
import type { SmsMessage, SmsSender } from './sms-sender';

/**
 * Transactional SMS via Twilio Messaging API.
 * Requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER (E.164).
 */
@Injectable()
export class TwilioSmsSender implements SmsSender {
  private readonly logger = new Logger(TwilioSmsSender.name);
  private readonly configured: boolean;
  private readonly fromNumber?: string;
  private client?: ReturnType<typeof twilio>;

  constructor(config: ConfigService) {
    const accountSid = config.get<string>('TWILIO_ACCOUNT_SID')?.trim();
    const authToken = config.get<string>('TWILIO_AUTH_TOKEN')?.trim();
    this.fromNumber = config.get<string>('TWILIO_FROM_NUMBER')?.trim() || undefined;
    this.configured = Boolean(accountSid && authToken && this.fromNumber);
    if (this.configured && accountSid && authToken) {
      this.client = twilio(accountSid, authToken);
      this.logger.log(`Twilio SMS enabled (from=${this.fromNumber})`);
    } else {
      this.logger.warn(
        'Twilio SMS disabled — set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER in .env, then restart the API',
      );
    }
  }

  async send(msg: SmsMessage): Promise<{ messageId?: string }> {
    if (!this.configured || !this.client || !this.fromNumber) {
      throw new Error(
        'Twilio SMS is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER in .env.',
      );
    }
    if (!msg.to?.trim()) {
      throw new Error('SMS destination phone number is required');
    }

    const result = await this.client.messages.create({
      to: msg.to.trim(),
      from: this.fromNumber,
      body: msg.body,
    });
    this.logger.log(`Twilio SMS to ${msg.to} sid=${result.sid}`);
    return { messageId: result.sid };
  }
}
