import { Controller, Get, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import type { AuthPrincipal, Notification } from '@surveylink/types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() principal: AuthPrincipal): Promise<Notification[]> {
    return this.notifications.listForUser(principal.sub);
  }

  @Patch(':id/read')
  markRead(
    @CurrentUser() principal: AuthPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Notification> {
    return this.notifications.markRead(principal.sub, id);
  }
}
