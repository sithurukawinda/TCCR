import { ReactivateMasterUseCase } from '../../../src/application/use-cases/ReactivateMasterUseCase';
import { IUserRepository }         from '../../../src/domain/repositories/IUserRepository';
import { FirebaseAuthClient }      from '../../../src/infrastructure/clients/FirebaseAuthClient';
import { User }                    from '../../../src/domain/entities/User';

const makeUser = (overrides = {}): User =>
  new User({
    uid: 'master-uid', email: 'master@example.com', firstName: 'M',
    lastName: 'U', role: 'member', roles: ['member', 'master'], status: 'suspended',
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
  ({ enableUser: jest.fn() } as unknown as jest.Mocked<FirebaseAuthClient>);

describe('ReactivateMasterUseCase', () => {
  let repo:       jest.Mocked<IUserRepository>;
  let authClient: jest.Mocked<FirebaseAuthClient>;
  let useCase:    ReactivateMasterUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo       = makeRepo();
    authClient = makeAuthClient();
    useCase    = new ReactivateMasterUseCase(repo, authClient);
  });

  it('reactivates a suspended master and re-enables Firebase Auth account', async () => {
    repo.findById.mockResolvedValue(makeUser());
    repo.findAll.mockResolvedValue({ items: [makeUser()], nextCursor: null, total: 1 });
    repo.update.mockResolvedValue(undefined);
    authClient.enableUser.mockResolvedValue(undefined);

    const result = await useCase.execute('master-uid');

    expect(result.status).toBe('approved');
    expect(repo.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'approved' }));
    expect(authClient.enableUser).toHaveBeenCalledWith('master-uid');
  });

  it('throws 404 USER_NOT_FOUND when user does not exist', async () => {
    repo.findById.mockResolvedValue(null);

    await expect(useCase.execute('ghost-uid')).rejects.toMatchObject({
      status:    404,
      errorCode: 'USER_NOT_FOUND',
    });
    expect(authClient.enableUser).not.toHaveBeenCalled();
  });

  it('throws 404 USER_NOT_FOUND when user does not have the master role', async () => {
    repo.findById.mockResolvedValue(makeUser({ roles: ['member'] }));

    await expect(useCase.execute('master-uid')).rejects.toMatchObject({
      status:    404,
      errorCode: 'USER_NOT_FOUND',
    });
    expect(authClient.enableUser).not.toHaveBeenCalled();
  });

  it('throws 409 NOT_SUSPENDED when master is already active', async () => {
    repo.findById.mockResolvedValue(makeUser({ status: 'approved' }));

    await expect(useCase.execute('master-uid')).rejects.toMatchObject({
      status:    409,
      errorCode: 'NOT_SUSPENDED',
    });
    expect(repo.findAll).not.toHaveBeenCalled();
  });

  it('throws 409 MASTER_ALREADY_EXISTS when another active master exists', async () => {
    repo.findById.mockResolvedValue(makeUser()); // suspended target
    const otherActive = makeUser({ uid: 'other-uid', status: 'approved' });
    repo.findAll.mockResolvedValue({ items: [makeUser(), otherActive], nextCursor: null, total: 2 });

    await expect(useCase.execute('master-uid')).rejects.toMatchObject({
      status:    409,
      errorCode: 'MASTER_ALREADY_EXISTS',
    });
    expect(authClient.enableUser).not.toHaveBeenCalled();
  });
});
