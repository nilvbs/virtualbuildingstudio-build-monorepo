import { Injectable } from '@nestjs/common';
import { S3MediaStorageService } from '../media/s3-media.storage';

/**
 * Profile photo uploads — S3 only. Persists the public object URL on the user.
 */
@Injectable()
export class AvatarStorageService {
  constructor(private readonly media: S3MediaStorageService) {}

  async save(userIdentity: string, file: Express.Multer.File, _publicBaseUrl?: string): Promise<string> {
    void _publicBaseUrl;
    const stored = await this.media.upload(userIdentity, file, 'avatar');
    return stored.url;
  }
}
