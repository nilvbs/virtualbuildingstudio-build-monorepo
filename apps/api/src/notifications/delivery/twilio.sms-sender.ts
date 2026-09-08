import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import twilio from 'twilio';
import type { SmsMessage, SmsSender } from './sms-sender';

/** Twilio trial sample 2FA template — expands to a fixed demo code. */
export const TWILIO_TRIAL_OTP_TEMPLATE = 'sms_2fa';
/** Code embedded in Twilio's trial `sms_2fa` template (not customizable). */
export const TWILIO_TRIAL_OTP_CODE = '482913';
/** Generic trial template for non-OTP notifications (match alerts, etc.). */
export const TWILIO_TRIAL_NOTIFY_TEMPLATE = 'sms_event_notifications';

function isTrialTemplateError(err: unknown): boolean {
  const code = (err as { code?: number | string })?.code;
  return code === 572006 || code === '572006';
}

/**
 * Transactional SMS via Twilio Messaging API.
 * Requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER (E.164).
 *
 * Trial accounts reject custom bodies (error 572006). When `trialTemplate` is set,
 * we retry with that Twilio template name (e.g. sms_2fa).
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

  async send(msg: SmsMessage): Promise<{ messageId?: string; bodyUsed: string }> {
    if (!this.configured || !this.client || !this.fromNumber) {
      throw new Error(
        'Twilio SMS is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER in .env.',
      );
    }
    if (!msg.to?.trim()) {
      throw new Error('SMS destination phone number is required');
    }

    try {
      return await this.create(msg.to.trim(), msg.body);
    } catch (err) {
      const trialTemplate = msg.trialTemplate?.trim();
      if (trialTemplate && isTrialTemplateError(err)) {
        this.logger.warn(
          `Twilio trial blocked custom SMS body (572006); retrying with template "${trialTemplate}"`,
        );
        return await this.create(msg.to.trim(), trialTemplate);
      }
      throw err;
    }
  }

  private async create(to: string, body: string): Promise<{ messageId?: string; bodyUsed: string }> {
    const result = await this.client!.messages.create({
      to,
      from: this.fromNumber!,
      body,
    });
    this.logger.log(`Twilio SMS to ${to} sid=${result.sid} body=${body}`);
    return { messageId: result.sid, bodyUsed: body };
  }
}
