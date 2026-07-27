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

function encodeS3Key(key: string): string {
  return key
    .split('/')
    .map((part) =>
      encodeURIComponent(part).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`),
    )
    .join('/');
}

function awsSignV4(input: {
  method: string;
  host: string;
  encodedKey: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  payloadHash: string;
  extraCanonicalHeaders?: string;
  signedHeadersExtra?: string;
}): { amzDate: string; authorization: string; signedHeaders: string } {
  const {
    method,
    host,
    encodedKey,
    region,
    accessKeyId,
    secretAccessKey,
    payloadHash,
    extraCanonicalHeaders = '',
    signedHeadersExtra = '',
  } = input;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const canonicalHeaders =
    extraCanonicalHeaders +
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;
  const signedHeaders = `${signedHeadersExtra}host;x-amz-content-sha256;x-amz-date`;
  const canonicalRequest = [
    method,
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
  return { amzDate, authorization, signedHeaders };
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
  const encodedKey = encodeS3Key(key);
  const payloadHash = sha256Hex(body);
  const { amzDate, authorization } = awsSignV4({
    method: 'PUT',
    host,
    encodedKey,
    region,
    accessKeyId,
    secretAccessKey,
    payloadHash,
    extraCanonicalHeaders: `content-type:${contentType}\n`,
    signedHeadersExtra: 'content-type;',
  });

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

/** Minimal S3 DeleteObject via SigV4. */
async function s3DeleteObject(input: {
  bucket: string;
  key: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}): Promise<void> {
  const { bucket, key, region, accessKeyId, secretAccessKey } = input;
  const host = `${bucket}.s3.${region}.amazonaws.com`;
  const encodedKey = encodeS3Key(key);
  const payloadHash = sha256Hex('');
  const { amzDate, authorization } = awsSignV4({
    method: 'DELETE',
    host,
    encodedKey,
    region,
    accessKeyId,
    secretAccessKey,
    payloadHash,
  });

  const response = await fetch(`https://${host}/${encodedKey}`, {
    method: 'DELETE',
    headers: {
      Host: host,
      'X-Amz-Content-Sha256': payloadHash,
      'X-Amz-Date': amzDate,
      Authorization: authorization,
    },
  });

  // 204 No Content and 200 OK are success; 404 means already gone.
  if (!response.ok && response.status !== 404) {
    const text = await response.text().catch(() => '');
    throw new ServiceUnavailableException(
      `S3 delete failed (${response.status}): ${text.slice(0, 300) || response.statusText}`,
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

  private encodeRfc3986(input: string): string {
    return encodeURIComponent(input).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  }

  /**
   * Extract S3 object key from either a full public S3 URL we generated
   * (or a configured publicBaseUrl URL), or from a raw key.
   */
  private keyFromUrl(input: string): string | null {
    const trimmed = input.trim();
    if (!trimmed) return null;

    // If it's already a key-like value, use it directly.
    if (!/^https?:\/\//.test(trimmed) && !trimmed.startsWith('/')) {
      return trimmed;
    }

    try {
      const url = new URL(trimmed.startsWith('/') ? `http://local${trimmed}` : trimmed);
      const host = url.host;
      const key = url.pathname.replace(/^\/+/, '');

      // Only sign objects that are inside our known URL surfaces.
      const allowedS3Host = `${this.bucket}.s3.${this.region}.amazonaws.com`;
      const publicHost = this.publicBaseUrl ? new URL(this.publicBaseUrl).host : null;
      if (host === allowedS3Host || (publicHost && host === publicHost)) {
        return key;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Create a presigned GET URL for private buckets.
   *
   * Uses SigV4 query signing (minimal implementation, no AWS SDK dependency).
   */
  signGetObjectUrl(objectKey: string, expiresInSeconds = 3600): string {
    if (!this.accessKeyId || !this.secretAccessKey) {
      throw new ServiceUnavailableException('Object storage is not configured for signing.');
    }
    if (!objectKey) {
      throw new BadRequestException('Missing S3 object key.');
    }

    const host = `${this.bucket}.s3.${this.region}.amazonaws.com`;
    const encodedKey = objectKey
      .split('/')
      .map((part) =>
        encodeURIComponent(part).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`),
      )
      .join('/');

    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);
    const credentialScope = `${dateStamp}/${this.region}/s3/aws4_request`;

    const queryParams: Record<string, string> = {
      'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
      'X-Amz-Credential': `${this.accessKeyId}/${credentialScope}`,
      'X-Amz-Date': amzDate,
      'X-Amz-Expires': String(expiresInSeconds),
      'X-Amz-SignedHeaders': 'host',
    };

    const canonicalQueryString = Object.keys(queryParams)
      .sort()
      .map((k) => `${this.encodeRfc3986(k)}=${this.encodeRfc3986(queryParams[k])}`)
      .join('&');

    const canonicalHeaders = `host:${host}\n`;
    const signedHeaders = 'host';
    const payloadHash = 'UNSIGNED-PAYLOAD';
    const canonicalRequest = [
      'GET',
      `/${encodedKey}`,
      canonicalQueryString,
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');

    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      sha256Hex(canonicalRequest),
    ].join('\n');

    const kDate = hmac(`AWS4${this.secretAccessKey}`, dateStamp);
    const kRegion = hmac(kDate, this.region);
    const kService = hmac(kRegion, 's3');
    const kSigning = hmac(kService, 'aws4_request');
    const signature = createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex');

    return `https://${host}/${encodedKey}?${canonicalQueryString}&X-Amz-Signature=${signature}`;
  }

  /**
   * If the provided avatarKey is a URL we generated from S3, return a signed
   * URL so <img> works even when the bucket is private.
   */
  resolveSignedUrl(input: string | null | undefined): string | null {
    if (!input) return null;
    try {
      const key = this.keyFromUrl(input);
      if (!key) return input;
      return this.signGetObjectUrl(key, 3600);
    } catch {
      // If signing fails, fall back to the stored URL.
      return input;
    }
  }

  /**
   * Best-effort delete of a previously stored media object (URL or raw key).
   * Used when replacing an avatar so only the latest object remains in S3.
   */
  async deleteStoredObject(input: string | null | undefined): Promise<void> {
    if (!input || !this.accessKeyId || !this.secretAccessKey) return;
    const key = this.keyFromUrl(input);
    if (!key) return;

    try {
      await s3DeleteObject({
        bucket: this.bucket,
        key,
        region: this.region,
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
      });
      this.logger.log(`Deleted s3://${this.bucket}/${key}`);
    } catch (err) {
      this.logger.warn(
        `Failed to delete s3://${this.bucket}/${key}: ${(err as Error).message}`,
      );
    }
  }
}
