import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { AutoMatchService } from './auto-match.service';

/**
 * Matching — admin manual matches plus Uber-style auto fan-out after project post.
 */
@Module({
  imports: [NotificationsModule],
  providers: [AutoMatchService],
  exports: [AutoMatchService],
})
export class MatchingModule {}
