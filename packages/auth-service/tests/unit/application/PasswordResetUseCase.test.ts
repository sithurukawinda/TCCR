import { PasswordResetUseCase } from '../../../src/application/use-cases/PasswordResetUseCase';

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

describe('PasswordResetUseCase', () => {
  let useCase: PasswordResetUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
    useCase = new PasswordResetUseCase();
    mockFetch.mockResolvedValue({ ok: true });
  });

  it('calls Firebase Identity Toolkit sendOobCode with PASSWORD_RESET', async () => {
    await useCase.execute('user@example.com');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('accounts:sendOobCode'),
      expect.objectContaining({
        method: 'POST',
        body:   expect.stringContaining('"requestType":"PASSWORD_RESET"'),
      }),
    );
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ body: expect.stringContaining('"email":"user@example.com"') }),
    );
  });

  it('uses emulator URL when FIREBASE_AUTH_EMULATOR_HOST is set', async () => {
    process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
    useCase = new PasswordResetUseCase();

    await useCase.execute('user@example.com');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('127.0.0.1:9099'),
      expect.any(Object),
    );
  });

  it('uses production URL when no emulator host is set', async () => {
    await useCase.execute('user@example.com');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('identitytoolkit.googleapis.com'),
      expect.any(Object),
    );
    expect(mockFetch).not.toHaveBeenCalledWith(
      expect.stringContaining('127.0.0.1'),
      expect.any(Object),
    );
  });

  it('always resolves — never throws even when fetch fails', async () => {
    mockFetch.mockRejectedValue(new Error('network error'));

    await expect(useCase.execute('user@example.com')).resolves.toBeUndefined();
  });

  it('always resolves — never throws even when Firebase returns an error response', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 400 });

    await expect(useCase.execute('user@example.com')).resolves.toBeUndefined();
  });
});
