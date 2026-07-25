import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash, createHmac, randomUUID } from 'node:crypto';

export type MediaKind = 'avatar' | 'portfolio' | 'document' | 'logo' | 'cover' | 'certificate';

export interface StoredMedia {
  /** Public HTTPS URL stored in the DB and used directly in <img src>. */
  url: string;
  /** Object key inside the bucket (for ops / deletion later). */
  key: string;
  contentType: string;
  fileName: string;
}

const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

const DOCUMENT_TYPES: Record<string, string> = {
  ...IMAGE_TYPES,
  'application/pdf': 'pdf',
};

const MAX_BYTES: Record<MediaKind, number> = {
  avatar: 5 * 1024 * 1024,
  portfolio: 8 * 1024 * 1024,
  document: 12 * 1024 * 1024,
  logo: 5 * 1024 * 1024,
  cover: 8 * 1024 * 1024,
  certificate: 12 * 1024 * 1024,
};

/**
 * Prefixes inside bucket `bld-build`.
 * Keys: avatar/{ownerHash}/{timestamp}-{uuid}.jpg
 */
const FOLDER: Record<MediaKind, string> = {
  avatar: 'avatar',
  portfolio: 'portfolio',
  document: 'document',
  logo: 'logo',
  cover: 'cover',
  certificate: 'certificate',
};

const DEFAULT_S3_BUCKET = 'bld-build';

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data, 'utf8').digest();
}

function sha256Hex(data: Buffer | string): string {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Minimal S3 PutObject via SigV4 (no @aws-sdk/client-s3 dependency).
 * Verified against bucket `bld-build`.
 */
async function s3PutObject(input: {
  bucket: string;
  key: string;
  body: Buffer;
  contentType: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}): Promise<void> {
  const { bucket, key, body, contentType, region, accessKeyId, secretAccessKey } = input;
  const host = `${bucket}.s3.${region}.amazonaws.com`;
  const encodedKey = key
    .split('/')
    .map((part) => encodeURIComponent(part).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`))
    .join('/');
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256Hex(body);
  const canonicalHeaders =
    `content-type:${contentType}\n` +
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;
  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = [
    'PUT',
    `/${encodedKey}`,
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');
  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, 's3');
  const kSigning = hmac(kService, 'aws4_request');
  const signature = createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex');
  const authorization =
    `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const response = await fetch(`https://${host}/${encodedKey}`, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
      Host: host,
      'X-Amz-Content-Sha256': payloadHash,
      'X-Amz-Date': amzDate,
      Authorization: authorization,
      'Content-Length': String(body.length),
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new ServiceUnavailableException(
      `S3 upload failed (${response.status}): ${text.slice(0, 300) || response.statusText}`,
    );
  }
}

@Injectable()
export class S3MediaStorageService {
  private readonly logger = new Logger(S3MediaStorageService.name);
  private readonly bucket: string;
  private readonly region: string;
  private readonly publicBaseUrl: string | null;
  private readonly accessKeyId: string | null;
  private readonly secretAccessKey: string | null;

  constructor() {
    this.bucket = process.env.S3_BUCKET?.trim() || DEFAULT_S3_BUCKET;
    this.region =
      process.env.S3_REGION?.trim() || process.env.AWS_REGION?.trim() || 'us-east-2';
    this.publicBaseUrl = process.env.S3_PUBLIC_BASE_URL?.trim().replace(/\/$/, '') || null;
    this.accessKeyId =
      process.env.S3_ACCESS_KEY_ID?.trim() || process.env.AWS_ACCESS_KEY_ID?.trim() || null;
    this.secretAccessKey =
      process.env.S3_SECRET_ACCESS_KEY?.trim() || process.env.AWS_SECRET_ACCESS_KEY?.trim() || null;

    if (this.accessKeyId && this.secretAccessKey) {
      this.logger.log(
        `S3 media enabled (bucket=${this.bucket}, region=${this.region}, folders=avatar|portfolio|document|logo|cover|certificate)`,
      );
    } else {
      this.logger.warn(
        'S3 media disabled — set AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY (or S3_* equivalents).',
      );
    }
  }

  isEnabled(): boolean {
    return Boolean(this.accessKeyId && this.secretAccessKey && this.bucket);
  }

  async upload(
    ownerIdentity: string,
    file: Express.Multer.File,
    kind: MediaKind,
  ): Promise<StoredMedia> {
    if (!this.accessKeyId || !this.secretAccessKey) {
      throw new ServiceUnavailableException(
        'Object storage is not configured. Set AWS credentials for bucket bld-build.',
      );
    }
    if (!file?.buffer?.length) {
      throw new BadRequestException('Choose a file to upload.');
    }

    const allowed = kind === 'document' || kind === 'certificate' ? DOCUMENT_TYPES : IMAGE_TYPES;
    const extension = allowed[file.mimetype];
    if (!extension) {
      throw new BadRequestException(
        kind === 'document' || kind === 'certificate'
          ? 'Upload a PDF, JPG, PNG, WebP, or GIF file.'
          : 'Upload a JPG, PNG, WebP, or GIF image.',
      );
    }

    const max = MAX_BYTES[kind];
    if (file.size > max) {
      throw new BadRequestException(`File must be ${Math.round(max / (1024 * 1024))} MB or smaller.`);
    }

    const owner = createHash('sha256').update(ownerIdentity).digest('hex').slice(0, 16);
    const key = `${FOLDER[kind]}/${owner}/${Date.now()}-${randomUUID()}.${extension}`;

    await s3PutObject({
      bucket: this.bucket,
      key,
      body: file.buffer,
      contentType: file.mimetype,
      region: this.region,
      accessKeyId: this.accessKeyId,
      secretAccessKey: this.secretAccessKey,
    });

    const url = this.toPublicUrl(key);
    const fileName = file.originalname?.trim() || `${kind}.${extension}`;
    this.logger.log(`Uploaded s3://${this.bucket}/${key}`);

    return {
      url,
      key,
      contentType: file.mimetype,
      fileName,
    };
  }

  private toPublicUrl(key: string): string {
    if (this.publicBaseUrl) {
      return `${this.publicBaseUrl}/${key}`;
    }
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }
}
