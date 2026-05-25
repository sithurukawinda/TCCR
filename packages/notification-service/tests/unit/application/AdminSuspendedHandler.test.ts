import { AdminSuspendedHandler }     from '../../../src/application/handlers/AdminSuspendedHandler';
import { INotificationRepository }  from '../../../src/domain/repositories/INotificationRepository';
import { NotificationDispatcher }   from '../../../src/application/services/NotificationDispatcher';

const makeRepo = (): jest.Mocked<INotificationRepository> =>
  ({ findByUser: jest.fn(), create: jest.fn(), markRead: jest.fn(), markAllRead: jest.fn() });

const makeDispatcher = (): jest.Mocked<NotificationDispatcher> =>
  ({ dispatchEmail: jest.fn(), dispatchPush: jest.fn() } as unknown as jest.Mocked<NotificationDispatcher>);

const PAYLOAD = { uid: 'uid-1', email: 'admin@example.com', firstName: 'John', lastName: 'Doe' };

describe('AdminSuspendedHandler', () => {
  let repo:       jest.Mocked<INotificationRepository>;
  let dispatcher: jest.Mocked<NotificationDispatcher>;
  let handler:    AdminSuspendedHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    repo       = makeRepo();
    dispatcher = makeDispatcher();
    handler    = new AdminSuspendedHandler(repo, dispatcher);
  });

  it('creates in-app notification for the suspended admin', async () => {
    repo.create.mockResolvedValue(undefined);
    dispatcher.dispatchEmail.mockResolvedValue(undefined);

    await handler.handle(PAYLOAD, 'req-1');

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'admin.suspended', userUid: 'uid-1' }),
    );
  });

  it('sends suspension email to the admin', async () => {
    repo.create.mockResolvedValue(undefined);
    dispatcher.dispatchEmail.mockResolvedValue(undefined);

    await handler.handle(PAYLOAD, 'req-1');

    expect(dispatcher.dispatchEmail).toHaveBeenCalledWith(
      'admin@example.com',
      expect.stringContaining('Account Suspended'),
      expect.any(String),
      'req-1',
    );
  });

  it('propagates errors from repo.create', async () => {
    repo.create.mockRejectedValue(new Error('DB error'));
    await expect(handler.handle(PAYLOAD, 'req-1')).rejects.toThrow('DB error');
  });
});
