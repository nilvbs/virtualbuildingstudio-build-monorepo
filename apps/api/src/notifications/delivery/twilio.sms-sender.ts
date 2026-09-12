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
 * Transactional SMS via Twilio.
 * - OTP / verify → TWILIO_FROM_NUMBER
 * - Notification SMS to registered mobiles → TWILIO_MESSAGING_SERVICE_SID
 */
@Injectable()
export class TwilioSmsSender implements SmsSender {
  private readonly logger = new Logger(TwilioSmsSender.name);
  private readonly messagingServiceSid?: string;
  private readonly fromNumber?: string;
  private client?: ReturnType<typeof twilio>;

  constructor(config: ConfigService) {
    const accountSid = config.get<string>('TWILIO_ACCOUNT_SID')?.trim();
    const authToken = config.get<string>('TWILIO_AUTH_TOKEN')?.trim();
    this.messagingServiceSid =
      config.get<string>('TWILIO_MESSAGING_SERVICE_SID')?.trim() || undefined;
    this.fromNumber = config.get<string>('TWILIO_FROM_NUMBER')?.trim() || undefined;

    if (accountSid && authToken && (this.messagingServiceSid || this.fromNumber)) {
      this.client = twilio(accountSid, authToken);
      this.logger.log(
        `Twilio SMS enabled (notify=${this.messagingServiceSid ?? 'n/a'}, otpFrom=${this.fromNumber ?? 'n/a'})`,
      );
    } else {
      this.logger.warn(
        'Twilio SMS disabled — set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, plus TWILIO_MESSAGING_SERVICE_SID (notifications) and/or TWILIO_FROM_NUMBER (OTP)',
      );
    }
  }

  async send(msg: SmsMessage): Promise<{ messageId?: string; bodyUsed: string }> {
    if (!this.client) {
      throw new Error(
        'Twilio SMS is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_MESSAGING_SERVICE_SID / TWILIO_FROM_NUMBER in .env.',
      );
    }
    if (!msg.to?.trim()) {
      throw new Error('SMS destination phone number is required');
    }

    const purpose = msg.purpose ?? (msg.trialTemplate === TWILIO_TRIAL_OTP_TEMPLATE ? 'otp' : 'notification');

    try {
      return await this.create(msg.to.trim(), msg.body, purpose);
    } catch (err) {
      const trialTemplate = msg.trialTemplate?.trim();
      if (trialTemplate && isTrialTemplateError(err)) {
        this.logger.warn(
          `Twilio trial blocked custom SMS body (572006); retrying with template "${trialTemplate}"`,
        );
        return await this.create(msg.to.trim(), trialTemplate, purpose);
      }
      throw err;
    }
  }

  private async create(
    to: string,
    body: string,
    purpose: 'otp' | 'notification',
  ): Promise<{ messageId?: string; bodyUsed: string }> {
    const payload: {
      to: string;
      body: string;
      messagingServiceSid?: string;
      from?: string;
    } = { to, body };

    if (purpose === 'notification') {
      if (!this.messagingServiceSid) {
        throw new Error(
          'Notification SMS requires TWILIO_MESSAGING_SERVICE_SID in .env (Messaging Service for registered-user alerts).',
        );
      }
      payload.messagingServiceSid = this.messagingServiceSid;
    } else {
      if (!this.fromNumber) {
        throw new Error('OTP SMS requires TWILIO_FROM_NUMBER in .env.');
      }
      payload.from = this.fromNumber;
    }

    const result = await this.client!.messages.create(payload);
    this.logger.log(`Twilio SMS (${purpose}) to ${to} sid=${result.sid}`);
    return { messageId: result.sid, bodyUsed: body };
  }
}
