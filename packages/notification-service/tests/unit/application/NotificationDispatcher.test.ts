import { NotificationDispatcher } from '../../../src/application/services/NotificationDispatcher';
import { EmailClient }             from '../../../src/infrastructure/clients/EmailClient';
import { FcmClient }               from '../../../src/infrastructure/clients/FcmClient';

const makeEmail = (): jest.Mocked<EmailClient> =>
  ({ sendMail: jest.fn() } as unknown as jest.Mocked<EmailClient>);
const makeFcm   = (): jest.Mocked<FcmClient>   =>
  ({ sendPush: jest.fn() } as unknown as jest.Mocked<FcmClient>);

describe('NotificationDispatcher', () => {
  let email:      jest.Mocked<EmailClient>;
  let fcm:        jest.Mocked<FcmClient>;
  let dispatcher: NotificationDispatcher;

  beforeEach(() => {
    jest.clearAllMocks();
    email      = makeEmail();
    fcm        = makeFcm();
    dispatcher = new NotificationDispatcher(email, fcm);
    jest.useFakeTimers();
  });

  afterEach(() => jest.useRealTimers());

  it('sends email on first try', async () => {
    email.sendMail.mockResolvedValue(undefined);
    await dispatcher.dispatchEmail('a@b.com', 'Subject', '<p>body</p>', 'req-1');
    expect(email.sendMail).toHaveBeenCalledTimes(1);
  });

  it('retries up to 3 times on failure then logs error without throwing', async () => {
    email.sendMail.mockRejectedValue(new Error('SMTP down'));

    const promise = dispatcher.dispatchEmail('a@b.com', 'Subject', '<p>body</p>', 'req-1');
    await jest.runAllTimersAsync();
    await promise;

    expect(email.sendMail).toHaveBeenCalledTimes(3);
    // Promise resolves (no throw)
  });

  it('logs warn on push failure without throwing', async () => {
    fcm.sendPush.mockRejectedValue(new Error('FCM error'));
    await expect(dispatcher.dispatchPush('token', 'Title', 'body')).resolves.toBeUndefined();
    expect(fcm.sendPush).toHaveBeenCalledTimes(1);
  });
});
