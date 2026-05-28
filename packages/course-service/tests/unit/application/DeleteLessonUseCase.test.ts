import { DeleteLessonUseCase } from '../../../src/application/use-cases/DeleteLessonUseCase';
import { ILessonRepository }  from '../../../src/domain/repositories/ILessonRepository';
import { Lesson }             from '../../../src/domain/entities/Lesson';

const makeLesson = (deletedAt: string | null = null): Lesson =>
  new Lesson({ id: 'l1', subjectId: 'sub1', courseId: 'c1', semesterId: 's1', title: 'Lesson', description: '', youtubeVideoId: null, attachmentIds: [], order: 1, deletedAt, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' });

const makeLessonRepo = (): jest.Mocked<ILessonRepository> => ({
  findById: jest.fn(), findBySubject: jest.fn(), create: jest.fn(),
  update: jest.fn(), softDelete: jest.fn(), nextOrder: jest.fn(),
  countBySubject: jest.fn(), countByCourse: jest.fn(),
});

describe('DeleteLessonUseCase', () => {
  let repo:    jest.Mocked<ILessonRepository>;
  let useCase: DeleteLessonUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo    = makeLessonRepo();
    useCase = new DeleteLessonUseCase(repo);
  });

  it('soft-deletes an existing lesson', async () => {
    repo.findById.mockResolvedValue(makeLesson());
    repo.softDelete.mockResolvedValue(undefined);

    await useCase.execute('l1');

    expect(repo.softDelete).toHaveBeenCalledWith('l1');
  });

  it('throws 404 LESSON_NOT_FOUND when lesson does not exist', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(useCase.execute('l1')).rejects.toMatchObject({
      status:    404,
      errorCode: 'LESSON_NOT_FOUND',
    });
    expect(repo.softDelete).not.toHaveBeenCalled();
  });

  it('throws 404 LESSON_NOT_FOUND when lesson is already soft-deleted', async () => {
    repo.findById.mockResolvedValue(makeLesson('2026-01-01T00:00:00.000Z'));
    await expect(useCase.execute('l1')).rejects.toMatchObject({ status: 404 });
    expect(repo.softDelete).not.toHaveBeenCalled();
  });
});
