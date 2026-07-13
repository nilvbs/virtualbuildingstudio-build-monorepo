import { ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import {
  DEV_ACCESS_TOKEN,
  DEV_GOOGLE_ACCESS_TOKEN,
  DEV_GOOGLE_PRINCIPAL,
  DEV_PRINCIPAL,
  devAuthEnabled,
  principalFromDevUserToken,
} from '../dev-auth';

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

    // Dev-only bypass: accept the fixeddev tokens and inject their principals.
    if (devAuthEnabled(this.config)) {
      const request = context.switchToHttp().getRequest<Request>();
      const auth = request.headers.authorization;
      if (auth === `Bearer ${DEV_ACCESS_TOKEN}`) {
        request.user = DEV_PRINCIPAL;
        return true;
      }
      if (auth === `Bearer ${DEV_GOOGLE_ACCESS_TOKEN}`) {
        request.user = DEV_GOOGLE_PRINCIPAL;
        return true;
      }
      if (auth?.startsWith('Bearer ')) {
        const principal = principalFromDevUserToken(auth.slice('Bearer '.length));
        if (principal) {
          request.user = principal;
          return true;
        }
      }
    }

    return super.canActivate(context);
  }
}
