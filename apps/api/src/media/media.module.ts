import { Module } from '@nestjs/common';
import { MediaController } from './media.controller';
import { S3MediaStorageService } from './s3-media.storage';

@Module({
  controllers: [MediaController],
  providers: [S3MediaStorageService],
  exports: [S3MediaStorageService],
})
export class MediaModule {}
