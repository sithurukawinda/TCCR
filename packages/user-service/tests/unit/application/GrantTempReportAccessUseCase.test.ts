import { GrantTempReportAccessUseCase } from '../../../src/application/use-cases/GrantTempReportAccessUseCase';
import { IUserRepository }              from '../../../src/domain/repositories/IUserRepository';
import { FirebaseAuthClient }           from '../../../src/infrastructure/clients/FirebaseAuthClient';
import { User }                         from '../../../src/domain/entities/User';

const makeUser = (overrides = {}): User =>
  new User({
    uid: 'uid-1', email: 'member@example.com', firstName: 'A',
    lastName: 'B', role: 'member', roles: ['member'], status: 'approved',
    profilePhotoUrl: null, createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z', deletedAt: null, ...overrides,
  });

const makeRepo = (): jest.Mocked<IUserRepository> => ({
  findById:        jest.fn(),
  findByEmail:     jest.fn(),
  findAll:         jest.fn(),
  create:          jest.fn(),
  update:          jest.fn(),
  softDelete:      jest.fn(),
  hardDelete:      jest.fn(),
  atomicAddRole:   jest.fn(),
  atomicRemoveRole: jest.fn(),
});

const makeAuthClient = (): jest.Mocked<FirebaseAuthClient> =>
  ({ setTempReportAccess: jest.fn() } as unknown as jest.Mocked<FirebaseAuthClient>);

describe('GrantTempReportAccessUseCase', () => {
  let repo:       jest.Mocked<IUserRepository>;
  let authClient: jest.Mocked<FirebaseAuthClient>;
  let useCase:    GrantTempReportAccessUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo       = makeRepo();
    authClient = makeAuthClient();
    useCase    = new GrantTempReportAccessUseCase(repo, authClient);
  });

  it('sets tempReportAccess=true on user and updates Firebase custom claims', async () => {
    repo.findById.mockResolvedValue(makeUser());
    repo.update.mockResolvedValue(undefined);
    authClient.setTempReportAccess.mockResolvedValue(undefined);

    const result = await useCase.execute('uid-1');

    expect(result.tempReportAccess).toBe(true);
    expect(repo.update).toHaveBeenCalledWith(expect.objectContaining({ tempReportAccess: true }));
    expect(authClient.setTempReportAccess).toHaveBeenCalledWith('uid-1', true);
  });

  it('throws 404 USER_NOT_FOUND when user does not exist', async () => {
    repo.findById.mockResolvedValue(null);

    await expect(useCase.execute('ghost-uid')).rejects.toMatchObject({
      status:    404,
      errorCode: 'USER_NOT_FOUND',
    });
    expect(authClient.setTempReportAccess).not.toHaveBeenCalled();
  });

  it('throws 400 ALREADY_MASTER when the user already has the master role', async () => {
    repo.findById.mockResolvedValue(makeUser({ roles: ['member', 'master'] }));

    await expect(useCase.execute('uid-1')).rejects.toMatchObject({
      status:    400,
      errorCode: 'ALREADY_MASTER',
    });
    expect(authClient.setTempReportAccess).not.toHaveBeenCalled();
  });
});
