import { ForbiddenException } from '@nestjs/common';
import { RolesGuard } from './roles.guard';

function guardRequiring(roles: string[] | undefined, staffCtx: unknown = null): RolesGuard {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(roles),
  };
  const staff = {
    getBySubject: jest.fn().mockResolvedValue(staffCtx),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new RolesGuard(reflector as any, staff as any);
}

function contextWith(user: { sub: string; roles: string[] } | undefined) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as never;
}

describe('RolesGuard', () => {
  it('allows routes with no role requirement', async () => {
    const guard = guardRequiring(undefined);
    await expect(guard.canActivate(contextWith({ sub: 'x', roles: [] }))).resolves.toBe(true);
  });

  it('allows when JWT carries the required role', async () => {
    const guard = guardRequiring(['admin']);
    await expect(guard.canActivate(contextWith({ sub: 'x', roles: ['admin'] }))).resolves.toBe(
      true,
    );
  });

  it('allows admin via DB staff membership when JWT claim is missing', async () => {
    const guard = guardRequiring(['admin'], {
      staffLevel: 'admin',
      permissions: ['queue:view'],
    });
    await expect(guard.canActivate(contextWith({ sub: 'x', roles: [] }))).resolves.toBe(true);
  });

  it('rejects when neither JWT nor DB grants the role', async () => {
    const guard = guardRequiring(['admin'], null);
    await expect(guard.canActivate(contextWith({ sub: 'x', roles: [] }))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
