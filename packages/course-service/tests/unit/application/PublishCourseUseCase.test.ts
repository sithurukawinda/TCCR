import { PublishCourseUseCase }   from '../../../src/application/use-cases/PublishCourseUseCase';
import { ICourseRepository }      from '../../../src/domain/repositories/ICourseRepository';
import { ISemesterRepository }    from '../../../src/domain/repositories/ISemesterRepository';
import { OutboxEventPublisher }   from '@shared/events';
import { Course }                 from '../../../src/domain/entities/Course';
import { Semester }               from '../../../src/domain/entities/Semester';

const makeCourse = (state: 'draft' | 'published' | 'archived' = 'draft'): Course =>
  new Course({ id: 'c1', title: 'T', description: '', coverImageUrl: null, state, createdBy: 'u1', semesterCount: 0, publishedAt: null, deletedAt: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' });

const makeSemester = (subjectCount = 1): Semester =>
  new Semester({ id: 's1', courseId: 'c1', title: 'S1', subjectCount, order: 1, deletedAt: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' });

const makeCourseRepo = (): jest.Mocked<ICourseRepository> =>
  ({ findById: jest.fn(), findByTitle: jest.fn(), findPublished: jest.fn(), findAll: jest.fn(), create: jest.fn(), update: jest.fn(), softDelete: jest.fn() });

const makeSemesterRepo = (): jest.Mocked<ISemesterRepository> =>
  ({ findById: jest.fn(), findByCourseId: jest.fn(), create: jest.fn(), update: jest.fn(), softDelete: jest.fn() });

const makeOutbox = (): jest.Mocked<OutboxEventPublisher> =>
  ({ publishWithBatch: jest.fn() } as unknown as jest.Mocked<OutboxEventPublisher>);

describe('PublishCourseUseCase', () => {
  let courseRepo:   jest.Mocked<ICourseRepository>;
  let semesterRepo: jest.Mocked<ISemesterRepository>;
  let outbox:       jest.Mocked<OutboxEventPublisher>;
  let useCase:      PublishCourseUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    courseRepo   = makeCourseRepo();
    semesterRepo = makeSemesterRepo();
    outbox       = makeOutbox();
    useCase      = new PublishCourseUseCase(courseRepo, semesterRepo, outbox);
  });

  it('publishes a DRAFT course with valid semesters', async () => {
    courseRepo.findById.mockResolvedValue(makeCourse('draft'));
    semesterRepo.findByCourseId.mockResolvedValue([makeSemester(2)]);
    courseRepo.update.mockResolvedValue(undefined);
    outbox.publishWithBatch.mockResolvedValue(undefined);

    const course = await useCase.execute('c1', 'req-1');

    expect(course.state).toBe('published');
    expect(course.publishedAt).not.toBeNull();
    expect(outbox.publishWithBatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'course.published' }));
  });

  it('throws 404 when course not found', async () => {
    courseRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute('c1', 'req-1')).rejects.toMatchObject({ status: 404, errorCode: 'COURSE_NOT_FOUND' });
  });

  it('throws 422 NO_SEMESTERS when course has no semesters', async () => {
    courseRepo.findById.mockResolvedValue(makeCourse('draft'));
    semesterRepo.findByCourseId.mockResolvedValue([]);
    await expect(useCase.execute('c1', 'req-1')).rejects.toMatchObject({ status: 422, errorCode: 'NO_SEMESTERS' });
  });

  it('throws 422 EMPTY_SEMESTER when a semester has zero subjects', async () => {
    courseRepo.findById.mockResolvedValue(makeCourse('draft'));
    semesterRepo.findByCourseId.mockResolvedValue([makeSemester(0)]);
    await expect(useCase.execute('c1', 'req-1')).rejects.toMatchObject({ status: 422, errorCode: 'EMPTY_SEMESTER' });
  });

  it('throws 409 INVALID_STATE when course is already PUBLISHED', async () => {
    courseRepo.findById.mockResolvedValue(makeCourse('published'));
    semesterRepo.findByCourseId.mockResolvedValue([makeSemester(1)]);
    await expect(useCase.execute('c1', 'req-1')).rejects.toMatchObject({ status: 409, errorCode: 'INVALID_STATE' });
  });
});
