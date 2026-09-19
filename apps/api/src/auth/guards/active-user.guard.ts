import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthPrincipal } from '@surveylink/types';
import { PrismaService } from '../../prisma/prisma.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * After JWT auth: reject suspended (or otherwise non-active) accounts on every
 * authenticated request. Public routes are skipped. Subjects with no user row
 * yet (e.g. mid Google registration) are allowed through.
 */
@Injectable()
export class ActiveUserGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<{ user?: AuthPrincipal }>();
    const sub = request.user?.sub;
    if (!sub) return true;

    const user = await this.prisma.user.findUnique({
      where: { authSubject: sub },
      select: { status: true },
    });
    if (!user) return true;

    if (user.status !== 'active') {
      throw new UnauthorizedException('Account is suspended');
    }
    return true;
  }
}
