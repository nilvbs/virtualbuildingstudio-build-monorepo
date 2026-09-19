import 'reflect-metadata';
import * as Sentry from '@sentry/node';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { assertProductionDatabaseSsl } from './prisma/assert-db-ssl';

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

  // Browser hardening headers (XSS / clickjacking / MIME sniffing).
  app.use(
    helmet({
      // API is consumed cross-origin by the web app; disable CORP defaults that
      // break credentialed fetches from the allowed CORS origins.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: false,
    }),
  );

  // Request bodies are validated at the boundary with the shared zod schemas
  // (@surveylink/validation) via a zod pipe, added alongside feature DTOs.

  // Lock CORS to explicit web origins in deployed environments. Set
  // CORS_ORIGINS (comma-separated) or fall back to WEB_APP_URL.
  // In local development, reflect any origin so Expo (8081) and web (3000) both work.
  // Production fail-closed: never allow all origins when the allowlist is empty.
  const isDev = (process.env.NODE_ENV ?? 'development') !== 'production';
  const allowedOrigins = (process.env.CORS_ORIGINS ?? process.env.WEB_APP_URL ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  if (!isDev && allowedOrigins.length === 0) {
    throw new Error(
      'CORS_ORIGINS or WEB_APP_URL must be set in production (CORS fail-closed)',
    );
  }
  app.enableCors({
    origin: isDev ? true : allowedOrigins,
    credentials: true,
  });

  // Behind an ALB/CloudFront: trust the proxy so client IPs (X-Forwarded-For)
  // are correct for rate limiting and logs.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  // Media is stored in S3 only — no local /uploads disk serving.

  app.enableShutdownHooks();

  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
