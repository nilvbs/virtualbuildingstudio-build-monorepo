import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SMS_SENDER, type SmsSender } from '../../notifications/delivery/sms-sender';
import {
  TWILIO_TRIAL_OTP_CODE,
  TWILIO_TRIAL_OTP_TEMPLATE,
} from '../../notifications/delivery/twilio.sms-sender';
import type { PhoneVerifier } from './phone-verifier';

const OTP_TTL_MS = 10 * 60 * 1000;
const CHANNEL = 'phone';

/**
 * Phone OTP owned by the app and delivered via Twilio in every environment
 * (local included). Codes are hashed in `contact_otps`; Twilio only sends the message.
 *
 * On Twilio trial accounts, custom OTP text is rejected — we fall back to the
 * `sms_2fa` sample template and accept its fixed demo code (482913).
 */
@Injectable()
export class LocalPhoneVerifier implements PhoneVerifier {
  private readonly logger = new Logger(LocalPhoneVerifier.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(SMS_SENDER) private readonly sms: SmsSender,
  ) {}

  async startVerification(userId: string, phone: string): Promise<{ messageId?: string }> {
    const code = String(randomInt(100_000, 1_000_000));
    const codeHash = this.hash(code);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    await this.prisma.contactOtp.updateMany({
      where: { userId, channel: CHANNEL, consumedAt: null },
      data: { consumedAt: new Date() },
    });

    const otp = await this.prisma.contactOtp.create({
      data: {
        userId,
        channel: CHANNEL,
        destination: phone,
        codeHash,
        expiresAt,
      },
    });

    try {
      const sent = await this.sms.send({
        to: phone,
        body: `Your BLD verification code is ${code}. It expires in 10 minutes.`,
        trialTemplate: TWILIO_TRIAL_OTP_TEMPLATE,
      });

      if (sent.bodyUsed === TWILIO_TRIAL_OTP_TEMPLATE) {
        await this.prisma.contactOtp.update({
          where: { id: otp.id },
          data: { codeHash: this.hash(TWILIO_TRIAL_OTP_CODE) },
        });
        this.logger.warn(
          `Twilio trial SMS to ${phone}: enter the sample code ${TWILIO_TRIAL_OTP_CODE} from the message (custom OTPs need an upgraded Twilio account).`,
        );
      }

      return { messageId: sent.messageId };
    } catch (err) {
      const detail = (err as Error).message;
      this.logger.error(`Twilio OTP to ${phone} failed: ${detail}`);
      throw new ServiceUnavailableException(
        'Could not send SMS. Check TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER, and that the destination number is verified on your Twilio trial account. Upgrade Twilio to send custom OTP text.',
      );
    }
  }

  async checkVerification(userId: string, phone: string, code: string): Promise<boolean> {
    const row = await this.prisma.contactOtp.findFirst({
      where: {
        userId,
        channel: CHANNEL,
        destination: phone,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!row) return false;

    const ok = this.hashesMatch(this.hash(code), row.codeHash);
    if (!ok) return false;

    await this.prisma.contactOtp.update({
      where: { id: row.id },
      data: { consumedAt: new Date() },
    });
    return true;
  }

  private hash(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }

  private hashesMatch(a: string, b: string): boolean {
    const left = Buffer.from(a);
    const right = Buffer.from(b);
    if (left.length !== right.length) return false;
    return timingSafeEqual(left, right);
  }
}
