import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AppRole, AuthPrincipal } from '@surveylink/types';
import { RolesGuard } from './roles.guard';

function contextWith(user?: AuthPrincipal): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

function guardRequiring(roles: AppRole[] | undefined): RolesGuard {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(roles),
  } as unknown as Reflector;
  return new RolesGuard(reflector);
}

describe('RolesGuard', () => {
  it('allows routes with no role requirement', () => {
    const guard = guardRequiring(undefined);
    expect(guard.canActivate(contextWith({ sub: 'x', roles: [] }))).toBe(true);
  });

  it('allows an admin through an admin-only route', () => {
    const guard = guardRequiring(['admin']);
    expect(guard.canActivate(contextWith({ sub: 'x', roles: ['admin'] }))).toBe(true);
  });

  it('forbids a non-admin from an admin-only route', () => {
    const guard = guardRequiring(['admin']);
    expect(() => guard.canActivate(contextWith({ sub: 'x', roles: [] }))).toThrow(
      ForbiddenException,
    );
  });
});
