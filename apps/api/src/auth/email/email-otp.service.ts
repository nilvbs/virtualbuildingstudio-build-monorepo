import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EMAIL_SENDER, type EmailSender } from '../../notifications/delivery/email-sender';
import { buildVerifyEmail } from '../../notifications/delivery/verify-email';
import { NotificationsService } from '../../notifications/notifications.service';
import { assertOtpSendAllowed, getOtpLockoutIfActive, OTP_MAX_SENDS_PER_WINDOW } from '../otp-send-guard';

const OTP_TTL_MS = 10 * 60 * 1000;

@Injectable()
export class EmailOtpService {
  private readonly logger = new Logger(EmailOtpService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(EMAIL_SENDER) private readonly email: EmailSender,
    @Inject(forwardRef(() => NotificationsService))
    private readonly notifications: NotificationsService,
  ) {}

  async start(
    userId: string,
    email: string,
    channel: 'email' | 'work_email' = 'email',
  ): Promise<void> {
    await assertOtpSendAllowed(this.prisma, userId, channel);

    const code = String(randomInt(100_000, 1_000_000));
    const codeHash = this.hash(code);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    await this.prisma.contactOtp.updateMany({
      where: { userId, channel, consumedAt: null },
      data: { consumedAt: new Date() },
    });

    await this.prisma.contactOtp.create({
      data: {
        userId,
        channel,
        destination: email,
        codeHash,
        expiresAt,
      },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { fullName: true, firstName: true, email: true },
    });
    const content = buildVerifyEmail({
      fullName: user?.fullName || user?.firstName,
      otpCode: code,
    });

    await this.email.send({
      to: email,
      subject: content.subject,
      text: content.text,
      html: content.html,
    });

    await this.maybeAlertLockout(userId, channel, user?.fullName || user?.firstName || 'User', user?.email || email);
  }

  async check(
    userId: string,
    email: string,
    code: string,
    channel: 'email' | 'work_email' = 'email',
  ): Promise<boolean> {
    const row = await this.prisma.contactOtp.findFirst({
      where: {
        userId,
        channel,
        destination: email,
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

  private async maybeAlertLockout(
    userId: string,
    channel: 'email' | 'work_email',
    fullName: string,
    email: string,
  ): Promise<void> {
    try {
      const lock = await getOtpLockoutIfActive(this.prisma, userId, channel);
      if (!lock || lock.sendsUsed !== OTP_MAX_SENDS_PER_WINDOW) return;
      await this.notifications.notifyOtpLockout({
        userId,
        fullName,
        email,
        channel,
        unlockAt: lock.unlockAt,
        sendsUsed: lock.sendsUsed,
      });
    } catch (err) {
      this.logger.warn(
        `OTP lockout admin notify failed for ${userId}/${channel}: ${(err as Error).message}`,
      );
    }
  }

  private hash(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }

  private hashesMatch(a: string, b: string): boolean {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  }
}
