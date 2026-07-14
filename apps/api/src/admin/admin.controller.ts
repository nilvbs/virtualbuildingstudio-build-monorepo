import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import type {
  AdminQueues,
  AdminSurveyor,
  AuthPrincipal,
  Match,
  ProjectDetail,
  StaffAdmin,
} from '@surveylink/types';
import {
  adminSurveyorQuerySchema,
  createMatchSchema,
  createStaffAdminSchema,
  updateMatchSchema,
  updateProjectStatusSchema,
  updateStaffAdminSchema,
  type AdminSurveyorQuery,
  type CreateMatchInput,
  type CreateStaffAdminInput,
  type UpdateMatchInput,
  type UpdateProjectStatusInput,
  type UpdateStaffAdminInput,
} from '@surveylink/validation';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { AdminService } from './admin.service';

@Controller('admin')
@Roles('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('queues')
  @RequirePermissions('queue:view')
  queues(): Promise<AdminQueues> {
    return this.admin.getQueues();
  }

  @Get('surveyors')
  @RequirePermissions('surveyors:view')
  browseSurveyors(
    @Query(new ZodValidationPipe(adminSurveyorQuerySchema)) query: AdminSurveyorQuery,
  ): Promise<AdminSurveyor[]> {
    return this.admin.browseSurveyors(query);
  }

  @Post('matches')
  @RequirePermissions('match:create')
  createMatch(
    @CurrentUser() principal: AuthPrincipal,
    @Body(new ZodValidationPipe(createMatchSchema)) body: CreateMatchInput,
  ): Promise<Match> {
    return this.admin.createMatch(principal.sub, body);
  }

  @Patch('matches/:id')
  @RequirePermissions('match:update')
  updateMatch(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateMatchSchema)) body: UpdateMatchInput,
  ): Promise<Match> {
    return this.admin.updateMatch(id, body);
  }

  @Patch('projects/:id/status')
  @RequirePermissions('project:update_status')
  updateProjectStatus(
    @CurrentUser() principal: AuthPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateProjectStatusSchema)) body: UpdateProjectStatusInput,
  ): Promise<ProjectDetail> {
    return this.admin.updateProjectStatus(principal.sub, principal.roles, id, body);
  }

  @Get('staff')
  @RequirePermissions('staff:manage')
  listStaff(): Promise<StaffAdmin[]> {
    return this.admin.listStaffAdmins();
  }

  @Post('staff')
  @RequirePermissions('staff:manage')
  createStaff(
    @CurrentUser() principal: AuthPrincipal,
    @Body(new ZodValidationPipe(createStaffAdminSchema)) body: CreateStaffAdminInput,
  ): Promise<StaffAdmin> {
    return this.admin.createStaffAdmin(principal.sub, body);
  }

  @Patch('staff/:userId')
  @RequirePermissions('staff:manage')
  updateStaff(
    @CurrentUser() principal: AuthPrincipal,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body(new ZodValidationPipe(updateStaffAdminSchema)) body: UpdateStaffAdminInput,
  ): Promise<StaffAdmin> {
    return this.admin.updateStaffAdmin(principal.sub, userId, body);
  }

  @Delete('staff/:userId')
  @HttpCode(204)
  @RequirePermissions('staff:manage')
  async removeStaff(
    @CurrentUser() principal: AuthPrincipal,
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<void> {
    await this.admin.removeStaffAdmin(principal.sub, userId);
  }
}
