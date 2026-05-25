import { CreateSubjectUseCase }  from '../../../src/application/use-cases/CreateSubjectUseCase';
import { ISemesterRepository }   from '../../../src/domain/repositories/ISemesterRepository';
import { ISubjectRepository }    from '../../../src/domain/repositories/ISubjectRepository';
import { Semester }              from '../../../src/domain/entities/Semester';

const makeSemester = (): Semester =>
  new Semester({ id: 's1', courseId: 'c1', title: 'S1', subjectCount: 0, order: 1, deletedAt: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' });

const makeSemesterRepo = (): jest.Mocked<ISemesterRepository> =>
  ({ findById: jest.fn(), findByCourseId: jest.fn(), create: jest.fn(), update: jest.fn(), softDelete: jest.fn() });

const makeSubjectRepo = (): jest.Mocked<ISubjectRepository> =>
  ({ findById: jest.fn(), findBySemesterId: jest.fn(), findByCourseId: jest.fn(), create: jest.fn(), update: jest.fn(), softDelete: jest.fn() });

describe('CreateSubjectUseCase', () => {
  let semesterRepo: jest.Mocked<ISemesterRepository>;
  let subjectRepo:  jest.Mocked<ISubjectRepository>;
  let useCase:      CreateSubjectUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    semesterRepo = makeSemesterRepo();
    subjectRepo  = makeSubjectRepo();
    useCase      = new CreateSubjectUseCase(semesterRepo, subjectRepo);
  });

  it('creates a subject and increments subjectCount', async () => {
    semesterRepo.findById.mockResolvedValue(makeSemester());
    subjectRepo.findBySemesterId.mockResolvedValue([]);
    subjectRepo.create.mockResolvedValue(undefined);
    semesterRepo.update.mockResolvedValue(undefined);

    const subject = await useCase.execute({ semesterId: 's1', title: 'Intro' });

    expect(subject.semesterId).toBe('s1');
    expect(semesterRepo.update).toHaveBeenCalledWith(expect.objectContaining({ subjectCount: 1 }));
  });

  it('throws 404 when semester not found', async () => {
    semesterRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute({ semesterId: 's1', title: 'T' }))
      .rejects.toMatchObject({ status: 404, errorCode: 'SEMESTER_NOT_FOUND' });
  });
});
