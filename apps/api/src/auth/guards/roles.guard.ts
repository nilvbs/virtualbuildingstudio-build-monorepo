import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AppRole, AuthPrincipal } from '@surveylink/types';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { StaffContextService } from '../staff-context.service';

/**
 * Enforces `@Roles(...)`. For `admin`, also accepts DB staff membership
 * (JWT claim may be absent when Auth0 Actions are not configured).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly staff: StaffContextService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<AppRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<{ user?: AuthPrincipal }>();
    const roles = request.user?.roles ?? [];
    const needsAdmin = required.includes('admin');
    const jwtOk = required.every((role) => roles.includes(role));
    if (jwtOk) return true;

    if (needsAdmin && request.user?.sub) {
      const ctx = await this.staff.getBySubject(request.user.sub);
      if (ctx) return true;
    }

    throw new ForbiddenException('Insufficient role');
  }
}
