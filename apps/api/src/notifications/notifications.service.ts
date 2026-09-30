import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Notification, NotificationChannel } from '@surveylink/types';
import type { Notification as NotificationRow } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EMAIL_SENDER, type EmailSender } from './delivery/email-sender';
import { SMS_SENDER, type SmsSender } from './delivery/sms-sender';
import { TWILIO_TRIAL_NOTIFY_TEMPLATE } from './delivery/twilio.sms-sender';
import { buildStaffInviteEmail } from './delivery/staff-invite-email';
import {
  buildNotificationEmail,
  type NotificationEmailInput,
} from './delivery/notification-email';

const OPS_FOOTER = 'You’re receiving this because you’re on the BLD operations notification list.';

interface MatchNotificationContext {
  clientUserId: string;
  surveyorUserId: string;
  projectId: string;
  matchId: string;
  projectTitle: string;
}

interface ExternalMessage {
  /** Recipient name is filled in by `dispatchExternal`. */
  email: Omit<NotificationEmailInput, 'fullName'>;
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
        email: {
          subject: "We've found a surveyor for your project",
          icon: '&#129309;',
          badge: 'Match found',
          heading: "We've found your surveyor",
          intro: 'A vetted surveyor has been matched to your project.',
          paragraphs: [
            `We matched a surveyor to "${ctx.projectTitle}". Open your project to review the match and next steps.`,
          ],
          details: [{ label: 'Project', value: ctx.projectTitle }],
          cta: { label: 'View your project', url: clientLink },
          note: "We'll keep you posted here and in your BLD dashboard as the surveyor responds.",
        },
        smsBody: `BLD: We matched a surveyor to "${ctx.projectTitle}". View: ${clientLink}`,
      }),
      this.dispatchExternal(ctx.surveyorUserId, {
        email: {
          subject: "You've been matched to a project on BLD",
          icon: '&#128205;',
          badge: 'New match',
          heading: "You've been matched to a project",
          intro: 'A client project fits your services and coverage area.',
          paragraphs: [
            `You've been matched to "${ctx.projectTitle}". Open the request to review the brief, then accept or decline.`,
          ],
          details: [{ label: 'Project', value: ctx.projectTitle }],
          cta: { label: 'Open request', url: surveyorLink },
          note: 'Quick responses help you win more work on BLD.',
        },
        smsBody: `BLD: You've been matched to "${ctx.projectTitle}". Open request: ${surveyorLink}`,
      }),
    ]);
  }

  /** Client: auto-match fan-out started after they posted a project. */
  async notifyMatchingStarted(ctx: {
    clientUserId: string;
    projectId: string;
    projectTitle: string;
    offerCount: number;
    /** When rematching later, avoid repeating the “searching” notice. */
    reason?: 'initial' | 'rematch';
  }): Promise<void> {
    const reason = ctx.reason ?? 'initial';
    // Rematches with zero new offers: stay quiet (client already knows we're searching).
    if (reason === 'rematch' && ctx.offerCount <= 0) return;

    const title =
      ctx.offerCount > 0
        ? 'Finding your best surveyor match'
        : "We're finding the best surveyor for you";
    const body =
      ctx.offerCount > 0
        ? `We're matching "${ctx.projectTitle}" with strong nearby surveyors. ${ctx.offerCount} ${ctx.offerCount === 1 ? 'has' : 'have'} been notified and can respond shortly.`
        : `Thanks for posting "${ctx.projectTitle}". We're finding the best surveyor match for your brief and will update you as soon as there's a strong fit.`;

    await this.createInApp(
      ctx.clientUserId,
      'matching_started',
      title,
      body,
      `/client/projects/${ctx.projectId}`,
    );
  }

  /** Ops: client posted a project that needs matching. */
  async notifyProjectPosted(ctx: {
    projectId: string;
    projectTitle: string;
    clientName: string;
    services: string[];
  }): Promise<void> {
    const adminLink = `${this.webAppUrl}/build/admin/projects/${ctx.projectId}`;
    const serviceBit =
      ctx.services.length > 0 ? ` · ${ctx.services.slice(0, 3).join(', ')}` : '';
    const body = `${ctx.clientName} posted "${ctx.projectTitle}"${serviceBit}. Pending match in the pipeline.`;

    const admins = await this.prisma.user.findMany({
      where: { roles: { some: { role: 'admin' } }, status: 'active' },
      select: { id: true },
      take: 40,
    });
    await Promise.allSettled(
      admins.map((admin) =>
        this.createInApp(
          admin.id,
          'project_posted',
          'New project posted',
          body,
          `/build/admin/pipeline`,
        ),
      ),
    );

    const notifyEmail =
      this.config.get<string>('ADMIN_NOTIFY_EMAIL')?.trim() ||
      this.config.get<string>('SUPER_ADMIN_EMAIL')?.trim();
    if (notifyEmail) {
      await Promise.allSettled([
        this.sendOps(notifyEmail, {
          subject: `BLD · New project: ${ctx.projectTitle}`,
          icon: '&#128221;',
          badge: 'Pipeline',
          heading: 'New project posted',
          intro: 'A client posted a project that needs matching.',
          paragraphs: [body],
          details: [
            { label: 'Project', value: ctx.projectTitle },
            { label: 'Client', value: ctx.clientName },
            { label: 'Services', value: ctx.services.join(', ') },
          ],
          cta: { label: 'Open project', url: adminLink },
        }),
      ]);
    }
  }

  /** Ops: a surveyor finished joining / became available for matching. */
  async notifySurveyorJoined(ctx: {
    profileId: string;
    fullName: string;
    baseCity?: string | null;
  }): Promise<void> {
    const adminLink = `${this.webAppUrl}/build/admin/surveyors/${ctx.profileId}`;
    const place = ctx.baseCity?.trim() ? ` (${ctx.baseCity.trim()})` : '';
    const body = `${ctx.fullName}${place} joined BLD and can be matched to open projects.`;

    const admins = await this.prisma.user.findMany({
      where: { roles: { some: { role: 'admin' } }, status: 'active' },
      select: { id: true },
      take: 40,
    });
    await Promise.allSettled(
      admins.map((admin) =>
        this.createInApp(
          admin.id,
          'surveyor_joined',
          'New surveyor added',
          body,
          `/build/admin/surveyors/${ctx.profileId}`,
        ),
      ),
    );

    const notifyEmail =
      this.config.get<string>('ADMIN_NOTIFY_EMAIL')?.trim() ||
      this.config.get<string>('SUPER_ADMIN_EMAIL')?.trim();
    if (notifyEmail) {
      await Promise.allSettled([
        this.sendOps(notifyEmail, {
          subject: `BLD · New surveyor: ${ctx.fullName}`,
          icon: '&#128100;',
          badge: 'Surveyor network',
          heading: 'New surveyor added',
          intro: 'A surveyor joined and can be matched to open projects.',
          paragraphs: [body],
          details: [
            { label: 'Surveyor', value: ctx.fullName },
            { label: 'Base city', value: ctx.baseCity?.trim() ?? '' },
          ],
          cta: { label: 'Open surveyor', url: adminLink },
        }),
      ]);
    }
  }

  /** Surveyor: Uber-style ringing offer with working-hours deadline. */
  async notifyMatchOffer(ctx: MatchNotificationContext & { responseWorkingHours: number }): Promise<void> {
    const surveyorLink = `${this.webAppUrl}/surveyor/requests?match=${ctx.matchId}`;
    const hours = ctx.responseWorkingHours;
    const surveyorBody = `New job request for "${ctx.projectTitle}". You have ${hours} working hour${hours === 1 ? '' : 's'} to accept (timer pauses outside Mon–Fri business hours).`;

    await this.createInApp(
      ctx.surveyorUserId,
      'match_offer',
      'New survey request',
      surveyorBody,
      `/surveyor/requests?match=${ctx.matchId}`,
    );

    await Promise.allSettled([
      this.dispatchExternal(ctx.surveyorUserId, {
        email: {
          subject: `New survey request: ${ctx.projectTitle}`,
          icon: '&#128276;',
          badge: 'New request',
          heading: 'New survey request',
          intro: 'A client project near you needs a surveyor.',
          paragraphs: [
            `You've got a new job request for "${ctx.projectTitle}". Open the request to review the brief and accept it before the timer runs out.`,
          ],
          details: [
            { label: 'Project', value: ctx.projectTitle },
            { label: 'Time to respond', value: `${hours} working hour${hours === 1 ? '' : 's'}` },
          ],
          cta: { label: 'Open request', url: surveyorLink },
          note: 'The response timer pauses outside Mon–Fri business hours.',
        },
        smsBody: `BLD: New request for "${ctx.projectTitle}". Respond within ${hours} working hours: ${surveyorLink}`,
      }),
    ]);
  }

  /** Client: a surveyor accepted an auto/admin offer. */
  async notifyMatchAccepted(ctx: MatchNotificationContext): Promise<void> {
    const clientLink = `${this.webAppUrl}/client/projects/${ctx.projectId}`;
    const body = `A surveyor accepted "${ctx.projectTitle}". Open the project for next steps.`;
    await this.createInApp(
      ctx.clientUserId,
      'match_accepted',
      'Surveyor accepted',
      body,
      `/client/projects/${ctx.projectId}`,
    );
    await Promise.allSettled([
      this.dispatchExternal(ctx.clientUserId, {
        email: {
          subject: 'A surveyor accepted your project',
          icon: '&#9989;',
          badge: 'Accepted',
          heading: 'A surveyor accepted your project',
          intro: 'Good news: your project is moving forward.',
          paragraphs: [
            `A surveyor accepted "${ctx.projectTitle}". Open the project to see who's on it and what happens next.`,
          ],
          details: [{ label: 'Project', value: ctx.projectTitle }],
          cta: { label: 'View project', url: clientLink },
        },
        smsBody: `BLD: A surveyor accepted "${ctx.projectTitle}". View: ${clientLink}`,
      }),
    ]);
  }

  /**
   * After feedback is submitted: confirmation email to the reviewer,
   * in-app notice, and ops email to ADMIN_NOTIFY_EMAIL (plus staff in-app).
   */
  async notifyFeedbackSubmitted(ctx: {
    feedbackId: string;
    fromUserId: string;
    fromRole: 'client' | 'surveyor';
    toUserId: string;
    projectId: string;
    projectTitle: string;
    rating: number;
    comment: string;
  }): Promise<void> {
    const stars = `${ctx.rating}/5`;
    const reviewerLink =
      ctx.fromRole === 'client'
        ? `${this.webAppUrl}/client/projects/${ctx.projectId}`
        : `${this.webAppUrl}/surveyor/matches`;
    const adminLink = `${this.webAppUrl}/build/admin/feedback`;

    const confirmBody = `Thanks for rating BLD on "${ctx.projectTitle}" (${stars}). Your product feedback helps us improve matching, tools, and support.`;
    await this.createInApp(
      ctx.fromUserId,
      'feedback_submitted',
      'Thanks for your product feedback',
      confirmBody,
      ctx.fromRole === 'client'
        ? `/client/projects/${ctx.projectId}`
        : '/surveyor/matches',
    );

    await Promise.allSettled([
      this.dispatchExternal(ctx.fromUserId, {
        email: {
          subject: `Thanks for your BLD feedback on "${ctx.projectTitle}"`,
          icon: '&#11088;',
          badge: 'Thank you',
          heading: 'Thanks for your feedback',
          intro: 'Your rating helps us improve BLD for everyone.',
          paragraphs: [confirmBody],
          details: [
            { label: 'Project', value: ctx.projectTitle },
            { label: 'Your rating', value: stars },
          ],
          cta: { label: 'Open BLD', url: reviewerLink },
        },
        smsBody: `BLD: Thanks for your ${stars} product feedback on "${ctx.projectTitle}".`,
      }),
    ]);

    const notifyEmail =
      this.config.get<string>('ADMIN_NOTIFY_EMAIL')?.trim() ||
      this.config.get<string>('SUPER_ADMIN_EMAIL')?.trim();

    const admins = await this.prisma.user.findMany({
      where: { roles: { some: { role: 'admin' } }, status: 'active' },
      select: { id: true, email: true },
      take: 40,
    });

    await Promise.allSettled(
      admins.map((admin) =>
        this.createInApp(
          admin.id,
          'feedback_received',
          'New product feedback',
          `A ${ctx.fromRole} rated BLD on "${ctx.projectTitle}" ${stars}.`,
          '/build/admin/feedback',
        ),
      ),
    );

    if (notifyEmail) {
      await Promise.allSettled([
        this.sendOps(notifyEmail, {
          subject: `BLD product feedback: ${stars} on "${ctx.projectTitle}"`,
          icon: '&#11088;',
          badge: 'Feedback',
          heading: 'New product feedback',
          intro: `A ${ctx.fromRole} rated BLD ${stars}.`,
          paragraphs: [`New ${ctx.fromRole} product feedback on "${ctx.projectTitle}".`],
          details: [
            { label: 'From', value: ctx.fromRole },
            { label: 'Project', value: ctx.projectTitle },
            { label: 'Rating', value: stars },
          ],
          quote: ctx.comment,
          cta: { label: 'Open feedback in admin', url: adminLink },
        }),
      ]);
    }
  }

  /** Public landing-page feedback — email ops + in-app for staff. */
  async notifySiteFeedback(ctx: {
    feedbackId: string;
    name: string | null;
    email: string | null;
    rating: number;
    message: string;
    source: string;
  }): Promise<void> {
    const stars = `${ctx.rating}/5`;
    const adminLink = `${this.webAppUrl}/build/admin/feedback`;
    const who = ctx.name?.trim() || ctx.email?.trim() || 'Anonymous visitor';
    const contact = ctx.email?.trim() ? ` (${ctx.email.trim()})` : '';
    const admins = await this.prisma.user.findMany({
      where: { roles: { some: { role: 'admin' } }, status: 'active' },
      select: { id: true },
      take: 40,
    });

    await Promise.allSettled(
      admins.map((admin) =>
        this.createInApp(
          admin.id,
          'feedback_received',
          'New landing feedback',
          `${who} rated BLD ${stars} from the ${ctx.source} page.`,
          '/build/admin/feedback',
        ),
      ),
    );

    const notifyEmail =
      this.config.get<string>('ADMIN_NOTIFY_EMAIL')?.trim() ||
      this.config.get<string>('SUPER_ADMIN_EMAIL')?.trim();

    if (notifyEmail) {
      await Promise.allSettled([
        this.sendOps(notifyEmail, {
          subject: `BLD landing feedback: ${stars}`,
          icon: '&#11088;',
          badge: 'Feedback',
          heading: 'New landing feedback',
          intro: `${who} rated BLD ${stars}.`,
          paragraphs: [`${who}${contact} left ${stars} feedback from the ${ctx.source} page.`],
          details: [
            { label: 'From', value: who },
            { label: 'Email', value: ctx.email?.trim() ?? '' },
            { label: 'Source', value: ctx.source },
            { label: 'Rating', value: stars },
          ],
          quote: ctx.message,
          cta: { label: 'Open feedback in admin', url: adminLink },
        }),
      ]);
    }

    if (ctx.email?.trim()) {
      const content = buildNotificationEmail({
        subject: 'Thanks for your BLD feedback',
        icon: '&#11088;',
        badge: 'Thank you',
        heading: 'Thanks for your feedback',
        intro: 'Your note helps us improve BLD for everyone.',
        fullName: ctx.name,
        paragraphs: [
          `Thanks for rating BLD ${stars}. Your note helps us improve matching, tools, and support.`,
        ],
        details: [{ label: 'Your rating', value: stars }],
        cta: { label: 'Visit BLD', url: this.webAppUrl },
        footerReason: 'You’re receiving this because you left feedback on the BLD website.',
      });
      await Promise.allSettled([
        this.email.send({
          to: ctx.email.trim(),
          subject: content.subject,
          text: content.text,
          html: content.html,
        }),
      ]);
    }
  }

  /** New help-desk ticket: confirm submitter + alert ops. */
  async notifyHelpTicketCreated(ctx: {
    ticketId: string;
    ticketNumber: string;
    fromUserId: string;
    workspace: 'client' | 'surveyor';
    subject: string;
    category: string;
    priority: string;
    preview: string;
  }): Promise<void> {
    const userLink =
      ctx.workspace === 'client'
        ? `${this.webAppUrl}/client/help`
        : `${this.webAppUrl}/surveyor/help`;
    const adminLink = `${this.webAppUrl}/build/admin/helpdesk/${ctx.ticketId}`;
    const confirm = `We received ticket ${ctx.ticketNumber}: "${ctx.subject}". Our team will reply soon.`;

    await this.createInApp(
      ctx.fromUserId,
      'helpdesk_ticket_created',
      `Ticket ${ctx.ticketNumber} opened`,
      confirm,
      ctx.workspace === 'client' ? '/client/help' : '/surveyor/help',
    );

    await Promise.allSettled([
      this.dispatchExternal(ctx.fromUserId, {
        email: {
          subject: `BLD Help Desk · ${ctx.ticketNumber}`,
          icon: '&#127915;',
          badge: 'Ticket received',
          heading: `Ticket ${ctx.ticketNumber} received`,
          intro: 'Our support team has your request.',
          paragraphs: [confirm],
          details: [
            { label: 'Ticket', value: ctx.ticketNumber },
            { label: 'Subject', value: ctx.subject },
          ],
          cta: { label: 'View your tickets', url: userLink },
        },
        smsBody: `BLD: Ticket ${ctx.ticketNumber} received. We'll reply soon.`,
      }),
    ]);

    const admins = await this.prisma.user.findMany({
      where: { roles: { some: { role: 'admin' } }, status: 'active' },
      select: { id: true },
      take: 40,
    });
    await Promise.allSettled(
      admins.map((admin) =>
        this.createInApp(
          admin.id,
          'helpdesk_ticket_received',
          `New help desk ticket ${ctx.ticketNumber}`,
          `${ctx.workspace} · ${ctx.priority} · ${ctx.subject}`,
          `/build/admin/helpdesk/${ctx.ticketId}`,
        ),
      ),
    );

    const notifyEmail =
      this.config.get<string>('ADMIN_NOTIFY_EMAIL')?.trim() ||
      this.config.get<string>('SUPER_ADMIN_EMAIL')?.trim();
    if (notifyEmail) {
      await Promise.allSettled([
        this.sendOps(notifyEmail, {
          subject: `BLD Help Desk ${ctx.ticketNumber}: ${ctx.subject}`,
          icon: '&#127915;',
          badge: 'Help desk',
          heading: `New ticket ${ctx.ticketNumber}`,
          intro: `A ${ctx.workspace} opened a ${ctx.priority} priority ticket.`,
          paragraphs: [`"${ctx.subject}"`],
          details: [
            { label: 'Ticket', value: ctx.ticketNumber },
            { label: 'Workspace', value: ctx.workspace },
            { label: 'Category', value: ctx.category },
            { label: 'Priority', value: ctx.priority },
          ],
          quote: ctx.preview,
          cta: { label: 'Open in help desk', url: adminLink },
        }),
      ]);
    }
  }

  /**
   * OTP abuse lockout: staff in-app + ADMIN_NOTIFY_EMAIL with link to unlock the user.
   */
  async notifyOtpLockout(ctx: {
    userId: string;
    fullName: string;
    email: string;
    channel: 'email' | 'work_email' | 'phone';
    unlockAt: Date;
    sendsUsed: number;
  }): Promise<void> {
    const channelLabel =
      ctx.channel === 'work_email'
        ? 'work email'
        : ctx.channel === 'phone'
          ? 'phone'
          : 'email';
    const adminPath = `/build/admin/users/${ctx.userId}`;
    const adminLink = `${this.webAppUrl}${adminPath}`;
    const unlockLocal = ctx.unlockAt.toLocaleString();
    const title = `OTP lockout · ${ctx.fullName}`;
    const body = `${ctx.fullName} (${ctx.email}) hit the ${channelLabel} verification limit (${ctx.sendsUsed} codes). Locked until ${unlockLocal}.`;

    const admins = await this.prisma.user.findMany({
      where: { roles: { some: { role: 'admin' } }, status: 'active' },
      select: { id: true },
      take: 40,
    });
    await Promise.allSettled(
      admins.map((admin) =>
        this.createInApp(admin.id, 'otp_lockout', title, body, adminPath),
      ),
    );

    const notifyEmail =
      this.config.get<string>('ADMIN_NOTIFY_EMAIL')?.trim() ||
      this.config.get<string>('SUPER_ADMIN_EMAIL')?.trim();
    if (notifyEmail) {
      await Promise.allSettled([
        this.sendOps(notifyEmail, {
          subject: `BLD OTP lockout: ${ctx.fullName} (${channelLabel})`,
          icon: '&#128274;',
          badge: 'Security',
          heading: 'OTP lockout',
          intro: `${ctx.fullName} hit the ${channelLabel} verification limit.`,
          paragraphs: [body],
          details: [
            { label: 'User', value: ctx.fullName },
            { label: 'Email', value: ctx.email },
            { label: 'Channel', value: channelLabel },
            { label: 'Codes sent', value: String(ctx.sendsUsed) },
            { label: 'Locked until', value: unlockLocal },
          ],
          cta: { label: 'Open user · clear OTP lockout', url: adminLink },
        }),
      ]);
    }
  }

  /** Reply on a ticket — notify the other side. */
  async notifyHelpTicketReply(ctx: {
    ticketId: string;
    ticketNumber: string;
    fromUserId: string;
    isStaff: boolean;
    subject: string;
    preview: string;
    ownerUserId: string;
    ownerWorkspace: 'client' | 'surveyor';
  }): Promise<void> {
    if (ctx.isStaff) {
      const path = ctx.ownerWorkspace === 'client' ? '/client/help' : '/surveyor/help';
      const body = `Support replied on ${ctx.ticketNumber}: "${ctx.subject}".`;
      await this.createInApp(
        ctx.ownerUserId,
        'helpdesk_reply',
        `Reply on ${ctx.ticketNumber}`,
        body,
        path,
      );
      await Promise.allSettled([
        this.dispatchExternal(ctx.ownerUserId, {
          email: {
            subject: `BLD Help Desk reply · ${ctx.ticketNumber}`,
            icon: '&#128172;',
            badge: 'Support reply',
            heading: 'Support replied to your ticket',
            intro: `There's a new reply on ${ctx.ticketNumber}.`,
            paragraphs: [body],
            details: [
              { label: 'Ticket', value: ctx.ticketNumber },
              { label: 'Subject', value: ctx.subject },
            ],
            quote: ctx.preview,
            cta: { label: 'Open ticket', url: `${this.webAppUrl}${path}` },
          },
          smsBody: `BLD: Support replied on ${ctx.ticketNumber}.`,
        }),
      ]);
      return;
    }

    const admins = await this.prisma.user.findMany({
      where: { roles: { some: { role: 'admin' } }, status: 'active' },
      select: { id: true },
      take: 40,
    });
    await Promise.allSettled(
      admins.map((admin) =>
        this.createInApp(
          admin.id,
          'helpdesk_reply',
          `User replied on ${ctx.ticketNumber}`,
          ctx.preview.slice(0, 120),
          `/build/admin/helpdesk/${ctx.ticketId}`,
        ),
      ),
    );
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

  /** Ops: new staff admin invited — email (Access portal CTA), SMS, in-app. */
  async notifyStaffInvite(ctx: {
    userId: string;
    fullName: string;
    email: string;
    inviteToken: string;
  }): Promise<void> {
    const portalUrl = `${this.webAppUrl}/build/admin?invite=${encodeURIComponent(ctx.inviteToken)}`;
    const content = buildStaffInviteEmail({
      fullName: ctx.fullName,
      portalUrl,
    });

    await this.createInApp(
      ctx.userId,
      'staff_invite',
      'Your BLD staff portal access',
      'You have been invited to the operations portal. Open Access portal from your email to sign in.',
      `/build/admin?invite=${encodeURIComponent(ctx.inviteToken)}`,
    );

    const user = await this.prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { phone: true },
    });

    const tasks: Promise<unknown>[] = [
      this.email.send({
        to: ctx.email,
        subject: content.subject,
        text: content.text,
        html: content.html,
      }),
    ];
    if (user?.phone?.trim()) {
      tasks.push(
        this.sms.send({
          to: user.phone,
          body: `BLD: You've been invited to the staff portal. Open Access portal in your email to continue.`,
          purpose: 'notification',
          trialTemplate: TWILIO_TRIAL_NOTIFY_TEMPLATE,
        }),
      );
    }
    await Promise.allSettled(tasks);
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

  /** Branded ops alert to ADMIN_NOTIFY_EMAIL / SUPER_ADMIN_EMAIL. */
  private sendOps(to: string, input: NotificationEmailInput): Promise<void> {
    const content = buildNotificationEmail({ footerReason: OPS_FOOTER, ...input });
    return this.email.send({ to, subject: content.subject, text: content.text, html: content.html });
  }

  /** Deliver a message to a user over email + SMS (best-effort, per-channel). */
  private async dispatchExternal(userId: string, msg: ExternalMessage): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, phone: true, fullName: true },
    });
    if (!user) return;

    const content = buildNotificationEmail({ ...msg.email, fullName: user.fullName });
    const tasks: Promise<unknown>[] = [
      this.email.send({
        to: user.email,
        subject: content.subject,
        text: content.text,
        html: content.html,
      }),
    ];
    if (user.phone?.trim()) {
      tasks.push(
        this.sms.send({
          to: user.phone,
          body: msg.smsBody,
          purpose: 'notification',
          trialTemplate: TWILIO_TRIAL_NOTIFY_TEMPLATE,
        }),
      );
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
