import { CreateRoleRequestUseCase, CreateRoleRequestInput } from '../../../src/application/use-cases/CreateRoleRequestUseCase';
import { IRoleRequestRepository }                          from '../../../src/domain/repositories/IRoleRequestRepository';
import { UserServiceClient }                               from '../../../src/infrastructure/clients/UserServiceClient';
import { OutboxEventPublisher }                            from '@shared/events';

// ─── helpers ────────────────────────────────────────────────────────────────

const makeRepo = (): jest.Mocked<IRoleRequestRepository> => ({
  findById:                jest.fn(),
  findPendingByRequester:  jest.fn(),
  findApprovedByRequester: jest.fn(),
  findByRequester:         jest.fn(),
  findAll:                 jest.fn(),
  create:                  jest.fn(),
  createUnique:            jest.fn(),
  update:                  jest.fn(),
  releaseSlot:             jest.fn(),
});

const makeOutbox = (): jest.Mocked<OutboxEventPublisher> =>
  ({ publishWithBatch: jest.fn() } as unknown as jest.Mocked<OutboxEventPublisher>);

const makeUserClient = (): jest.Mocked<UserServiceClient> =>
  ({ getUser: jest.fn(), approveUser: jest.fn(), addRole: jest.fn() } as unknown as jest.Mocked<UserServiceClient>);

const mockProfile = {
  email:              'john@example.com',
  firstName:          'John',
  lastName:           'Doe',
  phoneNumber:        '+94771234567',
  dateOfBirth:        '2000-06-15',
  gender:             'male',
  address:            '123 Main St, Colombo',
  qualificationTitle: 'BSc Computer Science',
  qualificationUrl:   'https://storage.example.com/qual.pdf',
};

const validInput: CreateRoleRequestInput = { requesterUid: 'uid-1', requestedRole: 'student', callerRoles: ['member'] as string[] };
const validInputLeader: CreateRoleRequestInput = { requesterUid: 'uid-2', requestedRole: 'leader', callerRoles: ['member', 'student'] as string[] };
const validInputG12: CreateRoleRequestInput    = { requesterUid: 'uid-3', requestedRole: 'g12',    callerRoles: ['member', 'student', 'leader'] as string[] };

// ─── tests ───────────────────────────────────────────────────────────────────

