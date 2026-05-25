import { PromoteMemberUseCase } from '../../../src/application/use-cases/PromoteMemberUseCase';
import { IUserRepository }      from '../../../src/domain/repositories/IUserRepository';
import { FirebaseAuthClient }   from '../../../src/infrastructure/clients/FirebaseAuthClient';
import { OutboxEventPublisher } from '@shared/events';
import { User, UserRole }       from '../../../src/domain/entities/User';

const makeUser = (overrides: Partial<ConstructorParameters<typeof User>[0]> = {}) =>
  new User({
    uid:             'target-uid',
    email:           'member@test.com',
    firstName:       'Test',
    lastName:        'Member',
    role:            'member',
    roles:           ['member'],
    status:          'approved',
    profilePhotoUrl: null,
    createdAt:       '2026-01-01T00:00:00.000Z',
    updatedAt:       '2026-01-01T00:00:00.000Z',
    deletedAt:       null,
    ...overrides,
  });

const makeRepo = (): jest.Mocked<IUserRepository> => ({
  findById:    jest.fn(),
  findByEmail: jest.fn(),
  findAll:     jest.fn(),
  create:      jest.fn(),
  update:      jest.fn(),
  softDelete:  jest.fn(),
});

const makeAuthClient = (): jest.Mocked<FirebaseAuthClient> =>
  ({ addRoleToUser: jest.fn() } as unknown as jest.Mocked<FirebaseAuthClient>);

const makeOutbox = (): jest.Mocked<OutboxEventPublisher> =>
  ({ publishWithBatch: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<OutboxEventPublisher>);

const BASE_INPUT = {
  targetUid:   'target-uid',
  callerUid:   'g12-uid',
  callerRoles: ['member', 'g12'] as UserRole[],
  requestId:   'req-1',
};

describe('PromoteMemberUseCase', () => {
  let repo:       jest.Mocked<IUserRepository>;
  let authClient: jest.Mocked<FirebaseAuthClient>;
  let outbox:     jest.Mocked<OutboxEventPublisher>;
  let useCase:    PromoteMemberUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo       = makeRepo();
    authClient = makeAuthClient();
    outbox     = makeOutbox();
    useCase    = new PromoteMemberUseCase(repo, authClient, outbox);
  });

  // ── happy paths ────────────────────────────────────────────────────────────

  it('promotes a member to leader and publishes audit event', async () => {
    const user = makeUser();
    repo.findById.mockResolvedValue(user);
    repo.update.mockResolvedValue(undefined);
    authClient.addRoleToUser.mockResolvedValue(undefined);

    await useCase.execute({ ...BASE_INPUT, role: 'leader' });

    expect(repo.update).toHaveBeenCalledWith(expect.objectContaining({
      roles: expect.arrayContaining(['member', 'leader']),
    }));
    expect(authClient.addRoleToUser).toHaveBeenCalledWith('target-uid', 'leader');
    expect(outbox.publishWithBatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'audit.action', payload: expect.objectContaining({ action: 'PROMOTE_TO_LEADER' }) }),
    );
  });

  it('promotes a member to g12 and publishes audit event', async () => {
    const user = makeUser();
    repo.findById.mockResolvedValue(user);
    repo.update.mockResolvedValue(undefined);
    authClient.addRoleToUser.mockResolvedValue(undefined);

    await useCase.execute({ ...BASE_INPUT, role: 'g12' });

    expect(repo.update).toHaveBeenCalledWith(expect.objectContaining({
      roles: expect.arrayContaining(['member', 'g12']),
    }));
    expect(authClient.addRoleToUser).toHaveBeenCalledWith('target-uid', 'g12');
    expect(outbox.publishWithBatch).toHaveBeenCalledWith(
      expect.objectContaining({ payload: expect.objectContaining({ action: 'PROMOTE_TO_G12' }) }),
    );
  });

  it('promotes a leader to g12', async () => {
    const user = makeUser({ role: 'leader', roles: ['member', 'leader'] });
    repo.findById.mockResolvedValue(user);
    repo.update.mockResolvedValue(undefined);
    authClient.addRoleToUser.mockResolvedValue(undefined);

    await useCase.execute({ ...BASE_INPUT, role: 'g12' });

    expect(repo.update).toHaveBeenCalledWith(expect.objectContaining({
      roles: expect.arrayContaining(['member', 'leader', 'g12']),
    }));
  });

  it('is idempotent — does nothing if user already has the role', async () => {
    const user = makeUser({ role: 'leader', roles: ['member', 'leader'] });
    repo.findById.mockResolvedValue(user);

    await useCase.execute({ ...BASE_INPUT, role: 'leader' });

    expect(repo.update).not.toHaveBeenCalled();
    expect(authClient.addRoleToUser).not.toHaveBeenCalled();
    expect(outbox.publishWithBatch).not.toHaveBeenCalled();
  });

  // ── error cases ────────────────────────────────────────────────────────────

  it('throws 404 when target user does not exist', async () => {
    repo.findById.mockResolvedValue(null);

    await expect(useCase.execute({ ...BASE_INPUT, role: 'leader' }))
      .rejects.toMatchObject({ status: 404, errorCode: 'USER_NOT_FOUND' });
  });

  it('throws 403 when target user is an admin', async () => {
    const user = makeUser({ role: 'admin', roles: ['admin'] });
    repo.findById.mockResolvedValue(user);

    await expect(useCase.execute({ ...BASE_INPUT, role: 'leader' }))
      .rejects.toMatchObject({ status: 403, errorCode: 'FORBIDDEN' });
  });

  it('throws 403 when target user is a super_admin', async () => {
    const user = makeUser({ role: 'super_admin', roles: ['super_admin'] });
    repo.findById.mockResolvedValue(user);

    await expect(useCase.execute({ ...BASE_INPUT, role: 'g12' }))
      .rejects.toMatchObject({ status: 403, errorCode: 'FORBIDDEN' });
  });

  it('throws 403 when role is not leader or g12 (defence-in-depth)', async () => {
    const user = makeUser();
    repo.findById.mockResolvedValue(user);

    await expect(useCase.execute({ ...BASE_INPUT, role: 'student' as 'leader' }))
      .rejects.toMatchObject({ status: 403, errorCode: 'FORBIDDEN' });
  });

  // ── leader caller restrictions ─────────────────────────────────────────────

  it('allows a leader caller to promote a member to g12', async () => {
    const user   = makeUser();
    const leader = { ...BASE_INPUT, callerRoles: ['member', 'leader'] as UserRole[] };
    repo.findById.mockResolvedValue(user);
    repo.update.mockResolvedValue(undefined);
    authClient.addRoleToUser.mockResolvedValue(undefined);

    await useCase.execute({ ...leader, role: 'g12' });

    expect(repo.update).toHaveBeenCalledWith(expect.objectContaining({
      roles: expect.arrayContaining(['member', 'g12']),
    }));
    expect(authClient.addRoleToUser).toHaveBeenCalledWith('target-uid', 'g12');
  });

  it('throws 403 when a leader caller tries to promote to leader (not allowed)', async () => {
    const user   = makeUser();
    const leader = { ...BASE_INPUT, callerRoles: ['member', 'leader'] as UserRole[] };
    repo.findById.mockResolvedValue(user);

    await expect(useCase.execute({ ...leader, role: 'leader' }))
      .rejects.toMatchObject({ status: 403, errorCode: 'FORBIDDEN' });
  });
});
