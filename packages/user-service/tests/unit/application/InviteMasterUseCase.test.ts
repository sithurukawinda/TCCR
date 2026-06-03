import { InviteMasterUseCase }  from '../../../src/application/use-cases/InviteMasterUseCase';
import { IUserRepository }      from '../../../src/domain/repositories/IUserRepository';
import { FirebaseAuthClient }   from '../../../src/infrastructure/clients/FirebaseAuthClient';
import { OutboxEventPublisher } from '@shared/events';
import { User }                 from '../../../src/domain/entities/User';

const makeUser = (overrides = {}): User =>
  new User({
    uid: 'existing-uid', email: 'active@master.com', firstName: 'E',
    lastName: 'M', role: 'member', roles: ['member', 'master'], status: 'approved',
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

const makeAuthClient = (): jest.Mocked<FirebaseAuthClient> => ({
  createUser:              jest.fn(),
  setCustomClaims:         jest.fn(),
  generatePasswordResetLink: jest.fn(),
  deleteUser:              jest.fn(),
} as unknown as jest.Mocked<FirebaseAuthClient>);

const makeOutbox = (): jest.Mocked<OutboxEventPublisher> =>
  ({ publishWithBatch: jest.fn() } as unknown as jest.Mocked<OutboxEventPublisher>);

const INPUT = {
  firstName: 'John',
  lastName:  'Master',
  email:     'newmaster@example.com',
  initialPassword: 'Pass@1234',
};

describe('InviteMasterUseCase', () => {
  let repo:       jest.Mocked<IUserRepository>;
  let authClient: jest.Mocked<FirebaseAuthClient>;
  let outbox:     jest.Mocked<OutboxEventPublisher>;
  let useCase:    InviteMasterUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo       = makeRepo();
    authClient = makeAuthClient();
    outbox     = makeOutbox();
    useCase    = new InviteMasterUseCase(repo, authClient, outbox);
  });

  it('creates a new master user with member+master roles and publishes admin.created event', async () => {
    repo.findAll.mockResolvedValue({ items: [], nextCursor: null, total: 0 });
    repo.findByEmail.mockResolvedValue(null);
    authClient.createUser.mockResolvedValue('new-uid');
    authClient.setCustomClaims.mockResolvedValue(undefined);
    authClient.generatePasswordResetLink.mockResolvedValue('https://reset.link/token');
    repo.create.mockResolvedValue(undefined);
    outbox.publishWithBatch.mockResolvedValue(undefined);

    const result = await useCase.execute(INPUT, 'req-1');

    expect(result.roles).toEqual(['member', 'master']);
    expect(result.email).toBe(INPUT.email);
    expect(authClient.setCustomClaims).toHaveBeenCalledWith('new-uid', { role: 'member', roles: ['member', 'master'] });
    expect(repo.create).toHaveBeenCalled();
    expect(outbox.publishWithBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type:    'admin.created',
        payload: expect.objectContaining({ role: 'master', initialPassword: INPUT.initialPassword }),
      }),
    );
  });

  it('throws 409 MASTER_ALREADY_EXISTS when an active master exists', async () => {
    repo.findAll.mockResolvedValue({ items: [makeUser()], nextCursor: null, total: 1 });

    await expect(useCase.execute(INPUT, 'req-1')).rejects.toMatchObject({
      status:    409,
      errorCode: 'MASTER_ALREADY_EXISTS',
    });
    expect(authClient.createUser).not.toHaveBeenCalled();
  });

  it('throws 409 EMAIL_EXISTS when email is already registered', async () => {
    repo.findAll.mockResolvedValue({ items: [], nextCursor: null, total: 0 });
    repo.findByEmail.mockResolvedValue(makeUser({ email: INPUT.email }));

    await expect(useCase.execute(INPUT, 'req-1')).rejects.toMatchObject({
      status:    409,
      errorCode: 'EMAIL_EXISTS',
    });
    expect(authClient.createUser).not.toHaveBeenCalled();
  });

  it('deletes Firebase Auth user if Firestore create fails (cleanup on rollback)', async () => {
    repo.findAll.mockResolvedValue({ items: [], nextCursor: null, total: 0 });
    repo.findByEmail.mockResolvedValue(null);
    authClient.createUser.mockResolvedValue('new-uid');
    authClient.setCustomClaims.mockResolvedValue(undefined);
    authClient.generatePasswordResetLink.mockResolvedValue('https://reset.link/token');
    repo.create.mockRejectedValue(new Error('Firestore write failed'));
    authClient.deleteUser.mockResolvedValue(undefined);

    await expect(useCase.execute(INPUT, 'req-1')).rejects.toThrow('Firestore write failed');

    expect(authClient.deleteUser).toHaveBeenCalledWith('new-uid');
  });

  it('proceeds normally when generatePasswordResetLink fails (non-fatal)', async () => {
    repo.findAll.mockResolvedValue({ items: [], nextCursor: null, total: 0 });
    repo.findByEmail.mockResolvedValue(null);
    authClient.createUser.mockResolvedValue('new-uid');
    authClient.setCustomClaims.mockResolvedValue(undefined);
    authClient.generatePasswordResetLink.mockRejectedValue(new Error('emulator quirk'));
    repo.create.mockResolvedValue(undefined);
    outbox.publishWithBatch.mockResolvedValue(undefined);

    const result = await useCase.execute(INPUT, 'req-1');

    expect(result.roles).toContain('master');
    expect(outbox.publishWithBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ passwordResetUrl: null }),
      }),
    );
  });
});
