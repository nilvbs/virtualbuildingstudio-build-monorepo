import { ConflictException, UnauthorizedException } from '@nestjs/common';
import type { User } from '@prisma/client';
import type { AuthPrincipal } from '@surveylink/types';
import type { SignupInput } from '@surveylink/validation';
import { AuthService } from './auth.service';
import type { IdentityProvider } from './identity/identity-provider';
import type { PhoneVerifier } from './phone/phone-verifier';

function makeUser(overrides: Partial<User> = {}): User {
  const now = new Date();
  return {
    id: 'user-uuid',
    fullName: 'Ada Lovelace',
    email: 'ada@example.com',
    phone: '+14155552671',
    emailVerified: false,
    phoneVerified: false,
    roleHint: 'client',
    status: 'active',
    authProvider: 'auth0',
    authSubject: 'auth0|123',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

const signupInput: SignupInput = {
  fullName: 'Ada Lovelace',
  email: 'ada@example.com',
  phone: '+14155552671',
  password: 'sup3rsecret',
  roleHint: 'client',
};

const principal: AuthPrincipal = { sub: 'auth0|123', roles: [] };

describe('AuthService', () => {
  let prisma: {
    user: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    userRole: {
      findMany: jest.Mock;
      upsert: jest.Mock;
    };
    clientProfile: { upsert: jest.Mock };
    surveyorProfile: { upsert: jest.Mock };
    adminProfile: { findUnique: jest.Mock; upsert: jest.Mock };
  };
  let identity: jest.Mocked<IdentityProvider>;
  let phone: jest.Mocked<PhoneVerifier>;
  let service: AuthService;

  beforeEach(() => {
    prisma = {
      user: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      userRole: {
        findMany: jest.fn().mockResolvedValue([{ role: 'client' }]),
        upsert: jest.fn().mockResolvedValue({}),
      },
      clientProfile: { upsert: jest.fn().mockResolvedValue({}) },
      surveyorProfile: { upsert: jest.fn().mockResolvedValue({}) },
      adminProfile: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({}),
      },
    };
    identity = {
      createIdentity: jest.fn(),
      login: jest.fn(),
      sendEmailVerification: jest.fn().mockResolvedValue(undefined),
      getIdentity: jest.fn(),
      revokeRefreshToken: jest.fn().mockResolvedValue(undefined),
      buildSocialAuthorizeUrl: jest.fn(),
      exchangeAuthorizationCode: jest.fn(),
    };
    phone = {
      startVerification: jest.fn().mockResolvedValue(undefined),
      checkVerification: jest.fn(),
    };
    const config = { get: () => undefined } as unknown as import('@nestjs/config').ConfigService;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service = new AuthService(prisma as any, identity, phone, config);
  });

  describe('signup', () => {
    it('creates the identity + local user, unverified, and starts verifications', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      identity.createIdentity.mockResolvedValue({ subject: 'auth0|123', emailVerified: false });
      prisma.user.create.mockResolvedValue(makeUser());

      const result = await service.signup(signupInput);

      expect(identity.createIdentity).toHaveBeenCalledWith({
        fullName: signupInput.fullName,
        email: signupInput.email,
        phone: signupInput.phone,
        password: signupInput.password,
      });
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            authProvider: 'auth0',
            authSubject: 'auth0|123',
            emailVerified: false,
          }),
        }),
      );
      expect(identity.sendEmailVerification).toHaveBeenCalledWith('auth0|123');
      expect(phone.startVerification).toHaveBeenCalledWith(signupInput.phone);
      expect(result).toMatchObject({
        emailVerified: false,
        phoneVerified: false,
        roles: [],
      });
    });

    it('rejects a duplicate email/phone without touching the provider', async () => {
      prisma.user.findFirst.mockResolvedValue(makeUser({ id: 'existing' }));
      prisma.userRole.findMany.mockResolvedValue([{ role: 'client' }]);

      await expect(service.signup(signupInput)).rejects.toBeInstanceOf(ConflictException);
      expect(identity.createIdentity).not.toHaveBeenCalled();
    });
  });

  describe('verifyPhone', () => {
    it('flips phone_verified when the OTP is approved', async () => {
      prisma.user.findUnique.mockResolvedValue(makeUser());
      phone.checkVerification.mockResolvedValue(true);
      prisma.user.update.mockResolvedValue(makeUser({ phoneVerified: true }));

      const result = await service.verifyPhone(principal, '123456');

      expect(phone.checkVerification).toHaveBeenCalledWith('+14155552671', '123456');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-uuid' },
        data: { phoneVerified: true },
      });
      expect(result.phoneVerified).toBe(true);
    });

    it('rejects an invalid OTP and does not update the user', async () => {
      prisma.user.findUnique.mockResolvedValue(makeUser());
      phone.checkVerification.mockResolvedValue(false);

      await expect(service.verifyPhone(principal, '000000')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('verifyEmail', () => {
    it('syncs the local flag once the provider reports the email verified', async () => {
      prisma.user.findUnique.mockResolvedValue(makeUser({ emailVerified: false }));
      identity.getIdentity.mockResolvedValue({
        subject: 'auth0|123',
        email: 'ada@example.com',
        emailVerified: true,
      });
      prisma.user.update.mockResolvedValue(makeUser({ emailVerified: true }));

      const result = await service.verifyEmail(principal);

      expect(result.emailVerified).toBe(true);
      expect(identity.sendEmailVerification).not.toHaveBeenCalled();
    });

    it('resends the verification email while still unverified', async () => {
      prisma.user.findUnique.mockResolvedValue(makeUser({ emailVerified: false }));
      identity.getIdentity.mockResolvedValue({
        subject: 'auth0|123',
        email: 'ada@example.com',
        emailVerified: false,
      });

      await service.verifyEmail(principal);

      expect(identity.sendEmailVerification).toHaveBeenCalledWith('auth0|123');
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });
});
