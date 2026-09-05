import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  let prisma: {
    notification: { create: jest.Mock; findMany: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
    user: { findUnique: jest.Mock };
  };
  let config: { get: jest.Mock };
  let email: { send: jest.Mock };
  let sms: { send: jest.Mock };
  let service: NotificationsService;

  beforeEach(() => {
    prisma = {
      notification: {
        create: jest.fn().mockResolvedValue({}),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ email: 'u@example.com', phone: '+15550001111' }),
      },
    };
    config = { get: jest.fn().mockReturnValue('http://localhost:3000') };
    email = { send: jest.fn().mockResolvedValue(undefined) };
    sms = { send: jest.fn().mockResolvedValue(undefined) };
    service = new NotificationsService(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      config as any,
      email,
      sms,
    );
  });

  describe('notifyMatchCreated', () => {
    it('writes an in-app row and sends email + SMS with deep links to both sides', async () => {
      await service.notifyMatchCreated({
        clientUserId: 'client-1',
        surveyorUserId: 'surveyor-1',
        projectId: 'proj-1',
        matchId: 'match-1',
        projectTitle: 'Warehouse scan',
      });

      // One in-app notification per recipient.
      expect(prisma.notification.create).toHaveBeenCalledTimes(2);
      const kinds = prisma.notification.create.mock.calls.map((c) => c[0].data.kind);
      expect(kinds).toEqual(expect.arrayContaining(['match_found', 'match_proposed']));
      const links = prisma.notification.create.mock.calls.map((c) => c[0].data.linkUrl);
      expect(links).toEqual(
        expect.arrayContaining(['/client/projects/proj-1', '/surveyor/requests?match=match-1']),
      );

      // Email + SMS attempted for each recipient.
      expect(email.send).toHaveBeenCalledTimes(2);
      expect(sms.send).toHaveBeenCalledTimes(2);
      expect(sms.send.mock.calls[0][0].to).toBe('+15550001111');
      expect(sms.send.mock.calls[0][0].body).toContain('http://localhost:3000/client/projects/proj-1');
      expect(sms.send.mock.calls[1][0].body).toContain(
        'http://localhost:3000/surveyor/requests?match=match-1',
      );
    });

    it('does not throw if a delivery channel fails', async () => {
      email.send.mockRejectedValueOnce(new Error('ses down'));

      await expect(
        service.notifyMatchCreated({
          clientUserId: 'client-1',
          surveyorUserId: 'surveyor-1',
          projectId: 'proj-1',
          matchId: 'match-1',
          projectTitle: 'Warehouse scan',
        }),
      ).resolves.toBeUndefined();
    });

    it('skips SMS when the user has no phone', async () => {
      prisma.user.findUnique.mockResolvedValue({ email: 'u@example.com', phone: null });

      await service.notifyMatchCreated({
        clientUserId: 'client-1',
        surveyorUserId: 'surveyor-1',
        projectId: 'proj-1',
        matchId: 'match-1',
        projectTitle: 'Warehouse scan',
      });

      expect(email.send).toHaveBeenCalled();
      expect(sms.send).not.toHaveBeenCalled();
    });
  });
});
