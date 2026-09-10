import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { ActivityLogEntry, ActivityEntityType } from '@surveylink/types';
import { PrismaService } from '../prisma/prisma.service';

export interface RecordActivityInput {
  entityType: ActivityEntityType;
  entityId: string;
  action: string;
  summary: string;
  projectId?: string | null;
  matchId?: string | null;
  helpTicketId?: string | null;
  actorUserId?: string | null;
  metadata?: Record<string, unknown>;
  occurredAt?: Date;
}

@Injectable()
export class ActivityService {
  private readonly log = new Logger(ActivityService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Append an activity event. Never throws to callers — timeline writes are
   * best-effort so they cannot roll back domain transactions.
   */
  async record(input: RecordActivityInput): Promise<void> {
    try {
      await this.prisma.activityLog.create({
        data: {
          entityType: input.entityType,
          entityId: input.entityId,
          action: input.action,
          summary: input.summary,
          projectId: input.projectId ?? null,
          matchId: input.matchId ?? null,
          helpTicketId: input.helpTicketId ?? null,
          actorUserId: input.actorUserId ?? null,
          metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
          occurredAt: input.occurredAt ?? new Date(),
        },
      });
    } catch (err) {
      this.log.warn(
        `Failed to record activity ${input.action} on ${input.entityType}/${input.entityId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  async listForEntity(
    entityType: ActivityEntityType,
    entityId: string,
  ): Promise<ActivityLogEntry[]> {
    const rows = await this.prisma.activityLog.findMany({
      where: { entityType, entityId },
      orderBy: { occurredAt: 'asc' },
      take: 500,
      include: {
        actor: { select: { fullName: true, username: true } },
      },
    });
    return rows.map((r) => this.toDto(r));
  }

  async listForProject(projectId: string): Promise<ActivityLogEntry[]> {
    const rows = await this.prisma.activityLog.findMany({
      where: { projectId },
      orderBy: { occurredAt: 'asc' },
      take: 500,
      include: {
        actor: { select: { fullName: true, username: true } },
      },
    });
    return rows.map((r) => this.toDto(r));
  }

  async listForHelpTicket(helpTicketId: string): Promise<ActivityLogEntry[]> {
    const rows = await this.prisma.activityLog.findMany({
      where: { helpTicketId },
      orderBy: { occurredAt: 'asc' },
      take: 500,
      include: {
        actor: { select: { fullName: true, username: true } },
      },
    });
    return rows.map((r) => this.toDto(r));
  }

  private toDto(row: {
    id: string;
    entityType: string;
    entityId: string;
    projectId: string | null;
    matchId: string | null;
    helpTicketId: string | null;
    action: string;
    summary: string;
    actorUserId: string | null;
    metadata: unknown;
    occurredAt: Date;
    createdAt: Date;
    actor?: { fullName: string; username: string } | null;
  }): ActivityLogEntry {
    return {
      id: row.id,
      entityType: row.entityType as ActivityEntityType,
      entityId: row.entityId,
      projectId: row.projectId,
      matchId: row.matchId,
      helpTicketId: row.helpTicketId,
      action: row.action,
      summary: row.summary,
      actorUserId: row.actorUserId,
      actorFullName: row.actor?.fullName ?? null,
      actorUsername: row.actor?.username ?? null,
      metadata: (row.metadata ?? {}) as Record<string, unknown>,
      occurredAt: row.occurredAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
    };
  }
}
