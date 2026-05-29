import { UpdateLessonUseCase } from '../../../src/application/use-cases/UpdateLessonUseCase';
import { ILessonRepository }  from '../../../src/domain/repositories/ILessonRepository';
import { Lesson }             from '../../../src/domain/entities/Lesson';

const makeLesson = (deletedAt: string | null = null): Lesson =>
  new Lesson({ id: 'l1', subjectId: 'sub1', courseId: 'c1', semesterId: 's1', title: 'Old Title', description: 'Old desc', youtubeVideoId: null, attachmentIds: [], order: 1, deletedAt, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' });

const makeLessonRepo = (): jest.Mocked<ILessonRepository> => ({
  findById: jest.fn(), findBySubject: jest.fn(), create: jest.fn(),
  update: jest.fn(), softDelete: jest.fn(), hardDelete: jest.fn(), deleteBySubjectId: jest.fn(), nextOrder: jest.fn(),
  countBySubject: jest.fn(), countByCourse: jest.fn(),
});

describe('UpdateLessonUseCase', () => {
  let repo:    jest.Mocked<ILessonRepository>;
  let useCase: UpdateLessonUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo    = makeLessonRepo();
    useCase = new UpdateLessonUseCase(repo);
  });

  it('updates lesson fields and persists', async () => {
    repo.findById.mockResolvedValue(makeLesson());
    repo.update.mockResolvedValue(undefined);

    const result = await useCase.execute({ id: 'l1', title: 'New Title', description: 'New desc' });

    expect(result.title).toBe('New Title');
    expect(result.description).toBe('New desc');
    expect(repo.update).toHaveBeenCalledTimes(1);
  });

  it('throws 404 LESSON_NOT_FOUND when lesson does not exist', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(useCase.execute({ id: 'l1', title: 'X' })).rejects.toMatchObject({
      status:    404,
      errorCode: 'LESSON_NOT_FOUND',
    });
  });

  it('throws 404 LESSON_NOT_FOUND when lesson is soft-deleted', async () => {
    repo.findById.mockResolvedValue(makeLesson('2026-01-01T00:00:00.000Z'));
    await expect(useCase.execute({ id: 'l1' })).rejects.toMatchObject({ status: 404 });
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('updates youtubeVideoId and attachmentIds', async () => {
    repo.findById.mockResolvedValue(makeLesson());
    repo.update.mockResolvedValue(undefined);

    const result = await useCase.execute({ id: 'l1', youtubeVideoId: 'vid123', attachmentIds: ['att1'] });

    expect(result.youtubeVideoId).toBe('vid123');
    expect(result.attachmentIds).toEqual(['att1']);
  });
});
