import { GetDownloadUrlUseCase }    from '../../../src/application/use-cases/GetDownloadUrlUseCase';
import { IAttachmentRepository }   from '../../../src/domain/repositories/IAttachmentRepository';
import { CloudStorageRepository }  from '../../../src/infrastructure/repositories/CloudStorageRepository';
import { EnrollmentServiceClient } from '../../../src/infrastructure/clients/EnrollmentServiceClient';
import { Attachment }              from '../../../src/domain/entities/Attachment';

const makeAttachment = (): Attachment =>
  new Attachment({ id: 'att1', subjectId: 'sub1', courseId: 'c1', filename: 'f.pdf', mimeType: 'application/pdf', sizeBytes: 100, storagePath: 'attachments/sub1/att1.pdf', createdAt: '2026-01-01T00:00:00.000Z' });

const makeRepo    = (): jest.Mocked<IAttachmentRepository> =>
  ({ findById: jest.fn(), create: jest.fn(), delete: jest.fn() });
const makeStorage = (): jest.Mocked<CloudStorageRepository> =>
  ({ upload: jest.fn(), getSignedUrl: jest.fn(), delete: jest.fn() } as unknown as jest.Mocked<CloudStorageRepository>);
const makeClient  = (): jest.Mocked<EnrollmentServiceClient> =>
  ({ isEnrolled: jest.fn() } as unknown as jest.Mocked<EnrollmentServiceClient>);

describe('GetDownloadUrlUseCase', () => {
  let repo:    jest.Mocked<IAttachmentRepository>;
  let storage: jest.Mocked<CloudStorageRepository>;
  let client:  jest.Mocked<EnrollmentServiceClient>;
  let useCase: GetDownloadUrlUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo    = makeRepo();
    storage = makeStorage();
    client  = makeClient();
    useCase = new GetDownloadUrlUseCase(repo, storage, client);
  });

  it('returns signed URL for enrolled student', async () => {
    repo.findById.mockResolvedValue(makeAttachment());
    client.isEnrolled.mockResolvedValue(true);
    storage.getSignedUrl.mockResolvedValue('https://signed-url.example.com');

    const result = await useCase.execute('att1', 'uid1', 'student');
    expect(result.downloadUrl).toBe('https://signed-url.example.com');
    expect(result.expiresAt).toBeTruthy();
  });

  it('throws 403 for non-enrolled student', async () => {
    repo.findById.mockResolvedValue(makeAttachment());
    client.isEnrolled.mockResolvedValue(false);

    await expect(useCase.execute('att1', 'uid1', 'student')).rejects.toMatchObject({ status: 403 });
  });

  it('returns signed URL for admin without enrollment check', async () => {
    repo.findById.mockResolvedValue(makeAttachment());
    storage.getSignedUrl.mockResolvedValue('https://signed-url.example.com');

    const result = await useCase.execute('att1', 'admin-uid', 'admin');
    expect(result.downloadUrl).toBeTruthy();
    expect(client.isEnrolled).not.toHaveBeenCalled();
  });

  it('throws 404 when attachment not found', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(useCase.execute('att1', 'uid1', 'admin')).rejects.toMatchObject({ status: 404 });
  });
});
