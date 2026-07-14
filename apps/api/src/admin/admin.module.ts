import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { ProjectsModule } from '../projects/projects.module';
import { AuthModule } from '../auth/auth.module';

/**
 * Admin module — queues, surveyor browser, matching, and staff RBAC management.
 * Every route requires the admin membership; actions use fine-grained permissions.
 */
@Module({
  imports: [NotificationsModule, ProjectsModule, AuthModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
