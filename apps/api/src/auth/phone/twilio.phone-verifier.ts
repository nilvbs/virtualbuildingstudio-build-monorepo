import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import twilio, { type Twilio } from 'twilio';
import type { PhoneVerifier } from './phone-verifier';

/**
 * Phone OTP via Twilio Verify — a managed OTP service (codes, delivery, expiry,
 * and rate limiting are handled by Twilio; we never store or generate codes).
 */
@Injectable()
export class TwilioPhoneVerifier implements PhoneVerifier {
  private readonly logger = new Logger(TwilioPhoneVerifier.name);
  private client?: Twilio;

  constructor(private readonly config: ConfigService) {}

  private requireConfig(key: string): string {
    const value = this.config.get<string>(key);
    if (!value) {
      throw new ServiceUnavailableException(`Phone verification is not configured: missing ${key}`);
    }
    return value;
  }

  private get serviceSid(): string {
    return this.requireConfig('TWILIO_VERIFY_SERVICE_SID');
  }

  private twilio(): Twilio {
    if (!this.client) {
      this.client = twilio(
        this.requireConfig('TWILIO_ACCOUNT_SID'),
        this.requireConfig('TWILIO_AUTH_TOKEN'),
      );
    }
    return this.client;
  }

  async startVerification(phone: string): Promise<void> {
    await this.twilio()
      .verify.v2.services(this.serviceSid)
      .verifications.create({ to: phone, channel: 'sms' });
  }

  async checkVerification(phone: string, code: string): Promise<boolean> {
    try {
      const check = await this.twilio()
        .verify.v2.services(this.serviceSid)
        .verificationChecks.create({ to: phone, code });
      return check.status === 'approved';
    } catch (err) {
      // Twilio 404s once a verification is consumed/expired — treat as failure.
      this.logger.warn(`Phone verification check failed: ${(err as Error).message}`);
      return false;
    }
  }
}
