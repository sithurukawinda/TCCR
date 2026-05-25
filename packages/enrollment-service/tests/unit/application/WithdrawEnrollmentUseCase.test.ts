import { WithdrawEnrollmentUseCase } from '../../../src/application/use-cases/WithdrawEnrollmentUseCase';
import { IEnrollmentRepository }    from '../../../src/domain/repositories/IEnrollmentRepository';
import { OutboxEventPublisher }     from '@shared/events';
import { Enrollment }               from '../../../src/domain/entities/Enrollment';

const makeEnrollment = (state: 'pending' | 'approved' | 'rejected' | 'withdrawn'): Enrollment =>
  new Enrollment({ id: 'uid1_c1', studentUid: 'uid1', courseId: 'c1', state, reason: null, rejectedAt: null, approvedAt: null, withdrawnAt: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' });

const makeRepo   = (): jest.Mocked<IEnrollmentRepository> =>
  ({ findById: jest.fn(), findByStudentAndCourse: jest.fn(), findByStudent: jest.fn(), findAll: jest.fn(), create: jest.fn(), update: jest.fn() });
const makeOutbox = (): jest.Mocked<OutboxEventPublisher> =>
  ({ publishWithBatch: jest.fn() } as unknown as jest.Mocked<OutboxEventPublisher>);

describe('WithdrawEnrollmentUseCase', () => {
  let repo:    jest.Mocked<IEnrollmentRepository>;
  let outbox:  jest.Mocked<OutboxEventPublisher>;
  let useCase: WithdrawEnrollmentUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo    = makeRepo();
    outbox  = makeOutbox();
    useCase = new WithdrawEnrollmentUseCase(repo, outbox);
  });

  it('withdraws a pending enrollment', async () => {
    repo.findById.mockResolvedValue(makeEnrollment('pending'));
    repo.update.mockResolvedValue(undefined);
    outbox.publishWithBatch.mockResolvedValue(undefined);

    const result = await useCase.execute('uid1_c1', 'uid1', 'req-1');
    expect(result.state).toBe('withdrawn');
    expect(result.withdrawnAt).not.toBeNull();
  });

  it('throws 404 when enrollment not found', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(useCase.execute('uid1_c1', 'uid1', 'req-1')).rejects.toMatchObject({ status: 404 });
  });

  it('throws 409 INVALID_STATE when enrollment is already withdrawn', async () => {
    repo.findById.mockResolvedValue(makeEnrollment('withdrawn'));
    await expect(useCase.execute('uid1_c1', 'uid1', 'req-1')).rejects.toMatchObject({ status: 409, errorCode: 'INVALID_STATE' });
  });
});
