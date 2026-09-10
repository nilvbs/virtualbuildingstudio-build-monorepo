import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Feedback, FeedbackAspects, FeedbackRole, FeedbackSubmitResult } from '@surveylink/types';
import type { SubmitFeedbackInput } from '@surveylink/validation';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ActivityService } from '../activity/activity.service';

@Injectable()
export class FeedbackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly activity: ActivityService,
  ) {}

  async submit(subject: string, input: SubmitFeedbackInput): Promise<FeedbackSubmitResult> {
    const user = await this.requireUser(subject);
    const match = await this.prisma.match.findUnique({
      where: { id: input.matchId },
      include: {
        project: { select: { id: true, title: true, clientId: true, status: true } },
        surveyor: { select: { id: true, userId: true } },
      },
    });
    if (!match) throw new NotFoundException('Match not found');

    const isClient = match.project.clientId === user.id;
    const isSurveyor = match.surveyor.userId === user.id;
    if (!isClient && !isSurveyor) {
      throw new ForbiddenException('You are not part of this match');
    }

    if (!this.engagementAllowsFeedback(match.status, match.project.status)) {
      throw new BadRequestException(
        'Feedback opens after the job is marked completed. Check back once work is finished.',
      );
    }

    const fromRole = this.resolveFromRole({
      isClient,
      isSurveyor,
      asRole: input.asRole,
    });
    const toUserId = fromRole === 'client' ? match.surveyor.userId : match.project.clientId;

    const existing = await this.prisma.feedback.findUnique({
      where: {
        matchId_fromUserId: { matchId: match.id, fromUserId: user.id },
      },
    });
    if (existing) {
      throw new ConflictException('You already submitted feedback for this match');
    }

    const aspects = (input.aspects ?? {}) as FeedbackAspects;
    const created = await this.prisma.$transaction(async (tx) => {
      const row = await tx.feedback.create({
        data: {
          matchId: match.id,
          projectId: match.project.id,
          fromUserId: user.id,
          toUserId,
          fromRole,
          rating: input.rating,
          comment: input.comment.trim(),
          aspects,
          recommend: input.recommend ?? null,
        },
      });

      if (fromRole === 'client') {
        await this.recomputeSurveyorRating(tx, match.surveyor.id);
      } else {
        await this.recomputeClientRating(tx, toUserId);
      }

      return row;
    });

    const feedback = await this.toDto(created.id);

    await this.notifications.notifyFeedbackSubmitted({
      feedbackId: feedback.id,
      fromUserId: user.id,
      fromRole,
      toUserId,
      projectId: match.project.id,
      projectTitle: match.project.title,
      rating: input.rating,
      comment: input.comment.trim(),
    });

    await this.activity.record({
      entityType: 'feedback',
      entityId: feedback.id,
      projectId: match.project.id,
      matchId: match.id,
      action: 'feedback.submitted',
      summary: `${fromRole} rated ${input.rating}/5 on "${match.project.title}"`,
      actorUserId: user.id,
      metadata: { rating: input.rating, fromRole },
    });

    return {
      feedback,
      message: 'Thank you — your feedback was recorded and a confirmation was emailed to you.',
    };
  }

  async getMineForMatch(subject: string, matchId: string): Promise<Feedback | null> {
    const user = await this.requireUser(subject);
    const row = await this.prisma.feedback.findUnique({
      where: { matchId_fromUserId: { matchId, fromUserId: user.id } },
    });
    if (!row) return null;
    return this.toDto(row.id);
  }

  async listForAdmin(): Promise<Feedback[]> {
    const rows = await this.prisma.feedback.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { id: true },
    });
    return Promise.all(rows.map((r) => this.toDto(r.id)));
  }

  engagementAllowsFeedback(matchStatus: string, projectStatus: string): boolean {
    return matchStatus === 'completed' || projectStatus === 'completed';
  }

  private resolveFromRole(input: {
    isClient: boolean;
    isSurveyor: boolean;
    asRole?: FeedbackRole;
  }): FeedbackRole {
    const { isClient, isSurveyor, asRole } = input;
    if (isClient && isSurveyor) {
      if (asRole === 'client' || asRole === 'surveyor') return asRole;
      throw new BadRequestException(
        'Specify asRole (client or surveyor) when you belong to both sides of this match.',
      );
    }
    if (asRole === 'client' && !isClient) {
      throw new ForbiddenException('You are not the client on this match');
    }
    if (asRole === 'surveyor' && !isSurveyor) {
      throw new ForbiddenException('You are not the surveyor on this match');
    }
    if (asRole === 'client' || asRole === 'surveyor') return asRole;
    return isClient ? 'client' : 'surveyor';
  }

  private async recomputeSurveyorRating(
    tx: Prisma.TransactionClient,
    surveyorProfileId: string,
  ): Promise<void> {
    const profile = await tx.surveyorProfile.findUnique({
      where: { id: surveyorProfileId },
      select: { userId: true },
    });
    if (!profile) return;

    const agg = await tx.feedback.aggregate({
      where: { toUserId: profile.userId, fromRole: 'client' },
      _avg: { rating: true },
      _count: { rating: true },
    });

    await tx.surveyorProfile.update({
      where: { id: surveyorProfileId },
      data: {
        ratingAvg: agg._count.rating > 0 ? Number(agg._avg.rating) : null,
        ratingCount: agg._count.rating,
      },
    });
  }

  private async recomputeClientRating(
    tx: Prisma.TransactionClient,
    clientUserId: string,
  ): Promise<void> {
    const agg = await tx.feedback.aggregate({
      where: { toUserId: clientUserId, fromRole: 'surveyor' },
      _avg: { rating: true },
      _count: { rating: true },
    });

    await tx.accountProfile.upsert({
      where: { userId: clientUserId },
      create: {
        userId: clientUserId,
        ratingAvg: agg._count.rating > 0 ? Number(agg._avg.rating) : null,
        ratingCount: agg._count.rating,
      },
      update: {
        ratingAvg: agg._count.rating > 0 ? Number(agg._avg.rating) : null,
        ratingCount: agg._count.rating,
      },
    });
  }

  private async toDto(id: string): Promise<Feedback> {
    const row = await this.prisma.feedback.findUnique({
      where: { id },
      include: {
        project: { select: { title: true } },
        fromUser: { select: { id: true, username: true, fullName: true } },
        toUser: { select: { id: true, username: true, fullName: true } },
      },
    });
    if (!row) throw new NotFoundException('Feedback not found');

    return {
      id: row.id,
      matchId: row.matchId,
      projectId: row.projectId,
      projectTitle: row.project.title,
      fromUserId: row.fromUser.id,
      fromUsername: row.fromUser.username,
      fromFullName: row.fromUser.fullName,
      fromRole: row.fromRole as FeedbackRole,
      toUserId: row.toUser.id,
      toUsername: row.toUser.username,
      toFullName: row.toUser.fullName,
      rating: row.rating,
      comment: row.comment,
      aspects: (row.aspects ?? {}) as FeedbackAspects,
      recommend: row.recommend,
      createdAt: row.createdAt.toISOString(),
    };
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
