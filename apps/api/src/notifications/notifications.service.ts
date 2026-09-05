import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Notification, NotificationChannel } from '@surveylink/types';
import type { Notification as NotificationRow } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EMAIL_SENDER, type EmailSender } from './delivery/email-sender';
import { SMS_SENDER, type SmsSender } from './delivery/sms-sender';

interface MatchNotificationContext {
  clientUserId: string;
  surveyorUserId: string;
  projectId: string;
  matchId: string;
  projectTitle: string;
}

interface ExternalMessage {
  emailSubject: string;
  emailBody: string;
  emailHtml?: string;
  smsBody: string;
}

@Injectable()
export class NotificationsService {
  private readonly webAppUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(EMAIL_SENDER) private readonly email: EmailSender,
    @Inject(SMS_SENDER) private readonly sms: SmsSender,
  ) {
    this.webAppUrl = (config.get<string>('WEB_APP_URL') ?? 'http://localhost:3000').replace(
      /\/$/,
      '',
    );
  }

  /**
   * Fired when the admin creates a match: an in-app notification plus email and
   * SMS to both the client and the surveyor. External delivery is best-effort —
   * a dropped email/SMS is logged and never rolls back the match.
   */
  async notifyMatchCreated(ctx: MatchNotificationContext): Promise<void> {
    const clientLink = `${this.webAppUrl}/client/projects/${ctx.projectId}`;
    const surveyorLink = `${this.webAppUrl}/surveyor/requests?match=${ctx.matchId}`;

    const clientBody = `We matched a surveyor to "${ctx.projectTitle}". Open your project to review.`;
    const surveyorBody = `You've been matched to "${ctx.projectTitle}". Open the request to accept or decline.`;

    await this.createInApp(
      ctx.clientUserId,
      'match_found',
      "We've found a surveyor",
      clientBody,
      `/client/projects/${ctx.projectId}`,
    );
    await this.createInApp(
      ctx.surveyorUserId,
      'match_proposed',
      "You've been matched to a project",
      surveyorBody,
      `/surveyor/requests?match=${ctx.matchId}`,
    );

    await Promise.allSettled([
      this.dispatchExternal(ctx.clientUserId, {
        emailSubject: "We've found a surveyor for your project",
        emailBody: `${clientBody}\n\n${clientLink}`,
        emailHtml: `<p>${clientBody}</p><p><a href="${clientLink}">View your project</a></p>`,
        smsBody: `BLD: We matched a surveyor to "${ctx.projectTitle}". View: ${clientLink}`,
      }),
      this.dispatchExternal(ctx.surveyorUserId, {
        emailSubject: "You've been matched to a project on BLD",
        emailBody: `${surveyorBody}\n\n${surveyorLink}`,
        emailHtml: `<p>${surveyorBody}</p><p><a href="${surveyorLink}">Open request</a></p>`,
        smsBody: `BLD: You've been matched to "${ctx.projectTitle}". Open request: ${surveyorLink}`,
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
    linkUrl?: string,
  ): Promise<void> {
    await this.prisma.notification.create({
      data: { userId, kind, title, body, channel: 'in_app', linkUrl: linkUrl ?? null },
    });
  }

  /** Deliver a message to a user over email + SMS (best-effort, per-channel). */
  private async dispatchExternal(userId: string, msg: ExternalMessage): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, phone: true },
    });
    if (!user) return;

    const tasks: Promise<unknown>[] = [
      this.email.send({
        to: user.email,
        subject: msg.emailSubject,
        text: msg.emailBody,
        html: msg.emailHtml,
      }),
    ];
    if (user.phone?.trim()) {
      tasks.push(this.sms.send({ to: user.phone, body: msg.smsBody }));
    }
    await Promise.allSettled(tasks);
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
      linkUrl: row.linkUrl,
      channel: row.channel as NotificationChannel,
      readAt: row.readAt ? row.readAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
