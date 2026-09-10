import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { MediaModule } from '../media/media.module';
import { MatchingModule } from '../matching/matching.module';
import { ActivityModule } from '../activity/activity.module';
import { NotificationsModule } from '../notifications/notifications.module';

/**
 * Projects module — client project posting, listing, detail, and surveyor discovery.
 */
@Module({
  imports: [MediaModule, MatchingModule, ActivityModule, NotificationsModule],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
