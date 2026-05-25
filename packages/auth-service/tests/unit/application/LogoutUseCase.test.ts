import { LogoutUseCase } from '../../../src/application/use-cases/LogoutUseCase';

const authMock = { revokeRefreshTokens: jest.fn() };
jest.mock('firebase-admin/auth', () => ({ getAuth: () => authMock }));

describe('LogoutUseCase', () => {
  let useCase: LogoutUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new LogoutUseCase();
  });

  it('revokes refresh tokens for the given uid', async () => {
    authMock.revokeRefreshTokens.mockResolvedValue(undefined);
    await useCase.execute('uid-1');
    expect(authMock.revokeRefreshTokens).toHaveBeenCalledWith('uid-1');
  });

  it('propagates errors from Firebase Auth', async () => {
    authMock.revokeRefreshTokens.mockRejectedValue(new Error('Firebase unavailable'));
    await expect(useCase.execute('uid-1')).rejects.toThrow('Firebase unavailable');
  });

  it('resolves to undefined on success', async () => {
    authMock.revokeRefreshTokens.mockResolvedValue(undefined);
    const result = await useCase.execute('uid-99');
    expect(result).toBeUndefined();
  });
});
