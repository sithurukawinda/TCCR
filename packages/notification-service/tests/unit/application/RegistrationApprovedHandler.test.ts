import { RegistrationApprovedHandler } from '../../../src/application/handlers/RegistrationApprovedHandler';
import { INotificationRepository }     from '../../../src/domain/repositories/INotificationRepository';
import { NotificationDispatcher }      from '../../../src/application/services/NotificationDispatcher';

const makeRepo       = (): jest.Mocked<INotificationRepository> =>
  ({ findByUser: jest.fn(), create: jest.fn(), markRead: jest.fn(), markAllRead: jest.fn() });
const makeDispatcher = (): jest.Mocked<NotificationDispatcher> =>
  ({ dispatchEmail: jest.fn(), dispatchPush: jest.fn() } as unknown as jest.Mocked<NotificationDispatcher>);

const PAYLOAD = { studentUid: 'uid1', email: 'student@test.com' };

describe('RegistrationApprovedHandler', () => {
  let repo:       jest.Mocked<INotificationRepository>;
  let dispatcher: jest.Mocked<NotificationDispatcher>;
  let handler:    RegistrationApprovedHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    repo       = makeRepo();
    dispatcher = makeDispatcher();
    handler    = new RegistrationApprovedHandler(repo, dispatcher);
  });

  it('creates in-app notification and dispatches email', async () => {
    repo.create.mockResolvedValue(undefined);
    dispatcher.dispatchEmail.mockResolvedValue(undefined);

    await handler.handle(PAYLOAD, 'req-1');

    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ type: 'registration.approved', userUid: 'uid1' }));
    expect(dispatcher.dispatchEmail).toHaveBeenCalledWith(PAYLOAD.email, expect.any(String), expect.any(String), 'req-1');
  });

  it('does not throw when email dispatch fails', async () => {
    repo.create.mockResolvedValue(undefined);
    dispatcher.dispatchEmail.mockResolvedValue(undefined); // dispatcher swallows errors

    await expect(handler.handle(PAYLOAD, 'req-1')).resolves.toBeUndefined();
  });
});
