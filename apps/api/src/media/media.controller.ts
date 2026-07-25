import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { AuthPrincipal } from '@surveylink/types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { S3MediaStorageService, type MediaKind, type StoredMedia } from './s3-media.storage';

const KINDS = new Set<string>([
  'avatar',
  'portfolio',
  'document',
  'logo',
  'cover',
  'certificate',
]);

@Controller('media')
export class MediaController {
  constructor(private readonly storage: S3MediaStorageService) {}

  /**
   * Upload a file to S3 and return the public HTTPS URL (store this URL in the DB).
   * Multipart: `file` (required), `kind` (avatar|portfolio|document|logo|cover|certificate).
   */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 12 * 1024 * 1024 } }))
  upload(
    @CurrentUser() principal: AuthPrincipal,
    @UploadedFile() file: Express.Multer.File,
    @Body('kind') kindRaw?: string,
  ): Promise<StoredMedia> {
    const kind = (kindRaw?.trim() || 'portfolio') as MediaKind;
    if (!KINDS.has(kind)) {
      throw new BadRequestException(
        'kind must be one of: avatar, portfolio, document, logo, cover, certificate',
      );
    }
    return this.storage.upload(principal.sub, file, kind);
  }
}
