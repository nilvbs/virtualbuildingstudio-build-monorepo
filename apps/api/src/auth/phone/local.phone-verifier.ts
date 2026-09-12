import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import {
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import twilio from 'twilio';
import { PrismaService } from '../../prisma/prisma.service';
import { SMS_SENDER, type SmsSender } from '../../notifications/delivery/sms-sender';
import {
  TWILIO_TRIAL_OTP_CODE,
  TWILIO_TRIAL_OTP_TEMPLATE,
} from '../../notifications/delivery/twilio.sms-sender';
import type { PhoneVerifier } from './phone-verifier';

const OTP_TTL_MS = 10 * 60 * 1000;
const CHANNEL = 'phone';
const VERIFY_MARKER = 'twilio-verify';

/**
 * Phone OTP via Twilio Verify Service (VA…) when configured.
 * Falls back to app-generated codes + SMS From number if Verify SID is missing.
 */
@Injectable()
export class LocalPhoneVerifier implements PhoneVerifier {
  private readonly logger = new Logger(LocalPhoneVerifier.name);
  private readonly verifySid?: string;
  private readonly client?: ReturnType<typeof twilio>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(SMS_SENDER) private readonly sms: SmsSender,
  ) {
    const accountSid = config.get<string>('TWILIO_ACCOUNT_SID')?.trim();
    const authToken = config.get<string>('TWILIO_AUTH_TOKEN')?.trim();
    this.verifySid = config.get<string>('TWILIO_VERIFY_SERVICE_SID')?.trim() || undefined;
    if (accountSid && authToken && this.verifySid) {
      this.client = twilio(accountSid, authToken);
      this.logger.log(`Twilio Verify OTP enabled (service=${this.verifySid})`);
    } else if (!this.verifySid) {
      this.logger.warn(
        'TWILIO_VERIFY_SERVICE_SID not set — OTP will use SMS From number fallback',
      );
    }
  }

  async startVerification(userId: string, phone: string): Promise<{ messageId?: string }> {
    if (this.client && this.verifySid) {
      return this.startTwilioVerify(userId, phone);
    }
    return this.startLocalSmsOtp(userId, phone);
  }

  async checkVerification(userId: string, phone: string, code: string): Promise<boolean> {
    if (this.client && this.verifySid) {
      return this.checkTwilioVerify(userId, phone, code);
    }
    return this.checkLocalSmsOtp(userId, phone, code);
  }

  private async startTwilioVerify(
    userId: string,
    phone: string,
  ): Promise<{ messageId?: string }> {
    await this.prisma.contactOtp.updateMany({
      where: { userId, channel: CHANNEL, consumedAt: null },
      data: { consumedAt: new Date() },
    });

    try {
      const verification = await this.client!.verify.v2
        .services(this.verifySid!)
        .verifications.create({ to: phone, channel: 'sms' });

      await this.prisma.contactOtp.create({
        data: {
          userId,
          channel: CHANNEL,
          destination: phone,
          codeHash: this.hash(`${VERIFY_MARKER}:${verification.sid}`),
          expiresAt: new Date(Date.now() + OTP_TTL_MS),
        },
      });

      this.logger.log(`Twilio Verify started for ${phone} sid=${verification.sid}`);
      return { messageId: verification.sid };
    } catch (err) {
      const detail = (err as Error).message;
      this.logger.error(`Twilio Verify start for ${phone} failed: ${detail}`);
      throw new ServiceUnavailableException(
        'Could not send verification SMS. Check TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_VERIFY_SERVICE_SID.',
      );
    }
  }

  private async checkTwilioVerify(
    userId: string,
    phone: string,
    code: string,
  ): Promise<boolean> {
    try {
      const check = await this.client!.verify.v2
        .services(this.verifySid!)
        .verificationChecks.create({ to: phone, code: code.trim() });

      if (check.status !== 'approved') return false;

      await this.prisma.contactOtp.updateMany({
        where: {
          userId,
          channel: CHANNEL,
          destination: phone,
          consumedAt: null,
        },
        data: { consumedAt: new Date() },
      });
      return true;
    } catch (err) {
      this.logger.warn(
        `Twilio Verify check for ${phone} failed: ${(err as Error).message}`,
      );
      return false;
    }
  }

  private async startLocalSmsOtp(
    userId: string,
    phone: string,
  ): Promise<{ messageId?: string }> {
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
        purpose: 'otp',
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
        'Could not send SMS. Set TWILIO_VERIFY_SERVICE_SID for Verify OTP, or TWILIO_FROM_NUMBER for SMS fallback.',
      );
    }
  }

  private async checkLocalSmsOtp(
    userId: string,
    phone: string,
    code: string,
  ): Promise<boolean> {
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
