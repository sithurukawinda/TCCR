import { UploadAttachmentUseCase }  from '../../../src/application/use-cases/UploadAttachmentUseCase';
import { IAttachmentRepository }    from '../../../src/domain/repositories/IAttachmentRepository';
import { CloudStorageRepository }   from '../../../src/infrastructure/repositories/CloudStorageRepository';
import { CourseServiceClient }      from '../../../src/infrastructure/clients/CourseServiceClient';

const makeRepo    = (): jest.Mocked<IAttachmentRepository> =>
  ({ findById: jest.fn(), create: jest.fn(), delete: jest.fn() });
const makeStorage = (): jest.Mocked<CloudStorageRepository> =>
  ({ upload: jest.fn(), getSignedUrl: jest.fn(), delete: jest.fn() } as unknown as jest.Mocked<CloudStorageRepository>);
const makeClient  = (): jest.Mocked<CourseServiceClient> =>
  ({ getSubject: jest.fn() } as unknown as jest.Mocked<CourseServiceClient>);

const INPUT = { subjectId: 'sub1', buffer: Buffer.from('test'), filename: 'test.pdf', mimeType: 'application/pdf', sizeBytes: 4 };

describe('UploadAttachmentUseCase', () => {
  let repo:    jest.Mocked<IAttachmentRepository>;
  let storage: jest.Mocked<CloudStorageRepository>;
  let client:  jest.Mocked<CourseServiceClient>;
  let useCase: UploadAttachmentUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo    = makeRepo();
    storage = makeStorage();
    client  = makeClient();
    useCase = new UploadAttachmentUseCase(repo, storage, client);
  });

  it('uploads file and returns attachment record', async () => {
    client.getSubject.mockResolvedValue({ id: 'sub1', courseId: 'c1' });
    storage.upload.mockResolvedValue(undefined);
    repo.create.mockResolvedValue(undefined);

    const result = await useCase.execute(INPUT);
    expect(result.subjectId).toBe('sub1');
    expect(result.courseId).toBe('c1');
    expect(result.mimeType).toBe('application/pdf');
    expect(storage.upload).toHaveBeenCalledTimes(1);
    expect(repo.create).toHaveBeenCalledTimes(1);
  });

  it('throws 404 when subject not found', async () => {
    client.getSubject.mockResolvedValue(null);
    await expect(useCase.execute(INPUT)).rejects.toMatchObject({ status: 404, errorCode: 'SUBJECT_NOT_FOUND' });
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it.each([
    ['image/png',   'photo.PNG',  'png'],
    ['image/jpeg',  'photo.JPEG', 'jpg'],
    ['image/jpeg',  'photo.jpg',  'jpg'],
    ['application/pdf', 'doc.pdf', 'pdf'],
    ['application/msword', 'doc.doc', 'doc'],
    ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'doc.docx', 'docx'],
  ])('derives extension from MIME type for %s (filename: %s → .%s)', async (mimeType, filename, expectedExt) => {
    client.getSubject.mockResolvedValue({ id: 'sub1', courseId: 'c1' });
    storage.upload.mockResolvedValue(undefined);
    repo.create.mockResolvedValue(undefined);

    await useCase.execute({ ...INPUT, mimeType, filename });

    const [_buf, storagePath] = storage.upload.mock.calls[0];
    expect(storagePath).toMatch(new RegExp(`\\.${expectedExt}$`));
  });
});
