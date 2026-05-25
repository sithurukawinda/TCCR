import { RequestPasswordResetUseCase } from '../../../src/application/use-cases/RequestPasswordResetUseCase';
import { IOtpRepository, OtpRecord }  from '../../../src/infrastructure/repositories/FirestoreOtpRepository';
import { EmailClient }                from '../../../src/infrastructure/clients/EmailClient';

jest.mock('@shared/logger', () => ({ logger: { error: jest.fn(), info: jest.fn() } }));

const makeOtpRepo = (): jest.Mocked<IOtpRepository> => ({
  save:        jest.fn(),
  findByEmail: jest.fn(),
  delete:      jest.fn(),
});

const makeEmailClient = (): jest.Mocked<EmailClient> =>
  ({ sendOtp: jest.fn() } as unknown as jest.Mocked<EmailClient>);

describe('RequestPasswordResetUseCase', () => {
  let otpRepo:     jest.Mocked<IOtpRepository>;
  let emailClient: jest.Mocked<EmailClient>;
  let useCase:     RequestPasswordResetUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    otpRepo     = makeOtpRepo();
    emailClient = makeEmailClient();
    useCase     = new RequestPasswordResetUseCase(otpRepo, emailClient);
  });

  it('saves OTP and sends email on success', async () => {
    otpRepo.save.mockResolvedValue(undefined);
    emailClient.sendOtp.mockResolvedValue(undefined);

    await useCase.execute('user@example.com');

    expect(otpRepo.save).toHaveBeenCalledWith(
      expect.objectContaining<Partial<OtpRecord>>({
        email:    'user@example.com',
        attempts: 0,
      }),
    );
    expect(emailClient.sendOtp).toHaveBeenCalledWith('user@example.com', expect.stringMatching(/^\d{6}$/));
  });

  it('generates a 6-digit OTP stored in the repo', async () => {
    otpRepo.save.mockResolvedValue(undefined);
    emailClient.sendOtp.mockResolvedValue(undefined);

    await useCase.execute('other@example.com');

    const saved = otpRepo.save.mock.calls[0][0] as OtpRecord;
    expect(saved.otp).toMatch(/^\d{6}$/);
    expect(saved.attempts).toBe(0);
    expect(saved.expiresAt).toBeTruthy();
  });

  it('does not throw when email delivery fails (prevents enumeration)', async () => {
    otpRepo.save.mockResolvedValue(undefined);
    emailClient.sendOtp.mockRejectedValue(new Error('SMTP down'));

    await expect(useCase.execute('user@example.com')).resolves.toBeUndefined();
    expect(otpRepo.save).toHaveBeenCalledTimes(1);
  });

  it('propagates errors from OTP repo save', async () => {
    otpRepo.save.mockRejectedValue(new Error('Firestore unavailable'));
    await expect(useCase.execute('user@example.com')).rejects.toThrow('Firestore unavailable');
  });
});
