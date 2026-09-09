import { Module } from '@nestjs/common';
import { ProfilesController } from './profiles.controller';
import { ProfilesService } from './profiles.service';
import { MatchingModule } from '../matching/matching.module';
import { NotificationsModule } from '../notifications/notifications.module';

/**
 * Profiles module — surveyor profile create/read/update and the surveyor
 * status ("We're mapping projects to you") surface.
 */
@Module({
  imports: [MatchingModule, NotificationsModule],
  controllers: [ProfilesController],
  providers: [ProfilesService],
  exports: [ProfilesService],
})
export class ProfilesModule {}
