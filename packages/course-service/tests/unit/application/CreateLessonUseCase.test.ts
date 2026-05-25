import { CreateLessonUseCase } from '../../../src/application/use-cases/CreateLessonUseCase';
import { ISubjectRepository } from '../../../src/domain/repositories/ISubjectRepository';
import { ILessonRepository }  from '../../../src/domain/repositories/ILessonRepository';
import { Subject }            from '../../../src/domain/entities/Subject';

const makeSubject = (deletedAt: string | null = null): Subject =>
  new Subject({ id: 'sub1', semesterId: 's1', courseId: 'c1', title: 'Sub1', order: 1, deletedAt, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' });

const makeSubjectRepo = (): jest.Mocked<ISubjectRepository> => ({
  findById: jest.fn(), findBySemesterId: jest.fn(), findByCourseId: jest.fn(),
  create: jest.fn(), update: jest.fn(), softDelete: jest.fn(),
});

const makeLessonRepo = (): jest.Mocked<ILessonRepository> => ({
  findById: jest.fn(), findBySubject: jest.fn(), create: jest.fn(),
  update: jest.fn(), softDelete: jest.fn(), nextOrder: jest.fn(),
});

const INPUT = { subjectId: 'sub1', title: 'Lesson 1', description: 'Intro', youtubeVideoId: null, attachmentIds: [] };

describe('CreateLessonUseCase', () => {
  let subjectRepo: jest.Mocked<ISubjectRepository>;
  let lessonRepo:  jest.Mocked<ILessonRepository>;
  let useCase:     CreateLessonUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    subjectRepo = makeSubjectRepo();
    lessonRepo  = makeLessonRepo();
    useCase     = new CreateLessonUseCase(subjectRepo, lessonRepo);
  });

  it('creates a lesson with correct order and subject metadata', async () => {
    subjectRepo.findById.mockResolvedValue(makeSubject());
    lessonRepo.nextOrder.mockResolvedValue(3);
    lessonRepo.create.mockResolvedValue(undefined);

    const lesson = await useCase.execute(INPUT);

    expect(lesson.title).toBe('Lesson 1');
    expect(lesson.order).toBe(3);
    expect(lesson.subjectId).toBe('sub1');
    expect(lesson.courseId).toBe('c1');
    expect(lesson.semesterId).toBe('s1');
    expect(lessonRepo.create).toHaveBeenCalledTimes(1);
  });

  it('throws 404 SUBJECT_NOT_FOUND when subject does not exist', async () => {
    subjectRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute(INPUT)).rejects.toMatchObject({
      status:    404,
      errorCode: 'SUBJECT_NOT_FOUND',
    });
  });

  it('throws 404 SUBJECT_NOT_FOUND when subject is soft-deleted', async () => {
    subjectRepo.findById.mockResolvedValue(makeSubject('2026-01-01T00:00:00.000Z'));
    await expect(useCase.execute(INPUT)).rejects.toMatchObject({ status: 404 });
    expect(lessonRepo.create).not.toHaveBeenCalled();
  });

  it('propagates errors from lessonRepo.create', async () => {
    subjectRepo.findById.mockResolvedValue(makeSubject());
    lessonRepo.nextOrder.mockResolvedValue(1);
    lessonRepo.create.mockRejectedValue(new Error('DB error'));

    await expect(useCase.execute(INPUT)).rejects.toThrow('DB error');
  });
});
