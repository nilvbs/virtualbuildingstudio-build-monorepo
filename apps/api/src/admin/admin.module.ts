import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { ProjectsModule } from '../projects/projects.module';

/**
 * Admin module — the core Phase 1 deliverable. Queues, surveyor browser with
 * filters, and the human-driven manual match action. Every route requires the
 * admin role and is audited (matched_by + timestamps).
 */
@Module({
  imports: [NotificationsModule, ProjectsModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
