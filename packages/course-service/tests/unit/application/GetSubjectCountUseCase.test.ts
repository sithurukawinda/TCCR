import { GetSubjectCountUseCase } from '../../../src/application/use-cases/GetSubjectCountUseCase';
import { ICourseRepository }     from '../../../src/domain/repositories/ICourseRepository';
import { ISemesterRepository }   from '../../../src/domain/repositories/ISemesterRepository';
import { Course }                from '../../../src/domain/entities/Course';
import { Semester }              from '../../../src/domain/entities/Semester';

const makeCourse = (): Course =>
  new Course({
    id: 'c1', title: 'T', description: '', coverImageUrl: null, state: 'published',
    createdBy: 'u1', semesterCount: 2, publishedAt: null,
    deletedAt: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  });

const makeSemester = (id: string, subjectCount: number): Semester =>
  new Semester({ id, courseId: 'c1', title: 'S', subjectCount, order: 1, deletedAt: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' });

const makeCourseRepo = (): jest.Mocked<ICourseRepository> => ({
  findById: jest.fn(), findByTitle: jest.fn(), findPublished: jest.fn(),
  findAll: jest.fn(), create: jest.fn(), update: jest.fn(), softDelete: jest.fn(),
});

const makeSemesterRepo = (): jest.Mocked<ISemesterRepository> => ({
  findById: jest.fn(), findByCourseId: jest.fn(), create: jest.fn(), update: jest.fn(), softDelete: jest.fn(),
});

describe('GetSubjectCountUseCase', () => {
  let courseRepo:   jest.Mocked<ICourseRepository>;
  let semesterRepo: jest.Mocked<ISemesterRepository>;
  let useCase:      GetSubjectCountUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    courseRepo   = makeCourseRepo();
    semesterRepo = makeSemesterRepo();
    useCase      = new GetSubjectCountUseCase(courseRepo, semesterRepo);
  });

  it('returns the sum of subjectCounts across all semesters', async () => {
    courseRepo.findById.mockResolvedValue(makeCourse());
    semesterRepo.findByCourseId.mockResolvedValue([makeSemester('s1', 3), makeSemester('s2', 2)]);

    const result = await useCase.execute('c1');

    expect(result.subjectCount).toBe(5);
  });

  it('returns 0 when course has no semesters', async () => {
    courseRepo.findById.mockResolvedValue(makeCourse());
    semesterRepo.findByCourseId.mockResolvedValue([]);

    const result = await useCase.execute('c1');

    expect(result.subjectCount).toBe(0);
  });

  it('throws 404 COURSE_NOT_FOUND when course does not exist', async () => {
    courseRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute('c1')).rejects.toMatchObject({
      status:    404,
      errorCode: 'COURSE_NOT_FOUND',
    });
    expect(semesterRepo.findByCourseId).not.toHaveBeenCalled();
  });
});
