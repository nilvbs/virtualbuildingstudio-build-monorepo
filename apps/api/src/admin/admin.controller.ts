import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import type {
  AdminQueues,
  AdminSurveyor,
  AuthPrincipal,
  Match,
  ProjectDetail,
} from '@surveylink/types';
import {
  adminSurveyorQuerySchema,
  createMatchSchema,
  updateMatchSchema,
  updateProjectStatusSchema,
  type AdminSurveyorQuery,
  type CreateMatchInput,
  type UpdateMatchInput,
  type UpdateProjectStatusInput,
} from '@surveylink/validation';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminService } from './admin.service';

@Controller('admin')
@Roles('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('queues')
  queues(): Promise<AdminQueues> {
    return this.admin.getQueues();
  }

  @Get('surveyors')
  browseSurveyors(
    @Query(new ZodValidationPipe(adminSurveyorQuerySchema)) query: AdminSurveyorQuery,
  ): Promise<AdminSurveyor[]> {
    return this.admin.browseSurveyors(query);
  }

  @Post('matches')
  createMatch(
    @CurrentUser() principal: AuthPrincipal,
    @Body(new ZodValidationPipe(createMatchSchema)) body: CreateMatchInput,
  ): Promise<Match> {
    return this.admin.createMatch(principal.sub, body);
  }

  @Patch('matches/:id')
  updateMatch(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateMatchSchema)) body: UpdateMatchInput,
  ): Promise<Match> {
    return this.admin.updateMatch(id, body);
  }

  @Patch('projects/:id/status')
  updateProjectStatus(
    @CurrentUser() principal: AuthPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateProjectStatusSchema)) body: UpdateProjectStatusInput,
  ): Promise<ProjectDetail> {
    return this.admin.updateProjectStatus(principal.sub, principal.roles, id, body);
  }
}
