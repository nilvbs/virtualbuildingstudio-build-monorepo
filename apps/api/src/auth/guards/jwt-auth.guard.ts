import { ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { DEV_ACCESS_TOKEN, DEV_PRINCIPAL, devAuthEnabled } from '../dev-auth';

/**
 * Global guard: every route requires a valid access token unless explicitly
 * marked `@Public()`. Auth on by default (guardrail #5).
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
  ) {
    super();
  }

  override canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // Dev-only bypass: accept the fixed dev token and inject its principal.
    if (devAuthEnabled(this.config)) {
      const request = context.switchToHttp().getRequest<Request>();
      if (request.headers.authorization === `Bearer ${DEV_ACCESS_TOKEN}`) {
        request.user = DEV_PRINCIPAL;
        return true;
      }
    }

    return super.canActivate(context);
  }
}
