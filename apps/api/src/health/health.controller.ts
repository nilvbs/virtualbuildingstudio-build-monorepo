import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { HealthStatus } from '@surveylink/types';
import { HealthService } from './health.service';
import { Public } from '../auth/decorators/public.decorator';

// Load balancer / uptime probes hit this constantly — never rate-limit it.
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Public()
  @Get()
  @HttpCode(HttpStatus.OK)
  async check(): Promise<HealthStatus> {
    return this.health.check();
  }
}
