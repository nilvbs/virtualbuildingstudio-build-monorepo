import { ConflictException } from '@nestjs/common';
import { ProfilesService } from './profiles.service';

const USER = { id: 'user-1', authSubject: 'auth0|1' };

function profileRow(overrides: Record<string, unknown> = {}) {
  const now = new Date('2026-01-01T00:00:00Z');
  return {
    id: 'profile-1',
    userId: 'user-1',
    bio: 'Scanning specialist',
    services: ['laser_scanning'],
    equipment: ['Leica RTC360'],
    baseCity: 'Austin, TX',
    radiusKm: 50,
    dayRateCents: BigInt(120000),
    portfolio: [],
    isMatchable: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('ProfilesService', () => {
  let prisma: {
    user: { findUnique: jest.Mock };
    surveyorProfile: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
    match: { findMany: jest.Mock };
    $executeRaw: jest.Mock;
    $queryRaw: jest.Mock;
  };
  let service: ProfilesService;

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(USER) },
      surveyorProfile: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      match: { findMany: jest.fn() },
      $executeRaw: jest.fn().mockResolvedValue(1),
      $queryRaw: jest.fn().mockResolvedValue([{ lng: -97.74, lat: 30.27 }]),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service = new ProfilesService(prisma as any);
  });

  describe('createProfile', () => {
    it('creates the profile, persists the geography point, and returns a typed DTO', async () => {
      prisma.surveyorProfile.findUnique
        .mockResolvedValueOnce(null) // existence check
        .mockResolvedValueOnce(profileRow()); // getByUserId read
      prisma.surveyorProfile.create.mockResolvedValue({ id: 'profile-1' });

      const result = await service.createProfile('auth0|1', {
        services: ['laser_scanning'],
        equipment: ['Leica RTC360'],
        radiusKm: 50,
        portfolio: [],
        isMatchable: true,
        dayRateCents: 120000,
        location: { lng: -97.74, lat: 30.27 },
      });

      expect(prisma.surveyorProfile.create).toHaveBeenCalled();
      expect(prisma.$executeRaw).toHaveBeenCalled(); // location written via PostGIS
      expect(result.location).toEqual({ lng: -97.74, lat: 30.27 });
      expect(result.dayRateCents).toBe(120000);
      expect(typeof result.dayRateCents).toBe('number'); // BigInt coerced, never float/bigint leak
      expect(result.services).toEqual(['laser_scanning']);
    });

    it('rejects a second profile for the same account', async () => {
      prisma.surveyorProfile.findUnique.mockResolvedValueOnce({ id: 'existing' });

      await expect(
        service.createProfile('auth0|1', {
          services: ['drone'],
          equipment: [],
          radiusKm: 25,
          portfolio: [],
          isMatchable: true,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.surveyorProfile.create).not.toHaveBeenCalled();
    });
  });

  describe('getStatus', () => {
    it('shows the mapping headline with a live profile and no proposed match', async () => {
      prisma.surveyorProfile.findUnique.mockResolvedValue(profileRow());
      prisma.match.findMany.mockResolvedValue([]);

      const status = await service.getStatus('auth0|1');

      expect(status.hasProfile).toBe(true);
      expect(status.profileComplete).toBe(true);
      expect(status.completionPercent).toBe(100);
      expect(status.headline).toBe("We're mapping projects to you.");
      expect(status.matches).toEqual([]);
    });

    it('switches to the matched headline when a proposed match exists', async () => {
      prisma.surveyorProfile.findUnique.mockResolvedValue(profileRow());
      prisma.match.findMany.mockResolvedValue([
        {
          id: 'match-1',
          status: 'proposed',
          createdAt: new Date('2026-01-02T00:00:00Z'),
          project: { title: 'Warehouse scan, Dallas' },
        },
      ]);

      const status = await service.getStatus('auth0|1');

      expect(status.headline).toBe("You've been matched to a project — we'll reach out.");
      expect(status.matches[0]).toMatchObject({
        matchId: 'match-1',
        status: 'proposed',
        projectTitle: 'Warehouse scan, Dallas',
      });
    });

    it('prompts profile setup when none exists', async () => {
      prisma.surveyorProfile.findUnique.mockResolvedValue(null);

      const status = await service.getStatus('auth0|1');

      expect(status.hasProfile).toBe(false);
      expect(status.completionPercent).toBe(0);
      expect(status.profileComplete).toBe(false);
      expect(status.matches).toEqual([]);
    });

    it('gates live status messaging until the profile is complete', async () => {
      prisma.surveyorProfile.findUnique.mockResolvedValue(
        profileRow({ services: [], equipment: [], bio: null, baseCity: null, dayRateCents: null }),
      );
      prisma.$queryRaw.mockResolvedValue([{ lng: null, lat: null }]);
      prisma.match.findMany.mockResolvedValue([]);

      const status = await service.getStatus('auth0|1');

      expect(status.profileComplete).toBe(false);
      expect(status.completionPercent).toBe(0);
      expect(status.headline).toBe('Finish your profile to go live');
      expect(status.isMatchable).toBe(false);
    });
  });
});
