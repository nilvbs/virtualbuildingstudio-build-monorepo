import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AppRole, AuthPrincipal } from '@surveylink/types';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Enforces role requirements declared via `@Roles(...)`. Admin routes are
 * guarded with `@Roles('admin')`.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<AppRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<{ user?: AuthPrincipal }>();
    const roles = request.user?.roles ?? [];
    const ok = required.every((role) => roles.includes(role));
    if (!ok) {
      throw new ForbiddenException('Insufficient role');
    }
    return true;
  }
}
