import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  HelpTicket,
  HelpTicketCategory,
  HelpTicketDetail,
  HelpTicketMessage,
  HelpTicketPriority,
  HelpTicketStatus,
  HelpTicketWorkspace,
} from '@surveylink/types';
import type {
  CreateHelpTicketInput,
  HelpTicketMessageInput,
  UpdateHelpTicketInput,
} from '@surveylink/validation';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ActivityService } from '../activity/activity.service';

@Injectable()
export class HelpdeskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly activity: ActivityService,
  ) {}

  async create(subject: string, input: CreateHelpTicketInput): Promise<HelpTicketDetail> {
    const user = await this.requireUser(subject);
    if (input.projectId) {
      const project = await this.prisma.project.findUnique({
        where: { id: input.projectId },
        select: { id: true, clientId: true },
      });
      if (!project) throw new BadRequestException('Project not found');
    }

    const ticketNumber = await this.nextTicketNumber();
    const priority =
      input.category === 'blocker'
        ? input.priority === 'urgent' || input.priority === 'high'
          ? input.priority
          : 'urgent'
        : (input.priority ?? 'normal');
    const created = await this.prisma.helpTicket.create({
      data: {
        ticketNumber,
        userId: user.id,
        workspace: input.workspace,
        category: input.category,
        priority,
        subject: input.subject.trim(),
        status: 'open',
        projectId: input.projectId ?? null,
        messages: {
          create: {
            authorUserId: user.id,
            body: input.body.trim(),
            isStaff: false,
          },
        },
      },
    });

    const detail = await this.toDetail(created.id);
    await this.notifications.notifyHelpTicketCreated({
      ticketId: detail.id,
      ticketNumber: detail.ticketNumber,
      fromUserId: user.id,
      workspace: detail.workspace,
      subject: detail.subject,
      category: detail.category,
      priority: detail.priority,
      preview: input.body.trim().slice(0, 280),
    });
    await this.activity.record({
      entityType: 'help_ticket',
      entityId: detail.id,
      helpTicketId: detail.id,
      projectId: detail.projectId,
      action: 'ticket.opened',
      summary: `Ticket ${detail.ticketNumber} opened: ${detail.subject}`,
      actorUserId: user.id,
      metadata: {
        workspace: detail.workspace,
        category: detail.category,
        priority: detail.priority,
      },
    });
    return detail;
  }

  async listMine(subject: string): Promise<HelpTicket[]> {
    const user = await this.requireUser(subject);
    const rows = await this.prisma.helpTicket.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
      take: 100,
      select: { id: true },
    });
    return Promise.all(rows.map((r) => this.toSummary(r.id)));
  }

  async getMine(subject: string, id: string): Promise<HelpTicketDetail> {
    const user = await this.requireUser(subject);
    const ticket = await this.prisma.helpTicket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (ticket.userId !== user.id) throw new ForbiddenException('Not your ticket');
    return this.toDetail(id);
  }

  async replyMine(
    subject: string,
    id: string,
    input: HelpTicketMessageInput,
  ): Promise<HelpTicketDetail> {
    const user = await this.requireUser(subject);
    const ticket = await this.prisma.helpTicket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (ticket.userId !== user.id) throw new ForbiddenException('Not your ticket');
    if (ticket.status === 'closed') {
      throw new BadRequestException('This ticket is closed');
    }

    await this.prisma.helpTicketMessage.create({
      data: {
        ticketId: id,
        authorUserId: user.id,
        body: input.body.trim(),
        isStaff: false,
      },
    });
    await this.prisma.helpTicket.update({
      where: { id },
      data: {
        status: ticket.status === 'waiting' ? 'open' : ticket.status,
        updatedAt: new Date(),
      },
    });

    const detail = await this.toDetail(id);
    await this.notifications.notifyHelpTicketReply({
      ticketId: detail.id,
      ticketNumber: detail.ticketNumber,
      fromUserId: user.id,
      isStaff: false,
      subject: detail.subject,
      preview: input.body.trim().slice(0, 280),
      ownerUserId: ticket.userId,
      ownerWorkspace: ticket.workspace as 'client' | 'surveyor',
    });
    await this.activity.record({
      entityType: 'help_ticket',
      entityId: id,
      helpTicketId: id,
      projectId: ticket.projectId,
      action: 'ticket.user_replied',
      summary: `Requester replied on ${detail.ticketNumber}`,
      actorUserId: user.id,
    });
    return detail;
  }

  async listAdmin(): Promise<HelpTicket[]> {
    const rows = await this.prisma.helpTicket.findMany({
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
      take: 200,
      select: { id: true },
    });
    return Promise.all(rows.map((r) => this.toSummary(r.id)));
  }

  async getAdmin(id: string): Promise<HelpTicketDetail> {
    return this.toDetail(id);
  }

  async updateAdmin(
    subject: string,
    id: string,
    input: UpdateHelpTicketInput,
  ): Promise<HelpTicketDetail> {
    const staff = await this.requireUser(subject);
    const ticket = await this.prisma.helpTicket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const status = input.status ?? (ticket.status as HelpTicketStatus);
    const now = new Date();
    const resolvedNow =
      (status === 'resolved' || status === 'closed') && !ticket.resolvedAt
        ? now
        : status === 'open' || status === 'in_progress' || status === 'waiting'
          ? null
          : ticket.resolvedAt;
    const closedAt =
      status === 'closed' && !ticket.closedAt
        ? now
        : status === 'open' || status === 'in_progress' || status === 'waiting'
          ? null
          : ticket.closedAt;

    await this.prisma.helpTicket.update({
      where: { id },
      data: {
        status: input.status ?? undefined,
        priority: input.priority ?? undefined,
        assignedToUserId: ticket.assignedToUserId ?? staff.id,
        resolvedAt: resolvedNow,
        closedAt,
      },
    });

    if (input.status && input.status !== ticket.status) {
      await this.activity.record({
        entityType: 'help_ticket',
        entityId: id,
        helpTicketId: id,
        projectId: ticket.projectId,
        action: `ticket.${input.status}`,
        summary: `Ticket status ${ticket.status} → ${input.status}`,
        actorUserId: staff.id,
        metadata: { fromStatus: ticket.status, toStatus: input.status },
      });
    }
    if (input.priority && input.priority !== ticket.priority) {
      await this.activity.record({
        entityType: 'help_ticket',
        entityId: id,
        helpTicketId: id,
        projectId: ticket.projectId,
        action: 'ticket.priority_changed',
        summary: `Priority ${ticket.priority} → ${input.priority}`,
        actorUserId: staff.id,
        metadata: { fromPriority: ticket.priority, toPriority: input.priority },
      });
    }

    return this.toDetail(id);
  }

  async replyAdmin(
    subject: string,
    id: string,
    input: HelpTicketMessageInput,
  ): Promise<HelpTicketDetail> {
    const staff = await this.requireUser(subject);
    const ticket = await this.prisma.helpTicket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException('Ticket not found');

    await this.prisma.helpTicketMessage.create({
      data: {
        ticketId: id,
        authorUserId: staff.id,
        body: input.body.trim(),
        isStaff: true,
      },
    });
    await this.prisma.helpTicket.update({
      where: { id },
      data: {
        status: ticket.status === 'open' ? 'in_progress' : ticket.status,
        assignedToUserId: ticket.assignedToUserId ?? staff.id,
        firstResponseAt: ticket.firstResponseAt ?? new Date(),
        updatedAt: new Date(),
      },
    });

    const detail = await this.toDetail(id);
    await this.notifications.notifyHelpTicketReply({
      ticketId: detail.id,
      ticketNumber: detail.ticketNumber,
      fromUserId: staff.id,
      isStaff: true,
      subject: detail.subject,
      preview: input.body.trim().slice(0, 280),
      ownerUserId: ticket.userId,
      ownerWorkspace: ticket.workspace as 'client' | 'surveyor',
    });
    await this.activity.record({
      entityType: 'help_ticket',
      entityId: id,
      helpTicketId: id,
      projectId: ticket.projectId,
      action: 'ticket.staff_replied',
      summary: `Support replied on ${detail.ticketNumber}`,
      actorUserId: staff.id,
    });
    return detail;
  }

  private async nextTicketNumber(): Promise<string> {
    const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `HD-${day}-${suffix}`;
  }

  private async toSummary(id: string): Promise<HelpTicket> {
    const row = await this.prisma.helpTicket.findUnique({
      where: { id },
      include: {
        user: { select: { username: true, fullName: true, email: true } },
        assignee: { select: { fullName: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { body: true },
        },
        _count: { select: { messages: true } },
      },
    });
    if (!row) throw new NotFoundException('Ticket not found');
    return {
      id: row.id,
      ticketNumber: row.ticketNumber,
      workspace: row.workspace as HelpTicketWorkspace,
      category: row.category as HelpTicketCategory,
      priority: row.priority as HelpTicketPriority,
      subject: row.subject,
      status: row.status as HelpTicketStatus,
      projectId: row.projectId,
      requesterUsername: row.user.username,
      requesterFullName: row.user.fullName,
      requesterEmail: row.user.email,
      assignedToFullName: row.assignee?.fullName ?? null,
      messageCount: row._count.messages,
      latestMessagePreview: row.messages[0]?.body.slice(0, 140) ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
    };
  }

  private async toDetail(id: string): Promise<HelpTicketDetail> {
    const summary = await this.toSummary(id);
    const messages = await this.prisma.helpTicketMessage.findMany({
      where: { ticketId: id },
      orderBy: { createdAt: 'asc' },
      include: {
        author: { select: { username: true, fullName: true } },
      },
    });
    const mapped: HelpTicketMessage[] = messages.map((m) => ({
      id: m.id,
      body: m.body,
      isStaff: m.isStaff,
      authorUsername: m.author.username,
      authorFullName: m.author.fullName,
      createdAt: m.createdAt.toISOString(),
    }));
    return { ...summary, messages: mapped };
  }

  private async requireUser(subject: string): Promise<{ id: string }> {
    const user = await this.prisma.user.findUnique({
      where: { authSubject: subject },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('No local account is linked to this identity');
    return user;
  }
}
