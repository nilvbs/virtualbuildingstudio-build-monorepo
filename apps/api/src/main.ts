import 'reflect-metadata';
import * as Sentry from '@sentry/node';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import {
  assertDatabaseConnectionEncrypted,
  assertProductionDatabaseSsl,
} from './prisma/assert-db-ssl';
import { PrismaService } from './prisma/prisma.service';

/** http(s) origins on localhost or private LAN ranges (Expo / Next dev servers). */
function isLocalDevOrigin(origin: string): boolean {
  try {
    const { protocol, hostname } = new URL(origin);
    if (protocol !== 'http:' && protocol !== 'https:') return false;
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      /^10\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
    );
  } catch {
    return false;
  }
}

async function bootstrap(): Promise<void> {
  // Fail fast if production DB URLs are missing TLS (Phase 1 security).
  assertProductionDatabaseSsl();

  // Error tracking from day one. No-op locally when SENTRY_DSN is unset.
  const dsn = process.env.SENTRY_DSN;
  if (dsn) {
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV ?? 'development',
      tracesSampleRate: 0.1,
    });
  }

  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Structured logging (pino) as the app logger.
  app.useLogger(app.get(Logger));

  // Browser hardening headers (XSS / clickjacking / MIME sniffing / HSTS).
  app.use(
    helmet({
      // API is consumed cross-origin by the web app; disable CORP defaults that
      // break credentialed fetches from the allowed CORS origins.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      // JSON-only API: nothing should ever render or frame a response.
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'none'"],
          formAction: ["'none'"],
        },
      },
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );

  // Request bodies are validated at the boundary with the shared zod schemas
  // (@surveylink/validation) via a zod pipe, added alongside feature DTOs.

  // CORS never reflects arbitrary origins (sessions ride credentialed cookies).
  // Production: only CORS_ORIGINS / WEB_APP_URL, fail-closed when empty.
  // Non-production: the allowlist plus localhost / private-LAN dev servers.
  const isProduction = (process.env.NODE_ENV ?? 'development') === 'production';
  const allowedOrigins = (process.env.CORS_ORIGINS ?? process.env.WEB_APP_URL ?? '')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);
  if (isProduction && allowedOrigins.length === 0) {
    throw new Error(
      'CORS_ORIGINS or WEB_APP_URL must be set in production (CORS fail-closed)',
    );
  }
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      if (!isProduction && isLocalDevOrigin(origin)) return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
  });

  // Behind an ALB/CloudFront: trust the proxy so client IPs (X-Forwarded-For)
  // are correct for rate limiting and logs.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  // Media is stored in S3 only — no local /uploads disk serving.

  await assertDatabaseConnectionEncrypted(app.get(PrismaService));

  app.enableShutdownHooks();

  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
