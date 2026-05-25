import { DeleteSubjectUseCase }  from '../../../src/application/use-cases/DeleteSubjectUseCase';
import { ISemesterRepository }  from '../../../src/domain/repositories/ISemesterRepository';
import { ISubjectRepository }   from '../../../src/domain/repositories/ISubjectRepository';
import { Semester }             from '../../../src/domain/entities/Semester';
import { Subject }              from '../../../src/domain/entities/Subject';

const makeSemester = (subjectCount = 2): Semester =>
  new Semester({ id: 's1', courseId: 'c1', title: 'S1', subjectCount, order: 1, deletedAt: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' });

const makeSubject = (): Subject =>
  new Subject({ id: 'sub1', semesterId: 's1', courseId: 'c1', title: 'Sub1', order: 1, deletedAt: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' });

const makeSemesterRepo = (): jest.Mocked<ISemesterRepository> => ({
  findById: jest.fn(), findByCourseId: jest.fn(), create: jest.fn(), update: jest.fn(), softDelete: jest.fn(),
});

const makeSubjectRepo = (): jest.Mocked<ISubjectRepository> => ({
  findById: jest.fn(), findBySemesterId: jest.fn(), findByCourseId: jest.fn(),
  create: jest.fn(), update: jest.fn(), softDelete: jest.fn(),
});

describe('DeleteSubjectUseCase', () => {
  let semesterRepo: jest.Mocked<ISemesterRepository>;
  let subjectRepo:  jest.Mocked<ISubjectRepository>;
  let useCase:      DeleteSubjectUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    semesterRepo = makeSemesterRepo();
    subjectRepo  = makeSubjectRepo();
    useCase      = new DeleteSubjectUseCase(semesterRepo, subjectRepo);
  });

  it('soft-deletes subject and decrements semester subjectCount', async () => {
    subjectRepo.findById.mockResolvedValue(makeSubject());
    subjectRepo.softDelete.mockResolvedValue(undefined);
    semesterRepo.findById.mockResolvedValue(makeSemester(2));
    semesterRepo.update.mockResolvedValue(undefined);

    await useCase.execute('sub1');

    expect(subjectRepo.softDelete).toHaveBeenCalledWith('sub1');
    expect(semesterRepo.update).toHaveBeenCalledWith(expect.objectContaining({ subjectCount: 1 }));
  });

  it('throws 404 SUBJECT_NOT_FOUND when subject does not exist', async () => {
    subjectRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute('sub1')).rejects.toMatchObject({
      status:    404,
      errorCode: 'SUBJECT_NOT_FOUND',
    });
    expect(subjectRepo.softDelete).not.toHaveBeenCalled();
  });

  it('does not decrement subjectCount below zero', async () => {
    subjectRepo.findById.mockResolvedValue(makeSubject());
    subjectRepo.softDelete.mockResolvedValue(undefined);
    semesterRepo.findById.mockResolvedValue(makeSemester(0));
    semesterRepo.update.mockResolvedValue(undefined);

    await useCase.execute('sub1');

    expect(semesterRepo.update).not.toHaveBeenCalled();
  });
});
