import { VerifyOtpAndResetUseCase } from '../../../src/application/use-cases/VerifyOtpAndResetUseCase';
import { IOtpRepository, OtpRecord } from '../../../src/infrastructure/repositories/FirestoreOtpRepository';

jest.mock('../../../src/config', () => ({ config: { firebaseWebApiKey: 'test-key' } }));

global.fetch = jest.fn().mockResolvedValue({ ok: true });

const makeOtpRepo = (): jest.Mocked<IOtpRepository> => ({
  save:        jest.fn(),
  findByEmail: jest.fn(),
  delete:      jest.fn(),
});

const makeRecord = (overrides: Partial<OtpRecord> = {}): OtpRecord => ({
  email:     'user@example.com',
  otp:       '123456',
  expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  attempts:  0,
  ...overrides,
});

describe('VerifyOtpAndResetUseCase', () => {
  let otpRepo: jest.Mocked<IOtpRepository>;
  let useCase: VerifyOtpAndResetUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
    otpRepo = makeOtpRepo();
    useCase = new VerifyOtpAndResetUseCase(otpRepo);
  });

  it('deletes OTP and fires Firebase reset email on correct OTP', async () => {
    otpRepo.findByEmail.mockResolvedValue(makeRecord());
    otpRepo.delete.mockResolvedValue(undefined);

    await useCase.execute('user@example.com', '123456');

    expect(otpRepo.delete).toHaveBeenCalledWith('user@example.com');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('accounts:sendOobCode'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('throws 400 INVALID_OTP when no record exists', async () => {
    otpRepo.findByEmail.mockResolvedValue(null);
    await expect(useCase.execute('user@example.com', '000000')).rejects.toMatchObject({
      status:    400,
      errorCode: 'INVALID_OTP',
    });
  });

  it('throws 400 OTP_EXPIRED and deletes record when OTP is expired', async () => {
    const expired = makeRecord({ expiresAt: new Date(Date.now() - 1000).toISOString() });
    otpRepo.findByEmail.mockResolvedValue(expired);
    otpRepo.delete.mockResolvedValue(undefined);

    await expect(useCase.execute('user@example.com', '123456')).rejects.toMatchObject({
      status:    400,
      errorCode: 'OTP_EXPIRED',
    });
    expect(otpRepo.delete).toHaveBeenCalledWith('user@example.com');
  });

  it('throws 400 OTP_MAX_ATTEMPTS and deletes record when attempts >= 5', async () => {
    otpRepo.findByEmail.mockResolvedValue(makeRecord({ attempts: 5 }));
    otpRepo.delete.mockResolvedValue(undefined);

    await expect(useCase.execute('user@example.com', '123456')).rejects.toMatchObject({
      status:    400,
      errorCode: 'OTP_MAX_ATTEMPTS',
    });
    expect(otpRepo.delete).toHaveBeenCalledWith('user@example.com');
  });

  it('throws 400 INVALID_OTP and increments attempts on wrong code', async () => {
    otpRepo.findByEmail.mockResolvedValue(makeRecord({ attempts: 2 }));
    otpRepo.save.mockResolvedValue(undefined);

    await expect(useCase.execute('user@example.com', 'wrong')).rejects.toMatchObject({
      status:    400,
      errorCode: 'INVALID_OTP',
    });
    expect(otpRepo.save).toHaveBeenCalledWith(expect.objectContaining({ attempts: 3 }));
  });
});
