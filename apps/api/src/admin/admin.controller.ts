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
import {
  AdminClient,
  AdminClientDetail,
  AdminOverviewStats,
  AdminQueues,
  AdminQueueProject,
  AdminSurveyor,
  AdminSurveyorDetail,
  AdminUser,
  AdminUserDetail,
  AuthPrincipal,
  Match,
  ProjectDetail,
  StaffAdmin,
  StaffInvitePeek,
} from '@surveylink/types';
import {
  adminOverviewQuerySchema,
  adminProjectsQuerySchema,
  adminSurveyorQuerySchema,
  adminUsersQuerySchema,
  createMatchSchema,
  createStaffAdminSchema,
  updateAdminUserSchema,
  updateMatchSchema,
  updateProjectStatusSchema,
  updateStaffAdminSchema,
  updateSurveyorProfileSchema,
  adminVerifyContactSchema,
  type AdminOverviewQuery,
  type AdminProjectsQuery,
  type AdminSurveyorQuery,
  type AdminUsersQuery,
  type AdminVerifyContactInput,
  type CreateMatchInput,
  type CreateStaffAdminInput,
  type UpdateAdminUserInput,
  type UpdateMatchInput,
  type UpdateProjectStatusInput,
  type UpdateStaffAdminInput,
  type UpdateSurveyorProfileInput,
} from '@surveylink/validation';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { AdminService } from './admin.service';

@Controller('admin')
@Roles('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  /**
   * Public staff invite peek — prefills portal email/password.
   * Overrides class `@Roles('admin')` so unauthenticated invitees can resolve the link.
   */
  @Public()
  @Roles()
  @Get('staff/invite/:token')
  peekStaffInvite(@Param('token') token: string): Promise<StaffInvitePeek> {
    return this.admin.peekStaffInvite(token);
  }

  /** Invitee signs in, then accepts — clears invite token (Mon–Fri, within 3 days). */
  @Post('staff/invite/:token/accept')
  @HttpCode(200)
  acceptStaffInvite(
    @CurrentUser() principal: AuthPrincipal,
    @Param('token') token: string,
  ): Promise<{ ok: true }> {
    return this.admin.acceptStaffInvite(principal.sub, token);
  }

  /** Summary for operations overview (any staff). */
  @Get('queues')
  queues(): Promise<AdminQueues> {
    return this.admin.getQueues();
  }

  /** Filtered overview analytics (date + location). */
  @Get('overview')
  overview(
    @Query(new ZodValidationPipe(adminOverviewQuerySchema)) query: AdminOverviewQuery,
  ): Promise<AdminOverviewStats> {
    return this.admin.getOverview(query);
  }

  @Get('clients')
  @RequirePermissions('clients:view')
  listClients(): Promise<AdminClient[]> {
    return this.admin.listClients();
  }

  @Get('clients/:id')
  @RequirePermissions('clients:view')
  getClient(@Param('id', ParseUUIDPipe) id: string): Promise<AdminClientDetail> {
    return this.admin.getClient(id);
  }

  @Get('users')
  @RequirePermissions('users:view')
  listUsers(
    @Query(new ZodValidationPipe(adminUsersQuerySchema)) query: AdminUsersQuery,
  ): Promise<AdminUser[]> {
    return this.admin.listUsers(query);
  }

  @Get('users/:id')
  @RequirePermissions('users:view')
  getUser(@Param('id', ParseUUIDPipe) id: string): Promise<AdminUserDetail> {
    return this.admin.getUser(id);
  }

  @Patch('users/:id')
  @RequirePermissions('users:manage')
  updateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateAdminUserSchema)) body: UpdateAdminUserInput,
  ): Promise<AdminUserDetail> {
    return this.admin.updateUser(id, body);
  }

  @Delete('users/:id')
  @HttpCode(204)
  @RequirePermissions('users:manage')
  async deleteUser(
    @CurrentUser() principal: AuthPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.admin.deleteUser(principal.sub, id);
  }

  @Post('users/:id/verify-contact')
  @RequirePermissions('users:manage')
  verifyUserContact(
    @CurrentUser() principal: AuthPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(adminVerifyContactSchema)) body: AdminVerifyContactInput,
  ): Promise<AdminUserDetail> {
    return this.admin.verifyUserContact(principal.sub, id, body);
  }

  @Get('projects')
  @RequirePermissions('projects:view')
  listAllProjects(
    @Query(new ZodValidationPipe(adminProjectsQuerySchema)) query: AdminProjectsQuery,
  ): Promise<AdminQueueProject[]> {
    return this.admin.listOpenProjects({ ...query, scope: 'all' });
  }

  @Get('projects/open')
  @RequirePermissions('projects:view')
  listOpenProjects(
    @Query(new ZodValidationPipe(adminProjectsQuerySchema)) query: AdminProjectsQuery,
  ): Promise<AdminQueueProject[]> {
    return this.admin.listOpenProjects({ ...query, scope: query.scope ?? 'pipeline' });
  }

  @Get('surveyors')
  @RequirePermissions('surveyors:view')
  browseSurveyors(
    @Query(new ZodValidationPipe(adminSurveyorQuerySchema)) query: AdminSurveyorQuery,
  ): Promise<AdminSurveyor[]> {
    return this.admin.browseSurveyors(query);
  }

  @Get('surveyors/:id')
  @RequirePermissions('surveyors:view')
  getSurveyor(@Param('id', ParseUUIDPipe) id: string): Promise<AdminSurveyorDetail> {
    return this.admin.getSurveyor(id);
  }

  @Patch('surveyors/:id')
  @RequirePermissions('users:manage')
  updateSurveyor(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateSurveyorProfileSchema)) body: UpdateSurveyorProfileInput,
  ): Promise<AdminSurveyorDetail> {
    return this.admin.updateSurveyor(id, body);
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
