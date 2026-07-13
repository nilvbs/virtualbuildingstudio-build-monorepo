import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Notification, NotificationChannel } from '@surveylink/types';
import type { Notification as NotificationRow } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EMAIL_SENDER, type EmailSender } from './delivery/email-sender';
import { SMS_SENDER, type SmsSender } from './delivery/sms-sender';

interface MatchNotificationContext {
  clientUserId: string;
  surveyorUserId: string;
  projectTitle: string;
}

interface ExternalMessage {
  emailSubject: string;
  emailBody: string;
  smsBody: string;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(EMAIL_SENDER) private readonly email: EmailSender,
    @Inject(SMS_SENDER) private readonly sms: SmsSender,
  ) {}

  /**
   * Fired when the admin creates a match: an in-app notification plus email and
   * SMS to both the client and the surveyor. External delivery is best-effort —
   * a dropped email/SMS is logged and never rolls back the match.
   */
  async notifyMatchCreated(ctx: MatchNotificationContext): Promise<void> {
    const clientBody = `We matched a surveyor to "${ctx.projectTitle}". We'll be in touch to confirm.`;
    const surveyorBody = `You've been matched to "${ctx.projectTitle}". Our team will reach out shortly.`;

    await this.createInApp(ctx.clientUserId, 'match_found', "We've found a surveyor", clientBody);
    await this.createInApp(
      ctx.surveyorUserId,
      'match_proposed',
      "You've been matched to a project",
      surveyorBody,
    );

    await Promise.allSettled([
      this.dispatchExternal(ctx.clientUserId, {
        emailSubject: "We've found a surveyor for your project",
        emailBody: clientBody,
        smsBody: `SurveyLink: ${clientBody}`,
      }),
      this.dispatchExternal(ctx.surveyorUserId, {
        emailSubject: "You've been matched to a project on SurveyLink",
        emailBody: surveyorBody,
        smsBody: `SurveyLink: ${surveyorBody}`,
      }),
    ]);
  }

  async listForUser(subject: string): Promise<Notification[]> {
    const user = await this.requireUserId(subject);
    const rows = await this.prisma.notification.findMany({
      where: { userId: user },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return rows.map((r) => this.toDto(r));
  }

  async markRead(subject: string, id: string): Promise<Notification> {
    const user = await this.requireUserId(subject);
    const existing = await this.prisma.notification.findUnique({ where: { id } });
    if (!existing || existing.userId !== user) {
      throw new NotFoundException('Notification not found');
    }
    const updated = await this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
    return this.toDto(updated);
  }

  private async createInApp(
    userId: string,
    kind: string,
    title: string,
    body: string,
  ): Promise<void> {
    await this.prisma.notification.create({
      data: { userId, kind, title, body, channel: 'in_app' },
    });
  }

  /** Deliver a message to a user over email + SMS (best-effort, per-channel). */
  private async dispatchExternal(userId: string, msg: ExternalMessage): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, phone: true },
    });
    if (!user) return;

    await Promise.allSettled([
      this.email.send({ to: user.email, subject: msg.emailSubject, text: msg.emailBody }),
      this.sms.send({ to: user.phone, body: msg.smsBody }),
    ]);
  }

  private async requireUserId(subject: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { authSubject: subject },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('No local account is linked to this identity');
    return user.id;
  }

  private toDto(row: NotificationRow): Notification {
    return {
      id: row.id,
      kind: row.kind,
      title: row.title,
      body: row.body,
      channel: row.channel as NotificationChannel,
      readAt: row.readAt ? row.readAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
