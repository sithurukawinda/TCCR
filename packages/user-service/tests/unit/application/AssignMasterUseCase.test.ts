import { AssignMasterUseCase }  from '../../../src/application/use-cases/AssignMasterUseCase';
import { IUserRepository }      from '../../../src/domain/repositories/IUserRepository';
import { FirebaseAuthClient }   from '../../../src/infrastructure/clients/FirebaseAuthClient';
import { OutboxEventPublisher } from '@shared/events';
import { User, UserRole }       from '../../../src/domain/entities/User';

const makeUser = (overrides = {}): User =>
  new User({
    uid: 'target-uid', email: 'member@example.com', firstName: 'Ali',
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
  ({ addRoleToUser: jest.fn() } as unknown as jest.Mocked<FirebaseAuthClient>);

const makeOutbox = (): jest.Mocked<OutboxEventPublisher> =>
  ({ publishWithBatch: jest.fn() } as unknown as jest.Mocked<OutboxEventPublisher>);

describe('AssignMasterUseCase', () => {
  let repo:       jest.Mocked<IUserRepository>;
  let authClient: jest.Mocked<FirebaseAuthClient>;
  let outbox:     jest.Mocked<OutboxEventPublisher>;
  let useCase:    AssignMasterUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo       = makeRepo();
    authClient = makeAuthClient();
    outbox     = makeOutbox();
    useCase    = new AssignMasterUseCase(repo, authClient, outbox);
  });

  it('assigns master role to an existing user when no active master exists', async () => {
    repo.findAll.mockResolvedValue({ items: [], nextCursor: null, total: 0 });
    repo.findById.mockResolvedValue(makeUser());
    repo.update.mockResolvedValue(undefined);
    authClient.addRoleToUser.mockResolvedValue(undefined);
    outbox.publishWithBatch.mockResolvedValue(undefined);

    const result = await useCase.execute('target-uid', 'caller-uid', 'req-1');

    expect(result.roles).toContain('master');
    expect(repo.update).toHaveBeenCalledWith(expect.objectContaining({ uid: 'target-uid' }));
    expect(authClient.addRoleToUser).toHaveBeenCalledWith('target-uid', 'master');
    expect(outbox.publishWithBatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'admin.created', payload: expect.objectContaining({ role: 'master', promoted: true }) }),
    );
  });

  it('throws 400 INVALID_TARGET when caller tries to assign master to themselves', async () => {
    await expect(useCase.execute('same-uid', 'same-uid', 'req-1')).rejects.toMatchObject({
      status:    400,
      errorCode: 'INVALID_TARGET',
    });
    expect(repo.findAll).not.toHaveBeenCalled();
  });

  it('throws 409 MASTER_ALREADY_EXISTS when an active master exists', async () => {
    const activeMaster = makeUser({ uid: 'other-master', roles: ['member', 'master'], status: 'approved' });
    repo.findAll.mockResolvedValue({ items: [activeMaster], nextCursor: null, total: 1 });

    await expect(useCase.execute('target-uid', 'caller-uid', 'req-1')).rejects.toMatchObject({
      status:    409,
      errorCode: 'MASTER_ALREADY_EXISTS',
    });
    expect(repo.findById).not.toHaveBeenCalled();
  });

  it('does not block assignment when existing master is suspended', async () => {
    const suspendedMaster = makeUser({ uid: 'old-master', roles: ['member', 'master'], status: 'suspended' });
    repo.findAll.mockResolvedValue({ items: [suspendedMaster], nextCursor: null, total: 1 });
    repo.findById.mockResolvedValue(makeUser());
    repo.update.mockResolvedValue(undefined);
    authClient.addRoleToUser.mockResolvedValue(undefined);
    outbox.publishWithBatch.mockResolvedValue(undefined);

    const result = await useCase.execute('target-uid', 'caller-uid', 'req-1');

    expect(result.roles).toContain('master');
  });

  it('throws 404 USER_NOT_FOUND when target user does not exist', async () => {
    repo.findAll.mockResolvedValue({ items: [], nextCursor: null, total: 0 });
    repo.findById.mockResolvedValue(null);

    await expect(useCase.execute('ghost-uid', 'caller-uid', 'req-1')).rejects.toMatchObject({
      status:    404,
      errorCode: 'USER_NOT_FOUND',
    });
    expect(authClient.addRoleToUser).not.toHaveBeenCalled();
  });

  it('throws 400 INVALID_TARGET when target holds the leader role', async () => {
    repo.findAll.mockResolvedValue({ items: [], nextCursor: null, total: 0 });
    repo.findById.mockResolvedValue(makeUser({ roles: ['member', 'leader'] as UserRole[] }));

    await expect(useCase.execute('target-uid', 'caller-uid', 'req-1')).rejects.toMatchObject({
      status:    400,
      errorCode: 'INVALID_TARGET',
    });
    expect(authClient.addRoleToUser).not.toHaveBeenCalled();
  });

  it('throws 400 INVALID_TARGET when target holds the admin role', async () => {
    repo.findAll.mockResolvedValue({ items: [], nextCursor: null, total: 0 });
    repo.findById.mockResolvedValue(makeUser({ roles: ['member', 'admin'] as UserRole[] }));

    await expect(useCase.execute('target-uid', 'caller-uid', 'req-1')).rejects.toMatchObject({
      status:    400,
      errorCode: 'INVALID_TARGET',
    });
    expect(authClient.addRoleToUser).not.toHaveBeenCalled();
  });

  it('allows assigning master to a student', async () => {
    repo.findAll.mockResolvedValue({ items: [], nextCursor: null, total: 0 });
    repo.findById.mockResolvedValue(makeUser({ roles: ['member', 'student'] as UserRole[] }));
    repo.update.mockResolvedValue(undefined);
    authClient.addRoleToUser.mockResolvedValue(undefined);
    outbox.publishWithBatch.mockResolvedValue(undefined);

    const result = await useCase.execute('target-uid', 'caller-uid', 'req-1');

    expect(result.roles).toContain('master');
  });

  it('allows assigning master to a g12 user', async () => {
    repo.findAll.mockResolvedValue({ items: [], nextCursor: null, total: 0 });
    repo.findById.mockResolvedValue(makeUser({ roles: ['member', 'student', 'g12'] as UserRole[] }));
    repo.update.mockResolvedValue(undefined);
    authClient.addRoleToUser.mockResolvedValue(undefined);
    outbox.publishWithBatch.mockResolvedValue(undefined);

    const result = await useCase.execute('target-uid', 'caller-uid', 'req-1');

    expect(result.roles).toContain('master');
  });
});