describe('CreateRoleRequestUseCase', () => {
  let repo:       jest.Mocked<IRoleRequestRepository>;
  let outbox:     jest.Mocked<OutboxEventPublisher>;
  let userClient: jest.Mocked<UserServiceClient>;
  let useCase:    CreateRoleRequestUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo       = makeRepo();
    outbox     = makeOutbox();
    userClient = makeUserClient();
    useCase    = new CreateRoleRequestUseCase(repo, outbox, userClient);
  });

  // ── happy path ──────────────────────────────────────────────────────────────

  it('creates a pending role request with profile snapshot from user-service', async () => {
    userClient.getUser.mockResolvedValue(mockProfile);
    repo.createUnique.mockResolvedValue(undefined);
    outbox.publishWithBatch.mockResolvedValue(undefined);

    const result = await useCase.execute(validInput, 'req-id-1');

    expect(result.requesterUid).toBe('uid-1');
    expect(result.requestedRole).toBe('student');
    expect(result.status).toBe('pending');
    expect(result.applicantProfile.firstName).toBe('John');
    expect(result.applicantProfile.lastName).toBe('Doe');
    expect(result.applicantProfile.phoneNumber).toBe('+94771234567');
    expect(result.applicantProfile.email).toBe('john@example.com');
    expect(result.applicantProfile.dateOfBirth).toBe('2000-06-15');
    expect(result.applicantProfile.gender).toBe('male');
    expect(result.applicantProfile.address).toBe('123 Main St, Colombo');
    expect(result.applicantProfile.qualificationTitle).toBe('BSc Computer Science');
    expect(result.applicantProfile.qualificationUrl).toBe('https://storage.example.com/qual.pdf');
    expect(result.qualificationTitle).toBe('BSc Computer Science');
    expect(result.qualificationStoragePath).toBeNull();
  });

  it('sets generated UUID as id', async () => {
    userClient.getUser.mockResolvedValue(mockProfile);
    repo.createUnique.mockResolvedValue(undefined);
    outbox.publishWithBatch.mockResolvedValue(undefined);

    const r1 = await useCase.execute(validInput, 'x');
    const r2 = await useCase.execute({ ...validInput, requesterUid: 'uid-2' }, 'y');

    expect(r1.id).toBeDefined();
    expect(r1.id).not.toBe(r2.id);
  });

  it('persists via createUnique and publishes role.requested event', async () => {
    userClient.getUser.mockResolvedValue(mockProfile);
    repo.createUnique.mockResolvedValue(undefined);
    outbox.publishWithBatch.mockResolvedValue(undefined);

    const result = await useCase.execute(validInput, 'req-id-1');

    expect(repo.createUnique).toHaveBeenCalledWith(result);
    expect(repo.create).not.toHaveBeenCalled();
    expect(outbox.publishWithBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type:    'role.requested',
        payload: expect.objectContaining({ requesterUid: 'uid-1', requestedRole: 'student' }),
      }),
    );
  });

  // ── guard: pending duplicate (now enforced inside createUnique / repository) ─

  it('throws 409 ROLE_REQUEST_PENDING when createUnique detects a pending request', async () => {
    userClient.getUser.mockResolvedValue(mockProfile);
    repo.createUnique.mockRejectedValue(
      Object.assign(new Error('pending'), { status: 409, errorCode: 'ROLE_REQUEST_PENDING' }),
    );

    await expect(useCase.execute(validInput, 'req-id-1')).rejects.toMatchObject({
      status:    409,
      errorCode: 'ROLE_REQUEST_PENDING',
    });

    expect(outbox.publishWithBatch).not.toHaveBeenCalled();
  });

  // ── guard: already approved ──────────────────────────────────────────────────

  it('throws 409 ROLE_ALREADY_GRANTED when createUnique detects an approved request', async () => {
    userClient.getUser.mockResolvedValue(mockProfile);
    repo.createUnique.mockRejectedValue(
      Object.assign(new Error('granted'), { status: 409, errorCode: 'ROLE_ALREADY_GRANTED' }),
    );

    await expect(useCase.execute(validInput, 'req-id-1')).rejects.toMatchObject({
      status:    409,
      errorCode: 'ROLE_ALREADY_GRANTED',
    });

    expect(outbox.publishWithBatch).not.toHaveBeenCalled();
  });

  // ── guard: caller already holds the requested role ───────────────────────────

  it('throws 409 ROLE_ALREADY_HELD when caller already has the requested role', async () => {
    const inputWithRole: CreateRoleRequestInput = {
      requesterUid:  'uid-1',
      requestedRole: 'student',
      callerRoles:   ['member', 'student'] as string[],
    };

    await expect(useCase.execute(inputWithRole, 'req-id-1')).rejects.toMatchObject({
      status:    409,
      errorCode: 'ROLE_ALREADY_HELD',
    });

    expect(userClient.getUser).not.toHaveBeenCalled();
    expect(repo.createUnique).not.toHaveBeenCalled();
    expect(outbox.publishWithBatch).not.toHaveBeenCalled();
  });

  // ── guard: user not found ────────────────────────────────────────────────────

  it('throws 404 USER_NOT_FOUND when user-service returns null', async () => {
    userClient.getUser.mockResolvedValue(null);

    await expect(useCase.execute(validInput, 'req-id-1')).rejects.toMatchObject({
      status:    404,
      errorCode: 'USER_NOT_FOUND',
    });

    expect(repo.createUnique).not.toHaveBeenCalled();
    expect(outbox.publishWithBatch).not.toHaveBeenCalled();
  });

  // ── repository call verification ─────────────────────────────────────────────

  it('calls createUnique with the correct requesterUid', async () => {
    userClient.getUser.mockResolvedValue(mockProfile);
    repo.createUnique.mockResolvedValue(undefined);
    outbox.publishWithBatch.mockResolvedValue(undefined);

    await useCase.execute({ ...validInput, requesterUid: 'uid-42' }, 'req-x');

    expect(repo.createUnique).toHaveBeenCalledWith(
      expect.objectContaining({ requesterUid: 'uid-42' }),
    );
  });

  // ── multi-role support ────────────────────────────────────────────────────────

  it('creates a leader role request for a student who does not yet hold leader', async () => {
    userClient.getUser.mockResolvedValue(mockProfile);
    repo.createUnique.mockResolvedValue(undefined);
    outbox.publishWithBatch.mockResolvedValue(undefined);

    const result = await useCase.execute(validInputLeader, 'req-leader');

    expect(result.requestedRole).toBe('leader');
    expect(repo.createUnique).toHaveBeenCalledWith(expect.objectContaining({ requestedRole: 'leader' }));
    expect(outbox.publishWithBatch).toHaveBeenCalledWith(
      expect.objectContaining({ payload: expect.objectContaining({ requestedRole: 'leader' }) }),
    );
  });

  it('creates a g12 role request for a leader who does not yet hold g12', async () => {
    userClient.getUser.mockResolvedValue(mockProfile);
    repo.createUnique.mockResolvedValue(undefined);
    outbox.publishWithBatch.mockResolvedValue(undefined);

    const result = await useCase.execute(validInputG12, 'req-g12');

    expect(result.requestedRole).toBe('g12');
  });

  it('throws ROLE_ALREADY_HELD when a student requests student again', async () => {
    const input: CreateRoleRequestInput = { requesterUid: 'uid-1', requestedRole: 'student', callerRoles: ['member', 'student'] as string[] };

    await expect(useCase.execute(input, 'req-dup')).rejects.toMatchObject({
      status: 409, errorCode: 'ROLE_ALREADY_HELD',
    });
    expect(userClient.getUser).not.toHaveBeenCalled();
  });
});
