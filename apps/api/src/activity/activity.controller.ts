import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import type { ActivityEntityType, ActivityLogEntry } from '@surveylink/types';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { ActivityService } from './activity.service';

@Controller('admin')
@Roles('admin')
export class ActivityController {
  constructor(private readonly activity: ActivityService) {}

  @Get('activity')
  @RequirePermissions('projects:view')
  list(
    @Query('entityType') entityType: ActivityEntityType,
    @Query('entityId', ParseUUIDPipe) entityId: string,
  ): Promise<ActivityLogEntry[]> {
    return this.activity.listForEntity(entityType, entityId);
  }

  @Get('projects/:id/activity')
  @RequirePermissions('projects:view')
  forProject(@Param('id', ParseUUIDPipe) id: string): Promise<ActivityLogEntry[]> {
    return this.activity.listForProject(id);
  }

  @Get('helpdesk/tickets/:id/activity')
  @RequirePermissions('projects:view')
  forTicket(@Param('id', ParseUUIDPipe) id: string): Promise<ActivityLogEntry[]> {
    return this.activity.listForHelpTicket(id);
  }
}
