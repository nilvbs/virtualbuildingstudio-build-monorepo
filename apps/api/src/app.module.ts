import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { ProfilesModule } from './profiles/profiles.module';
import { ProjectsModule } from './projects/projects.module';
import { MatchingModule } from './matching/matching.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AdminModule } from './admin/admin.module';
import { MediaModule } from './media/media.module';
import { FeedbackModule } from './feedback/feedback.module';
import { HelpdeskModule } from './helpdesk/helpdesk.module';
import { ActivityModule } from './activity/activity.module';
import { createThrottlerStorage } from './common/redis-throttler.storage';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Load the monorepo-root .env, falling back to a local one.
      envFilePath: ['../../.env', '.env'],
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        transport:
          process.env.NODE_ENV === 'production'
            ? undefined
            : { target: 'pino-pretty', options: { singleLine: true } },
        redact: ['req.headers.authorization', 'req.headers.cookie'],
      },
    }),
    // Baseline abuse protection, shared across instances when REDIS_URL is set
    // (ElastiCache). Auth routes add tighter per-route limits. Volumetric DDoS
    // protection lives at the edge (Cloudflare / AWS WAF).
    ThrottlerModule.forRootAsync({
      useFactory: () => ({
        throttlers: [
          {
            ttl: Number(process.env.THROTTLE_TTL_MS ?? 60_000),
            limit: Number(process.env.THROTTLE_LIMIT ?? 120),
          },
        ],
        storage: createThrottlerStorage(),
      }),
    }),
    PrismaModule,
    HealthModule,
    MediaModule,
    // Phase 1 domain module boundaries (behavior lands in later build steps).
    AuthModule,
    ProfilesModule,
    ProjectsModule,
    MatchingModule,
    NotificationsModule,
    AdminModule,
    FeedbackModule,
    HelpdeskModule,
    ActivityModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
