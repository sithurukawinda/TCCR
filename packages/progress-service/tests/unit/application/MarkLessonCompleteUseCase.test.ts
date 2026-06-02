import { MarkLessonCompleteUseCase }  from '../../../src/application/use-cases/MarkLessonCompleteUseCase';
import { ILessonProgressRepository }  from '../../../src/domain/repositories/ILessonProgressRepository';
import { LessonProgress }             from '../../../src/domain/entities/LessonProgress';
import { CourseServiceClient }        from '../../../src/infrastructure/clients/CourseServiceClient';
import { EnrollmentServiceClient }    from '../../../src/infrastructure/clients/EnrollmentServiceClient';
import { MarkSubjectCompleteUseCase } from '../../../src/application/use-cases/MarkSubjectCompleteUseCase';
import { UpdateLastAccessedUseCase }  from '../../../src/application/use-cases/UpdateLastAccessedUseCase';

const makeLessonProgressRepo = (): jest.Mocked<ILessonProgressRepository> => ({
  findByStudentAndLesson:  jest.fn(),
  findByCourseAndStudent:  jest.fn(),
  findBySubjectAndStudent: jest.fn(),
  save:   jest.fn(),
  delete: jest.fn(),
});

const makeCourseClient = (): jest.Mocked<CourseServiceClient> =>
  ({
    getSubjectCount:      jest.fn(),
    getLesson:            jest.fn(),
    getLessonCount:       jest.fn(),
    getCourseLessonCount: jest.fn(),
  } as unknown as jest.Mocked<CourseServiceClient>);

const makeEnrollmentClient = (): jest.Mocked<EnrollmentServiceClient> =>
  ({ isEnrolled: jest.fn() } as unknown as jest.Mocked<EnrollmentServiceClient>);

const makeMarkSubject = (): jest.Mocked<MarkSubjectCompleteUseCase> =>
  ({ execute: jest.fn() } as unknown as jest.Mocked<MarkSubjectCompleteUseCase>);

