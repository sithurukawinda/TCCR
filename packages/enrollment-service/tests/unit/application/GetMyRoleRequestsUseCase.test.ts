import { GetMyRoleRequestsUseCase } from '../../../src/application/use-cases/GetMyRoleRequestsUseCase';
import { IRoleRequestRepository }   from '../../../src/domain/repositories/IRoleRequestRepository';
import { RoleRequest }             from '../../../src/domain/entities/RoleRequest';

const makeRepo = (): jest.Mocked<IRoleRequestRepository> => ({
  findById:              jest.fn(),
  findPendingByRequester:  jest.fn(),
  findApprovedByRequester: jest.fn(),
  findByRequester:       jest.fn(),
  findAll:               jest.fn(),
  create:                jest.fn(),
  update:                jest.fn(),
});

const makeRequest = (opts: {
  id?: string;
  status?: 'pending' | 'approved' | 'rejected';
  createdAt?: string;
} = {}): RoleRequest =>
  new RoleRequest({
    id: opts.id ?? 'req-1',
    requesterUid: 'uid-1',
    requestedRole: 'student',
    status: opts.status ?? 'pending',
    decidedByUid: null, decisionNote: null,
    createdAt: opts.createdAt ?? '2026-01-01T00:00:00.000Z',
    decidedAt: null,
    applicantProfile: {
      firstName: 'John', lastName: 'Doe', phoneNumber: '+94771234567',
      email: 'john@example.com', dateOfBirth: '2000-06-15',
      gender: 'male', address: '123 Main St',
      qualificationTitle: null, qualificationUrl: null,
    },
    qualificationTitle:       'BSc Computer Science',
    qualificationStoragePath: null,
  });

describe('GetMyRoleRequestsUseCase', () => {
  let repo:    jest.Mocked<IRoleRequestRepository>;
  let useCase: GetMyRoleRequestsUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo    = makeRepo();
    useCase = new GetMyRoleRequestsUseCase(repo);
  });

  it('returns the single request when no duplicates exist', async () => {
    repo.findByRequester.mockResolvedValue([makeRequest({ status: 'approved' })]);

    const result = await useCase.execute('uid-1');

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('approved');
    expect(repo.findByRequester).toHaveBeenCalledWith('uid-1');
  });

  it('deduplicates same-role requests, returning only the newest', async () => {
    // Repo returns newest-first (createdAt DESC)
    const newer = makeRequest({ id: 'req-newer', status: 'approved', createdAt: '2026-06-01T10:00:00.000Z' });
    const older = makeRequest({ id: 'req-older', status: 'pending',  createdAt: '2026-01-01T00:00:00.000Z' });
    repo.findByRequester.mockResolvedValue([newer, older]);

    const result = await useCase.execute('uid-1');

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('req-newer');
  });

  it('returns empty array when user has no requests', async () => {
    repo.findByRequester.mockResolvedValue([]);

    const result = await useCase.execute('uid-no-requests');

    expect(result).toHaveLength(0);
    expect(repo.findByRequester).toHaveBeenCalledWith('uid-no-requests');
  });

  it('queries by the correct requesterUid', async () => {
    repo.findByRequester.mockResolvedValue([]);

    await useCase.execute('uid-specific-99');

    expect(repo.findByRequester).toHaveBeenCalledWith('uid-specific-99');
  });
});
