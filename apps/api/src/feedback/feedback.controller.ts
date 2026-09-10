import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import type { AuthPrincipal, Feedback, FeedbackSubmitResult } from '@surveylink/types';
import { submitFeedbackSchema, type SubmitFeedbackInput } from '@surveylink/validation';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { FeedbackService } from './feedback.service';

@Controller()
export class FeedbackController {
  constructor(private readonly feedback: FeedbackService) {}

  @Post('feedback')
  submit(
    @CurrentUser() principal: AuthPrincipal,
    @Body(new ZodValidationPipe(submitFeedbackSchema)) body: SubmitFeedbackInput,
  ): Promise<FeedbackSubmitResult> {
    return this.feedback.submit(principal.sub, body);
  }

  @Get('feedback/match/:matchId/mine')
  mine(
    @CurrentUser() principal: AuthPrincipal,
    @Param('matchId', ParseUUIDPipe) matchId: string,
  ): Promise<Feedback | null> {
    return this.feedback.getMineForMatch(principal.sub, matchId);
  }

  @Get('admin/feedback')
  @Roles('admin')
  @RequirePermissions('projects:view')
  listAdmin(): Promise<Feedback[]> {
    return this.feedback.listForAdmin();
  }
}
