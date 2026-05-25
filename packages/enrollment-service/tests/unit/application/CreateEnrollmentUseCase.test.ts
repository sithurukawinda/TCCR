import { CreateEnrollmentUseCase }  from '../../../src/application/use-cases/CreateEnrollmentUseCase';
import { IEnrollmentRepository }   from '../../../src/domain/repositories/IEnrollmentRepository';
import { CourseServiceClient }      from '../../../src/infrastructure/clients/CourseServiceClient';
import { OutboxEventPublisher }    from '@shared/events';
import { Enrollment }              from '../../../src/domain/entities/Enrollment';

const makeEnrollment = (state: 'pending' | 'approved' | 'rejected' | 'withdrawn', rejectedAt: string | null = null): Enrollment =>
  new Enrollment({ id: 'uid1_c1', studentUid: 'uid1', courseId: 'c1', state, reason: null, rejectedAt, approvedAt: null, withdrawnAt: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' });

const makeRepo    = (): jest.Mocked<IEnrollmentRepository> =>
  ({ findById: jest.fn(), findByStudentAndCourse: jest.fn(), findByStudent: jest.fn(), findAll: jest.fn(), create: jest.fn(), update: jest.fn() });
const makeClient  = (): jest.Mocked<CourseServiceClient> =>
  ({ isCoursePublished: jest.fn() } as unknown as jest.Mocked<CourseServiceClient>);
const makeOutbox  = (): jest.Mocked<OutboxEventPublisher> =>
  ({ publishWithBatch: jest.fn() } as unknown as jest.Mocked<OutboxEventPublisher>);

describe('CreateEnrollmentUseCase', () => {
  let repo:    jest.Mocked<IEnrollmentRepository>;
  let client:  jest.Mocked<CourseServiceClient>;
  let outbox:  jest.Mocked<OutboxEventPublisher>;
  let useCase: CreateEnrollmentUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo    = makeRepo();
    client  = makeClient();
    outbox  = makeOutbox();
    useCase = new CreateEnrollmentUseCase(repo, client, outbox);
  });

  it('creates enrollment for a published course with no existing record', async () => {
    client.isCoursePublished.mockResolvedValue(true);
    repo.findByStudentAndCourse.mockResolvedValue(null);
    repo.create.mockResolvedValue(undefined);
    outbox.publishWithBatch.mockResolvedValue(undefined);

    const enroll = await useCase.execute('uid1', 'c1', 'req-1');
    expect(enroll.state).toBe('pending');
    expect(outbox.publishWithBatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'enrollment.pending' }));
  });

  it('throws 404 when course is not published', async () => {
    client.isCoursePublished.mockResolvedValue(false);
    await expect(useCase.execute('uid1', 'c1', 'req-1')).rejects.toMatchObject({ status: 404, errorCode: 'COURSE_NOT_FOUND' });
  });

  it('throws 409 ENROLLMENT_PENDING when duplicate PENDING exists', async () => {
    client.isCoursePublished.mockResolvedValue(true);
    repo.findByStudentAndCourse.mockResolvedValue(makeEnrollment('pending'));
    await expect(useCase.execute('uid1', 'c1', 'req-1')).rejects.toMatchObject({ status: 409, errorCode: 'ENROLLMENT_PENDING' });
  });

  it('throws 409 ALREADY_ENROLLED when approved enrollment exists', async () => {
    client.isCoursePublished.mockResolvedValue(true);
    repo.findByStudentAndCourse.mockResolvedValue(makeEnrollment('approved'));
    await expect(useCase.execute('uid1', 'c1', 'req-1')).rejects.toMatchObject({ status: 409, errorCode: 'ALREADY_ENROLLED' });
  });

  it('throws 422 COOLOFF_ACTIVE when rejected within cooloff period', async () => {
    client.isCoursePublished.mockResolvedValue(true);
    const rejectedAt = new Date(Date.now() - 60_000).toISOString(); // 1 min ago
    repo.findByStudentAndCourse.mockResolvedValue(makeEnrollment('rejected', rejectedAt));
    await expect(useCase.execute('uid1', 'c1', 'req-1')).rejects.toMatchObject({ status: 422, errorCode: 'COOLOFF_ACTIVE' });
  });
});
