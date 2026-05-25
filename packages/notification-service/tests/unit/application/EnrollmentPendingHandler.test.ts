import { EnrollmentPendingHandler } from '../../../src/application/handlers/EnrollmentPendingHandler';
import { INotificationRepository }  from '../../../src/domain/repositories/INotificationRepository';
import { UserServiceClient }        from '../../../src/infrastructure/clients/UserServiceClient';

const makeRepo   = (): jest.Mocked<INotificationRepository> =>
  ({ findByUser: jest.fn(), create: jest.fn(), markRead: jest.fn(), markAllRead: jest.fn() });
const makeClient = (): jest.Mocked<UserServiceClient> =>
  ({ getAdminUids: jest.fn() } as unknown as jest.Mocked<UserServiceClient>);

describe('EnrollmentPendingHandler', () => {
  let repo:    jest.Mocked<INotificationRepository>;
  let client:  jest.Mocked<UserServiceClient>;
  let handler: EnrollmentPendingHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    repo    = makeRepo();
    client  = makeClient();
    handler = new EnrollmentPendingHandler(repo, client);
  });

  it('creates an in-app notification for every admin', async () => {
    client.getAdminUids.mockResolvedValue(['admin1', 'admin2', 'admin3']);
    repo.create.mockResolvedValue(undefined);

    await handler.handle({ studentUid: 'uid1', courseId: 'c1' }, 'req-1');

    expect(repo.create).toHaveBeenCalledTimes(3);
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ type: 'enrollment.pending', userUid: 'admin1' }));
  });

  it('creates no notifications when no admins returned', async () => {
    client.getAdminUids.mockResolvedValue([]);
    await handler.handle({ studentUid: 'uid1', courseId: 'c1' }, 'req-1');
    expect(repo.create).not.toHaveBeenCalled();
  });
});
