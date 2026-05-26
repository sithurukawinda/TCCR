import { PromoteToAdminUseCase } from '../../../src/application/use-cases/PromoteToAdminUseCase';
import { IUserRepository }       from '../../../src/domain/repositories/IUserRepository';
import { FirebaseAuthClient }    from '../../../src/infrastructure/clients/FirebaseAuthClient';
import { OutboxEventPublisher }  from '@shared/events';
import { User }                  from '../../../src/domain/entities/User';

const makeUser = (overrides = {}): User =>
  new User({
    uid: 'uid-1', email: 'u@example.com', firstName: 'A', lastName: 'B',
    role: 'student', roles: ['student'], status: 'approved',
    profilePhotoUrl: null, createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z', deletedAt: null, ...overrides,
  });

const makeRepo = (): jest.Mocked<IUserRepository> => ({
  findById:    jest.fn(),
  findByEmail: jest.fn(),
  findAll:     jest.fn(),
  create:      jest.fn(),
  update:      jest.fn(),
  softDelete:  jest.fn(),
  hardDelete:  jest.fn(),
});

const makeAuthClient = (): jest.Mocked<FirebaseAuthClient> => ({
  createUser:      jest.fn(),
  setCustomClaims: jest.fn(),
  disableUser:     jest.fn(),
  enableUser:      jest.fn(),
  updatePassword:  jest.fn(),
  deleteUser:      jest.fn(),
  verifyPassword:  jest.fn(),
} as unknown as jest.Mocked<FirebaseAuthClient>);

const makeOutbox = (): jest.Mocked<OutboxEventPublisher> =>
  ({ publishWithBatch: jest.fn() } as unknown as jest.Mocked<OutboxEventPublisher>);

describe('PromoteToAdminUseCase', () => {
  let repo:       jest.Mocked<IUserRepository>;
  let authClient: jest.Mocked<FirebaseAuthClient>;
  let outbox:     jest.Mocked<OutboxEventPublisher>;
  let useCase:    PromoteToAdminUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo       = makeRepo();
    authClient = makeAuthClient();
    outbox     = makeOutbox();
    useCase    = new PromoteToAdminUseCase(repo, authClient, outbox);
  });

  it('promotes a student to admin and publishes admin.created event', async () => {
    repo.findById.mockResolvedValue(makeUser());
    authClient.setCustomClaims.mockResolvedValue(undefined);
    repo.update.mockResolvedValue(undefined);
    outbox.publishWithBatch.mockResolvedValue(undefined);

    const result = await useCase.execute({ uid: 'uid-1', actorUid: 'actor-1', requestId: 'req-1' });

    expect(result.role).toBe('admin');
    expect(result.roles).toEqual(['student', 'admin']);
    expect(authClient.setCustomClaims).toHaveBeenCalledWith('uid-1', { role: 'admin', roles: ['student', 'admin'] });
    expect(outbox.publishWithBatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'admin.created', payload: expect.objectContaining({ promoted: true }) }),
    );
  });

  it('throws 404 USER_NOT_FOUND when user does not exist', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(useCase.execute({ uid: 'uid-1', actorUid: 'actor-1', requestId: 'req-1' })).rejects.toMatchObject({
      status:    404,
      errorCode: 'USER_NOT_FOUND',
    });
  });

  it('throws 409 INVALID_ROLE when user is not a student', async () => {
    repo.findById.mockResolvedValue(makeUser({ role: 'admin' }));
    await expect(useCase.execute({ uid: 'uid-1', actorUid: 'actor-1', requestId: 'req-1' })).rejects.toMatchObject({
      status:    409,
      errorCode: 'INVALID_ROLE',
    });
    expect(authClient.setCustomClaims).not.toHaveBeenCalled();
  });

  it('propagates errors from outbox publish', async () => {
    repo.findById.mockResolvedValue(makeUser());
    authClient.setCustomClaims.mockResolvedValue(undefined);
    repo.update.mockResolvedValue(undefined);
    outbox.publishWithBatch.mockRejectedValue(new Error('Outbox error'));

    await expect(useCase.execute({ uid: 'uid-1', actorUid: 'actor-1', requestId: 'req-1' })).rejects.toThrow('Outbox error');
  });
});
