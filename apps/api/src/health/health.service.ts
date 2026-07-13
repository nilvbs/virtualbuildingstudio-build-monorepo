import { Injectable } from '@nestjs/common';
import type { HealthStatus } from '@surveylink/types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<HealthStatus> {
    let dbUp = false;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbUp = true;
    } catch {
      dbUp = false;
    }

    return {
      status: dbUp ? 'ok' : 'error',
      info: { database: { status: dbUp ? 'up' : 'down' } },
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}
