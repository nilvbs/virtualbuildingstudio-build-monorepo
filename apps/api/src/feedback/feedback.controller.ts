import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import type {
  AuthPrincipal,
  Feedback,
  FeedbackSubmitResult,
  SiteFeedback,
  SiteFeedbackSubmitResult,
} from '@surveylink/types';
import {
  submitFeedbackSchema,
  submitSiteFeedbackSchema,
  type SubmitFeedbackInput,
  type SubmitSiteFeedbackInput,
} from '@surveylink/validation';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
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

  @Public()
  @Post('public/feedback')
  submitSite(
    @Body(new ZodValidationPipe(submitSiteFeedbackSchema)) body: SubmitSiteFeedbackInput,
  ): Promise<SiteFeedbackSubmitResult> {
    return this.feedback.submitSite(body);
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

  @Get('admin/site-feedback')
  @Roles('admin')
  @RequirePermissions('projects:view')
  listSiteAdmin(): Promise<SiteFeedback[]> {
    return this.feedback.listSiteForAdmin();
  }
}
