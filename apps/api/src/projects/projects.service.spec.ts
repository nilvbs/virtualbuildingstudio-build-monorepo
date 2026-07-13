import { NotFoundException } from '@nestjs/common';
import { ProjectsService } from './projects.service';

const USER = { id: 'client-1', authSubject: 'auth0|c1' };

function projectRow(overrides: Record<string, unknown> = {}) {
  const now = new Date('2026-02-01T00:00:00Z');
  return {
    id: 'proj-1',
    clientId: 'client-1',
    title: 'Warehouse scan, Dallas',
    services: ['laser_scanning'],
    locationText: '123 Main St',
    buildingType: 'industrial',
    buildingAge: '1990s',
    floors: 2,
    areaSqft: 50000,
    neededWithin: '2_weeks',
    notes: null,
    status: 'submitted',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('ProjectsService', () => {
  let prisma: {
    user: { findUnique: jest.Mock };
    project: { create: jest.Mock; findUnique: jest.Mock; findMany: jest.Mock };
    match: { findMany: jest.Mock };
    $executeRaw: jest.Mock;
    $queryRaw: jest.Mock;
  };
  let service: ProjectsService;

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(USER) },
      project: { create: jest.fn(), findUnique: jest.fn(), findMany: jest.fn() },
      match: { findMany: jest.fn().mockResolvedValue([]) },
      $executeRaw: jest.fn().mockResolvedValue(1),
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'proj-1', lng: -96.8, lat: 32.78 }]),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service = new ProjectsService(prisma as any);
  });

  describe('create', () => {
    it('creates a submitted project and persists the location point', async () => {
      prisma.project.create.mockResolvedValue({ id: 'proj-1' });
      prisma.project.findUnique.mockResolvedValue(projectRow());

      const result = await service.create('auth0|c1', {
        title: 'Warehouse scan, Dallas',
        services: ['laser_scanning'],
        location: { lng: -96.8, lat: 32.78 },
        floors: 2,
        areaSqft: 50000,
      });

      expect(prisma.project.create).toHaveBeenCalled();
      expect(prisma.$executeRaw).toHaveBeenCalled();
      expect(result.status).toBe('submitted');
      expect(result.location).toEqual({ lng: -96.8, lat: 32.78 });
    });
  });

  describe('getById', () => {
    it('returns the project with non-PII match info for the owner', async () => {
      prisma.project.findUnique.mockResolvedValue(projectRow({ status: 'matched' }));
      prisma.match.findMany.mockResolvedValue([
        {
          id: 'match-1',
          status: 'proposed',
          createdAt: new Date('2026-02-02T00:00:00Z'),
          surveyor: { baseCity: 'Dallas, TX' },
        },
      ]);

      const detail = await service.getById('auth0|c1', [], 'proj-1');

      expect(detail.status).toBe('matched');
      expect(detail.matches[0]).toMatchObject({
        matchId: 'match-1',
        status: 'proposed',
        surveyorBaseCity: 'Dallas, TX',
      });
    });

    it('hides a project owned by someone else from a non-admin', async () => {
      prisma.project.findUnique.mockResolvedValue(projectRow({ clientId: 'someone-else' }));

      await expect(service.getById('auth0|c1', [], 'proj-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('allows an admin to view any project', async () => {
      prisma.project.findUnique.mockResolvedValue(projectRow({ clientId: 'someone-else' }));

      const detail = await service.getById('auth0|c1', ['admin'], 'proj-1');
      expect(detail.id).toBe('proj-1');
    });
  });

  describe('listForClient', () => {
    it('returns the caller\u2019s projects with resolved locations', async () => {
      prisma.project.findMany.mockResolvedValue([projectRow()]);

      const list = await service.listForClient('auth0|c1');

      expect(list).toHaveLength(1);
      expect(list[0]?.location).toEqual({ lng: -96.8, lat: 32.78 });
    });
  });
});
