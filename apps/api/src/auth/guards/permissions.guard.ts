import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthPrincipal, StaffPermission } from '@surveylink/types';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { StaffContextService } from '../staff-context.service';

/**
 * Enforces `@RequirePermissions(...)`. Super admins bypass all checks.
 * Must run after JWT auth (principal.sub present).
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly staff: StaffContextService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<StaffPermission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<{ user?: AuthPrincipal }>();
    const sub = request.user?.sub;
    if (!sub) throw new ForbiddenException('Insufficient role');

    const ctx = await this.staff.getBySubject(sub);
    if (!ctx) throw new ForbiddenException('Staff access required');
    if (!this.staff.hasPermission(ctx, required)) {
      throw new ForbiddenException('Insufficient permission');
    }
    return true;
  }
}
