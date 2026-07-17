import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { EMAIL_SENDER, type EmailSender } from '../../notifications/delivery/email-sender';
import { devAuthEnabled } from '../dev-auth';

const OTP_TTL_MS = 10 * 60 * 1000;
const DEV_OTP = '000000';

@Injectable()
export class EmailOtpService {
  private readonly logger = new Logger(EmailOtpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(EMAIL_SENDER) private readonly email: EmailSender,
  ) {}

  async start(userId: string, email: string): Promise<void> {
    const code = devAuthEnabled(this.config) ? DEV_OTP : String(randomInt(100_000, 1_000_000));
    const codeHash = this.hash(code);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    await this.prisma.contactOtp.updateMany({
      where: { userId, channel: 'email', consumedAt: null },
      data: { consumedAt: new Date() },
    });

    await this.prisma.contactOtp.create({
      data: {
        userId,
        channel: 'email',
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

    if (devAuthEnabled(this.config)) {
      this.logger.log(`[dev] email OTP for ${email}: ${code}`);
    }
  }

  async check(userId: string, email: string, code: string): Promise<boolean> {
    if (devAuthEnabled(this.config) && code === DEV_OTP) {
      return true;
    }

    const row = await this.prisma.contactOtp.findFirst({
      where: {
        userId,
        channel: 'email',
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