const makeUpdateLastAccessed = (): jest.Mocked<UpdateLastAccessedUseCase> =>
  ({ execute: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<UpdateLastAccessedUseCase>);

const makeLessonProgress = (): LessonProgress =>
  new LessonProgress({
    id: 'uid1_lesson1', studentUid: 'uid1', lessonId: 'lesson1',
    subjectId: 'sub1', courseId: 'course1', semesterId: 'sem1', batchId: null,
    completedAt: '2026-01-01T00:00:00.000Z',
    createdAt:   '2026-01-01T00:00:00.000Z',
    updatedAt:   '2026-01-01T00:00:00.000Z',
  });

const LESSON_META = { id: 'lesson1', subjectId: 'sub1', courseId: 'course1', semesterId: 'sem1' };

const INPUT = {
  studentUid: 'uid1', lessonId: 'lesson1',
  courseId: 'course1', subjectId: 'sub1',
  semesterId: 'sem1', batchId: null,
};

describe('MarkLessonCompleteUseCase', () => {
  let lessonProgressRepo: jest.Mocked<ILessonProgressRepository>;
  let courseClient:       jest.Mocked<CourseServiceClient>;
  let enrollmentClient:   jest.Mocked<EnrollmentServiceClient>;
  let markSubject:        jest.Mocked<MarkSubjectCompleteUseCase>;
  let updateLastAccessed: jest.Mocked<UpdateLastAccessedUseCase>;
  let useCase:            MarkLessonCompleteUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    lessonProgressRepo = makeLessonProgressRepo();
    courseClient       = makeCourseClient();
    enrollmentClient   = makeEnrollmentClient();
    markSubject        = makeMarkSubject();
    updateLastAccessed = makeUpdateLastAccessed();
    useCase = new MarkLessonCompleteUseCase(
      lessonProgressRepo, courseClient, enrollmentClient, markSubject, updateLastAccessed,
    );
  });

  // ── guard checks ──────────────────────────────────────────────────────────

  it('throws 403 NOT_ENROLLED when student has no approved enrollment', async () => {
    enrollmentClient.isEnrolled.mockResolvedValue(false);
    courseClient.getLesson.mockResolvedValue(LESSON_META);

    await expect(useCase.execute(INPUT, 'req-1')).rejects.toMatchObject({
      status: 403, errorCode: 'NOT_ENROLLED',
    });
    expect(lessonProgressRepo.save).not.toHaveBeenCalled();
  });

  it('throws 404 LESSON_NOT_FOUND when lesson does not exist', async () => {
    enrollmentClient.isEnrolled.mockResolvedValue(true);
    courseClient.getLesson.mockResolvedValue(null);

    await expect(useCase.execute(INPUT, 'req-1')).rejects.toMatchObject({
      status: 404, errorCode: 'LESSON_NOT_FOUND',
    });
    expect(lessonProgressRepo.save).not.toHaveBeenCalled();
  });

  it('throws 400 LESSON_MISMATCH when lesson belongs to a different course', async () => {
    enrollmentClient.isEnrolled.mockResolvedValue(true);
    courseClient.getLesson.mockResolvedValue({ ...LESSON_META, courseId: 'other-course' });
    lessonProgressRepo.findByStudentAndLesson.mockResolvedValue(null);

    await expect(useCase.execute(INPUT, 'req-1')).rejects.toMatchObject({
      status: 400, errorCode: 'LESSON_MISMATCH',
    });
  });

  it('fires enrollment and lesson checks in parallel', async () => {
    // Both mocks resolve immediately — verify Promise.all by checking both were called
    enrollmentClient.isEnrolled.mockResolvedValue(false);
    courseClient.getLesson.mockResolvedValue(null);

    await useCase.execute(INPUT, 'req-1').catch(() => undefined);

    expect(enrollmentClient.isEnrolled).toHaveBeenCalledTimes(1);
    expect(courseClient.getLesson).toHaveBeenCalledTimes(1);
  });

  // ── idempotency ───────────────────────────────────────────────────────────

  it('returns existing record without writing when lesson is already complete', async () => {
    enrollmentClient.isEnrolled.mockResolvedValue(true);
    courseClient.getLesson.mockResolvedValue(LESSON_META);
    lessonProgressRepo.findByStudentAndLesson.mockResolvedValue(makeLessonProgress());

    const result = await useCase.execute(INPUT, 'req-1');

    expect(result.lessonId).toBe('lesson1');
    expect(result.subjectAutoCompleted).toBe(false);
    expect(lessonProgressRepo.save).not.toHaveBeenCalled();
    expect(markSubject.execute).not.toHaveBeenCalled();
  });

  // ── happy path ────────────────────────────────────────────────────────────

  it('saves lesson progress and returns result on first completion', async () => {
    enrollmentClient.isEnrolled.mockResolvedValue(true);
    courseClient.getLesson.mockResolvedValue(LESSON_META);
    lessonProgressRepo.findByStudentAndLesson.mockResolvedValue(null);
    lessonProgressRepo.save.mockResolvedValue(undefined);
    courseClient.getLessonCount.mockResolvedValue(3);
    lessonProgressRepo.findBySubjectAndStudent.mockResolvedValue([makeLessonProgress()]); // 1 of 3

    const result = await useCase.execute(INPUT, 'req-1');

    expect(result.lessonId).toBe('lesson1');
    expect(result.courseId).toBe('course1');
    expect(result.subjectAutoCompleted).toBe(false);
    expect(lessonProgressRepo.save).toHaveBeenCalledTimes(1);
    expect(markSubject.execute).not.toHaveBeenCalled();
  });

  it('auto-completes the subject when the last lesson in the subject is done', async () => {
    enrollmentClient.isEnrolled.mockResolvedValue(true);
    courseClient.getLesson.mockResolvedValue(LESSON_META);
    lessonProgressRepo.findByStudentAndLesson.mockResolvedValue(null);
    lessonProgressRepo.save.mockResolvedValue(undefined);
    courseClient.getLessonCount.mockResolvedValue(1);                    // only 1 lesson in subject
    lessonProgressRepo.findBySubjectAndStudent.mockResolvedValue([makeLessonProgress()]); // 1 of 1 done
    markSubject.execute.mockResolvedValue({} as never);

    const result = await useCase.execute(INPUT, 'req-1');

    expect(result.subjectAutoCompleted).toBe(true);
    expect(markSubject.execute).toHaveBeenCalledTimes(1);
    expect(markSubject.execute).toHaveBeenCalledWith(
      expect.objectContaining({ studentUid: 'uid1', subjectId: 'sub1' }),
      'req-1',
    );
  });

  it('does not auto-complete subject when remaining lessons exist', async () => {
    enrollmentClient.isEnrolled.mockResolvedValue(true);
    courseClient.getLesson.mockResolvedValue(LESSON_META);
    lessonProgressRepo.findByStudentAndLesson.mockResolvedValue(null);
    lessonProgressRepo.save.mockResolvedValue(undefined);
    courseClient.getLessonCount.mockResolvedValue(5);
    lessonProgressRepo.findBySubjectAndStudent.mockResolvedValue([makeLessonProgress()]); // 1 of 5

    const result = await useCase.execute(INPUT, 'req-1');

    expect(result.subjectAutoCompleted).toBe(false);
    expect(markSubject.execute).not.toHaveBeenCalled();
  });
});
