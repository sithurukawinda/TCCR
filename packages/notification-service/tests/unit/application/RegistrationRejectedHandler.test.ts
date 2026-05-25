import { RegistrationRejectedHandler } from '../../../src/application/handlers/RegistrationRejectedHandler';
import { INotificationRepository }    from '../../../src/domain/repositories/INotificationRepository';
import { NotificationDispatcher }     from '../../../src/application/services/NotificationDispatcher';

const makeRepo = (): jest.Mocked<INotificationRepository> =>
  ({ findByUser: jest.fn(), create: jest.fn(), markRead: jest.fn(), markAllRead: jest.fn() });

const makeDispatcher = (): jest.Mocked<NotificationDispatcher> =>
  ({ dispatchEmail: jest.fn(), dispatchPush: jest.fn() } as unknown as jest.Mocked<NotificationDispatcher>);

describe('RegistrationRejectedHandler', () => {
  let repo:       jest.Mocked<INotificationRepository>;
  let dispatcher: jest.Mocked<NotificationDispatcher>;
  let handler:    RegistrationRejectedHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    repo       = makeRepo();
    dispatcher = makeDispatcher();
    handler    = new RegistrationRejectedHandler(repo, dispatcher);
  });

  it('creates in-app notification and sends rejection email with reason', async () => {
    repo.create.mockResolvedValue(undefined);
    dispatcher.dispatchEmail.mockResolvedValue(undefined);

    await handler.handle({ studentUid: 'uid-1', email: 'u@example.com', reason: 'Incomplete docs' }, 'req-1');

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'registration.rejected', userUid: 'uid-1', body: expect.stringContaining('Incomplete docs') }),
    );
    expect(dispatcher.dispatchEmail).toHaveBeenCalledWith(
      'u@example.com',
      expect.stringContaining('Registration Update'),
      expect.stringContaining('Incomplete docs'),
      'req-1',
    );
  });

  it('creates in-app notification without reason text when reason is null', async () => {
    repo.create.mockResolvedValue(undefined);
    dispatcher.dispatchEmail.mockResolvedValue(undefined);

    await handler.handle({ studentUid: 'uid-1', email: 'u@example.com', reason: null }, 'req-1');

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ body: 'Your registration was not approved.' }),
    );
  });

  it('propagates errors from repo.create', async () => {
    repo.create.mockRejectedValue(new Error('DB error'));
    await expect(handler.handle({ studentUid: 'uid-1', email: 'u@example.com', reason: null }, 'req-1')).rejects.toThrow('DB error');
  });
});
