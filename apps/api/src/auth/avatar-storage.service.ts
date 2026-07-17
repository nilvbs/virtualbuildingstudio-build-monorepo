import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export function avatarUploadRoot(): string {
  return resolve(process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads'));
}

@Injectable()
export class AvatarStorageService {
  async save(userIdentity: string, file: Express.Multer.File, publicBaseUrl: string): Promise<string> {
    if (!file) {
      throw new BadRequestException('Choose a profile photo to upload.');
    }

    const extension = IMAGE_EXTENSIONS[file.mimetype];
    if (!extension) {
      throw new BadRequestException('Profile photo must be a JPG, PNG, or WebP image.');
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('Profile photo must be 5 MB or smaller.');
    }

    const directory = join(avatarUploadRoot(), 'avatars');
    await mkdir(directory, { recursive: true });

    const owner = createHash('sha256').update(userIdentity).digest('hex').slice(0, 16);
    const filename = `${owner}-${Date.now()}-${randomUUID()}.${extension}`;
    await writeFile(join(directory, filename), file.buffer);

    return `${publicBaseUrl.replace(/\/$/, '')}/uploads/avatars/${filename}`;
  }
}
