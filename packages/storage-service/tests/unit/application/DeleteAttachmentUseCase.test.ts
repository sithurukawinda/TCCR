import { DeleteAttachmentUseCase }  from '../../../src/application/use-cases/DeleteAttachmentUseCase';
import { IAttachmentRepository }   from '../../../src/domain/repositories/IAttachmentRepository';
import { CloudStorageRepository }  from '../../../src/infrastructure/repositories/CloudStorageRepository';
import { Attachment }              from '../../../src/domain/entities/Attachment';

const makeAttachment = (): Attachment =>
  new Attachment({ id: 'att-1', subjectId: 'sub-1', courseId: 'c1', filename: 'doc.pdf', mimeType: 'application/pdf', sizeBytes: 1024, storagePath: 'attachments/att-1.pdf', createdAt: '2026-01-01T00:00:00.000Z' });

const makeAttachRepo = (): jest.Mocked<IAttachmentRepository> => ({
  findById: jest.fn(),
  create:   jest.fn(),
  delete:   jest.fn(),
});

const makeStorageRepo = (): jest.Mocked<CloudStorageRepository> => ({
  upload:       jest.fn(),
  getSignedUrl: jest.fn(),
  delete:       jest.fn(),
} as unknown as jest.Mocked<CloudStorageRepository>);

describe('DeleteAttachmentUseCase', () => {
  let attachRepo:  jest.Mocked<IAttachmentRepository>;
  let storageRepo: jest.Mocked<CloudStorageRepository>;
  let useCase:     DeleteAttachmentUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    attachRepo  = makeAttachRepo();
    storageRepo = makeStorageRepo();
    useCase     = new DeleteAttachmentUseCase(attachRepo, storageRepo);
  });

  it('deletes file from storage and removes attachment record', async () => {
    attachRepo.findById.mockResolvedValue(makeAttachment());
    storageRepo.delete.mockResolvedValue(undefined);
    attachRepo.delete.mockResolvedValue(undefined);

    await useCase.execute('att-1');

    expect(storageRepo.delete).toHaveBeenCalledWith('attachments/att-1.pdf');
    expect(attachRepo.delete).toHaveBeenCalledWith('att-1');
  });

  it('throws 404 ATTACHMENT_NOT_FOUND when attachment does not exist', async () => {
    attachRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute('att-1')).rejects.toMatchObject({
      status:    404,
      errorCode: 'ATTACHMENT_NOT_FOUND',
    });
    expect(storageRepo.delete).not.toHaveBeenCalled();
  });

  it('propagates errors from storage delete', async () => {
    attachRepo.findById.mockResolvedValue(makeAttachment());
    storageRepo.delete.mockRejectedValue(new Error('GCS error'));

    await expect(useCase.execute('att-1')).rejects.toThrow('GCS error');
    expect(attachRepo.delete).not.toHaveBeenCalled();
  });

  it('deletes the attachment metadata record using the correct id', async () => {
    attachRepo.findById.mockResolvedValue(makeAttachment());
    storageRepo.delete.mockResolvedValue(undefined);
    attachRepo.delete.mockResolvedValue(undefined);

    await useCase.execute('att-1');

    expect(attachRepo.delete).toHaveBeenCalledWith('att-1');
  });
});
