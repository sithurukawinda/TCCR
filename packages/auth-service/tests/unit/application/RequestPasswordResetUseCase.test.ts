import { RequestPasswordResetUseCase } from '../../../src/application/use-cases/RequestPasswordResetUseCase';
import { EmailClient }                from '../../../src/infrastructure/clients/EmailClient';

jest.mock('@shared/logger', () => ({ logger: { error: jest.fn(), info: jest.fn(), debug: jest.fn() } }));

const mockGenerateLink = jest.fn().mockResolvedValue('https://reset.link/abc123');
jest.mock('firebase-admin', () => ({
  auth: () => ({ generatePasswordResetLink: mockGenerateLink }),
}));

const makeEmailClient = (): jest.Mocked<Pick<EmailClient, 'sendPasswordResetEmail'>> => ({
  sendPasswordResetEmail: jest.fn(),
});

describe('RequestPasswordResetUseCase', () => {
  let emailClient: jest.Mocked<Pick<EmailClient, 'sendPasswordResetEmail'>>;
  let useCase:     RequestPasswordResetUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGenerateLink.mockResolvedValue('https://reset.link/abc123');
    emailClient = makeEmailClient();
    useCase     = new RequestPasswordResetUseCase(emailClient as unknown as EmailClient);
  });

  it('generates a Firebase reset link and sends it via email', async () => {
    emailClient.sendPasswordResetEmail.mockResolvedValue(undefined);

    await useCase.execute('user@example.com');

    expect(emailClient.sendPasswordResetEmail).toHaveBeenCalledWith(
      'user@example.com',
      'https://reset.link/abc123',
    );
  });

  it('does not throw when email delivery fails (prevents enumeration)', async () => {
    emailClient.sendPasswordResetEmail.mockRejectedValue(new Error('SMTP down'));

    await expect(useCase.execute('user@example.com')).resolves.toBeUndefined();
  });

  it('silently succeeds when Firebase cannot generate a link (user may not exist)', async () => {
    mockGenerateLink.mockRejectedValueOnce(new Error('user-not-found'));

    await expect(useCase.execute('nobody@example.com')).resolves.toBeUndefined();
    expect(emailClient.sendPasswordResetEmail).not.toHaveBeenCalled();
  });
});
