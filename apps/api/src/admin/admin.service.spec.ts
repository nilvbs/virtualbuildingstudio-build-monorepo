import { BadRequestException, ConflictException } from '@nestjs/common';
import { AdminService } from './admin.service';

const NOW = new Date('2026-03-01T00:00:00Z');

function matchRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'match-1',
    projectId: 'proj-1',
    surveyorId: 'surv-1',
    matchedBy: 'admin-1',
    status: 'proposed',
    adminNotes: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe('AdminService', () => {
  let prisma: {
    user: { findUnique: jest.Mock };
    project: { findUnique: jest.Mock; update: jest.Mock };
    surveyorProfile: { findUnique: jest.Mock };
    match: { create: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
    $transaction: jest.Mock;
  };
  let notifications: { notifyMatchCreated: jest.Mock };
  let projects: { getById: jest.Mock };
  let service: AdminService;

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'admin-1' }) },
      project: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      surveyorProfile: {
        findUnique: jest.fn().mockResolvedValue({ id: 'surv-1', userId: 'suser-1' }),
      },
      match: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    notifications = { notifyMatchCreated: jest.fn().mockResolvedValue(undefined) };
    projects = { getById: jest.fn().mockResolvedValue({ id: 'proj-1', status: 'confirmed' }) };
    const config = { get: jest.fn().mockReturnValue(undefined) };
    const staffContext = {};
    const identity = {};
    service = new AdminService(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      notifications as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      projects as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      config as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      staffContext as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      identity as any,
    );
  });

  describe('createMatch', () => {
    it('creates the match, advances the project to matched, and notifies both sides', async () => {
      prisma.project.findUnique.mockResolvedValue({
        id: 'proj-1',
        status: 'submitted',
        clientId: 'client-1',
        title: 'Warehouse scan',
      });
      prisma.match.create.mockResolvedValue(matchRow());

      const result = await service.createMatch('auth0|admin', {
        projectId: 'proj-1',
        surveyorId: 'surv-1',
        notes: 'Great fit',
      });

      expect(result.status).toBe('proposed');
      expect(prisma.project.update).toHaveBeenCalledWith({
        where: { id: 'proj-1' },
        data: { status: 'matched' },
      });
      expect(notifications.notifyMatchCreated).toHaveBeenCalledWith({
        clientUserId: 'client-1',
        surveyorUserId: 'suser-1',
        projectId: 'proj-1',
        matchId: 'match-1',
        projectTitle: 'Warehouse scan',
      });
    });

    it('refuses to match a project that is not open', async () => {
      prisma.project.findUnique.mockResolvedValue({
        id: 'proj-1',
        status: 'matched',
        clientId: 'client-1',
        title: 'Warehouse scan',
      });

      await expect(
        service.createMatch('auth0|admin', { projectId: 'proj-1', surveyorId: 'surv-1' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(notifications.notifyMatchCreated).not.toHaveBeenCalled();
    });
  });

  describe('updateMatch', () => {
    it('allows a valid transition (proposed -> accepted)', async () => {
      prisma.match.findUnique.mockResolvedValue(matchRow());
      prisma.match.update.mockResolvedValue(matchRow({ status: 'accepted' }));

      const result = await service.updateMatch('match-1', { status: 'accepted' });
      expect(result.status).toBe('accepted');
    });

    it('rejects an invalid transition (proposed -> completed)', async () => {
      prisma.match.findUnique.mockResolvedValue(matchRow());

      await expect(
        service.updateMatch('match-1', { status: 'completed' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('updateProjectStatus', () => {
    it('applies a valid transition and returns the project detail', async () => {
      prisma.project.findUnique.mockResolvedValue({ id: 'proj-1', status: 'matched' });

      const result = await service.updateProjectStatus('auth0|admin', ['admin'], 'proj-1', {
        status: 'confirmed',
      });

      expect(prisma.project.update).toHaveBeenCalled();
      expect(projects.getById).toHaveBeenCalledWith('auth0|admin', ['admin'], 'proj-1');
      expect(result.status).toBe('confirmed');
    });

    it('rejects an invalid transition (submitted -> completed)', async () => {
      prisma.project.findUnique.mockResolvedValue({ id: 'proj-1', status: 'submitted' });

      await expect(
        service.updateProjectStatus('auth0|admin', ['admin'], 'proj-1', { status: 'completed' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
