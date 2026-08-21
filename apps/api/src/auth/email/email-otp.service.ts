import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EMAIL_SENDER, type EmailSender } from '../../notifications/delivery/email-sender';

const OTP_TTL_MS = 10 * 60 * 1000;

@Injectable()
export class EmailOtpService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(EMAIL_SENDER) private readonly email: EmailSender,
  ) {}

  async start(
    userId: string,
    email: string,
    channel: 'email' | 'work_email' = 'email',
  ): Promise<void> {
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

    await this.email.send({
      to: email,
      subject: 'Your BLD verification code',
      text: `Your verification code is ${code}. It expires in 10 minutes.`,
      html: `<p>Your verification code is <strong>${code}</strong>.</p><p>It expires in 10 minutes.</p>`,
    });
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
