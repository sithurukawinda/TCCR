import { TrackLoginAttemptsUseCase }       from '../../../src/application/use-cases/TrackLoginAttemptsUseCase';
import { ILoginAttemptsRepository }        from '../../../src/infrastructure/repositories/FirestoreLoginAttemptsRepository';

const authMock = {
  getUserByEmail: jest.fn().mockResolvedValue({ uid: 'uid-1' }),
  updateUser:     jest.fn().mockResolvedValue(undefined),
};
jest.mock('firebase-admin/auth', () => ({ getAuth: () => authMock }));

const makeRepo = (): jest.Mocked<ILoginAttemptsRepository> => ({
  findByEmail: jest.fn(),
  save:        jest.fn(),
});

const FRESH_WINDOW = new Date(Date.now() - 60_000).toISOString(); // 1 min ago
const OLD_WINDOW   = new Date(Date.now() - 20 * 60_000).toISOString(); // 20 min ago (expired)

describe('TrackLoginAttemptsUseCase', () => {
  let repo:    jest.Mocked<ILoginAttemptsRepository>;
  let useCase: TrackLoginAttemptsUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo    = makeRepo();
    useCase = new TrackLoginAttemptsUseCase(repo);
  });

  it('returns locked=false and increments count below threshold', async () => {
    repo.findByEmail.mockResolvedValue({ email: 'a@b.com', attempts: 5, windowStart: FRESH_WINDOW });
    repo.save.mockResolvedValue(undefined);

    const result = await useCase.execute('a@b.com');

    expect(result.locked).toBe(false);
    expect(result.attempts).toBe(6);
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ attempts: 6 }));
  });

  it('locks account and disables Firebase user on 10th attempt', async () => {
    repo.findByEmail.mockResolvedValue({ email: 'a@b.com', attempts: 9, windowStart: FRESH_WINDOW });
    repo.save.mockResolvedValue(undefined);

    const result = await useCase.execute('a@b.com');

    expect(result.locked).toBe(true);
    expect(result.attempts).toBe(10);
    expect(authMock.updateUser).toHaveBeenCalledWith('uid-1', { disabled: true });
  });

  it('resets counter when window has expired', async () => {
    repo.findByEmail.mockResolvedValue({ email: 'a@b.com', attempts: 9, windowStart: OLD_WINDOW });
    repo.save.mockResolvedValue(undefined);

    const result = await useCase.execute('a@b.com');

    expect(result.locked).toBe(false);
    expect(result.attempts).toBe(1);
  });

  it('starts fresh counter when no previous record exists', async () => {
    repo.findByEmail.mockResolvedValue(null);
    repo.save.mockResolvedValue(undefined);

    const result = await useCase.execute('new@b.com');

    expect(result.locked).toBe(false);
    expect(result.attempts).toBe(1);
  });
});
