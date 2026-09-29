import { createHash } from 'node:crypto';
import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { issueFirstPartySession, principalFromFirstPartyToken } from '../first-party-session';
import { SessionService } from './session.service';
import { ACCESS_COOKIE, REFRESH_COOKIE } from './session-cookies';

const env: Record<string, string> = {
  SESSION_SIGNING_SECRET: 'unit-test-secret',
  NODE_ENV: 'test',
};
const config = { get: (key: string) => env[key] } as unknown as ConfigService;

const hash = (raw: string) => createHash('sha256').update(raw, 'utf8').digest('hex');

function makeReq(opts: { cookieMode?: boolean; cookies?: Record<string, string> } = {}): Request {
  const headers: Record<string, string> = { 'user-agent': 'jest' };
  if (opts.cookieMode) headers['x-bld-session'] = 'cookie';
  if (opts.cookies) {
    headers.cookie = Object.entries(opts.cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }
  return { headers, ip: '127.0.0.1' } as unknown as Request;
}

function makeRes() {
  return { cookie: jest.fn(), clearCookie: jest.fn() } as unknown as Response & {
    cookie: jest.Mock;
    clearCookie: jest.Mock;
  };
}

function setup() {
  const prisma = {
    authRefreshToken: {
      create: jest.fn().mockResolvedValue({ id: 'new-id' }),
      findUnique: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    user: { findUnique: jest.fn().mockResolvedValue(null) },
  };
  const staff = { getBySubject: jest.fn().mockResolvedValue(null) };
  const identity = { revokeRefreshToken: jest.fn().mockResolvedValue(undefined) };
  const service = new SessionService(prisma as never, config, staff as never, identity as never);
  return { service, prisma, staff, identity };
}

const upstream = () =>
  issueFirstPartySession(config, {
    subject: 'auth0|user-1',
    email: 'user@example.com',
    emailVerified: true,
    expiresInSec: 3600,
  });

describe('SessionService', () => {
  it('bearer issue returns a short-lived access token and a refresh token', async () => {
    const { service, prisma } = setup();
    const session = await service.issue(upstream(), makeReq(), makeRes());

    expect(session.transport).toBe('bearer');
    expect(session.expiresIn).toBe(15 * 60);
    expect(session.refreshToken).toBeTruthy();
    expect(principalFromFirstPartyToken(session.accessToken, config)?.sub).toBe('auth0|user-1');
    const stored = prisma.authRefreshToken.create.mock.calls[0][0].data;
    expect(stored.tokenHash).toBe(hash(session.refreshToken!));
    expect(stored.authSubject).toBe('auth0|user-1');
  });

  it('cookie issue sets httpOnly cookies and never returns tokens in the body', async () => {
    const { service } = setup();
    const res = makeRes();
    const session = await service.issue(upstream(), makeReq({ cookieMode: true }), res);

    expect(session).toMatchObject({ accessToken: '', transport: 'cookie' });
    expect(session.refreshToken).toBeUndefined();
    const names = res.cookie.mock.calls.map((c) => c[0]);
    expect(names).toEqual([ACCESS_COOKIE, REFRESH_COOKIE]);
    for (const call of res.cookie.mock.calls) expect(call[2].httpOnly).toBe(true);
    expect(res.cookie.mock.calls[1][2].sameSite).toBe('strict');
  });

  it('refresh rotates the token and revokes the old one', async () => {
    const { service, prisma } = setup();
    prisma.authRefreshToken.findUnique.mockResolvedValue({
      id: 'old-id',
      familyId: 'fam-1',
      authSubject: 'auth0|user-1',
      email: 'user@example.com',
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      replacedById: null,
    });

    const session = await service.refresh(makeReq(), makeRes(), 'old-raw-token');

    expect(prisma.authRefreshToken.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: hash('old-raw-token') },
    });
    expect(prisma.authRefreshToken.create.mock.calls[0][0].data.familyId).toBe('fam-1');
    expect(prisma.authRefreshToken.updateMany).toHaveBeenCalledWith({
      where: { id: 'old-id', revokedAt: null },
      data: { revokedAt: expect.any(Date), replacedById: 'new-id' },
    });
    expect(session.refreshToken).toBeTruthy();
    expect(session.refreshToken).not.toBe('old-raw-token');
  });

  it('reuse of a rotated token outside the grace window revokes the whole family', async () => {
    const { service, prisma } = setup();
    prisma.authRefreshToken.findUnique.mockResolvedValue({
      id: 'old-id',
      familyId: 'fam-1',
      authSubject: 'auth0|user-1',
      email: 'user@example.com',
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: new Date(Date.now() - 5 * 60_000),
      replacedById: 'newer-id',
    });

    await expect(service.refresh(makeReq(), makeRes(), 'stolen')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.authRefreshToken.updateMany).toHaveBeenCalledWith({
      where: { familyId: 'fam-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(prisma.authRefreshToken.create).not.toHaveBeenCalled();
  });

  it('suspended users cannot refresh and lose every session', async () => {
    const { service, prisma } = setup();
    prisma.authRefreshToken.findUnique.mockResolvedValue({
      id: 'old-id',
      familyId: 'fam-1',
      authSubject: 'auth0|user-1',
      email: 'user@example.com',
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      replacedById: null,
    });
    prisma.user.findUnique.mockResolvedValue({
      email: 'user@example.com',
      emailVerified: true,
      status: 'suspended',
    });

    await expect(service.refresh(makeReq(), makeRes(), 'raw')).rejects.toThrow('Account is suspended');
    expect(prisma.authRefreshToken.updateMany).toHaveBeenCalledWith({
      where: { authSubject: 'auth0|user-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('cookie refresh ignores body tokens and clears cookies when the cookie is missing', async () => {
    const { service, prisma } = setup();
    const res = makeRes();
    await expect(
      service.refresh(makeReq({ cookieMode: true }), res, 'body-token-ignored'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.authRefreshToken.findUnique).not.toHaveBeenCalled();
    expect(res.clearCookie).toHaveBeenCalledWith(ACCESS_COOKIE, expect.anything());
    expect(res.clearCookie).toHaveBeenCalledWith(REFRESH_COOKIE, expect.anything());
  });

  it('adds admin role only for active staff', async () => {
    const { service, staff } = setup();
    staff.getBySubject.mockResolvedValue({ userId: 'u1' });
    const session = await service.issue(upstream(), makeReq(), makeRes());
    expect(principalFromFirstPartyToken(session.accessToken, config)?.roles).toEqual(['admin']);
  });
});
