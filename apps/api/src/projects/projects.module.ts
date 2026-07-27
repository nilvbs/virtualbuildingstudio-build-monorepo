import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { MediaModule } from '../media/media.module';

/**
 * Projects module — client project posting, listing, detail, and surveyor discovery.
 */
@Module({
  imports: [MediaModule],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
