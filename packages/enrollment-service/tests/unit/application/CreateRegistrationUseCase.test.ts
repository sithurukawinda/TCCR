import { CreateRegistrationUseCase } from '../../../src/application/use-cases/CreateRegistrationUseCase';
import { IRegistrationRepository }  from '../../../src/domain/repositories/IRegistrationRepository';

const makeRepo = (): jest.Mocked<IRegistrationRepository> => ({
  findById: jest.fn(),
  findAll:  jest.fn(),
  create:   jest.fn(),
  update:   jest.fn(),
});

const INPUT = { studentUid: 'uid-1', email: 'u@example.com', firstName: 'Alice', lastName: 'Smith' };

describe('CreateRegistrationUseCase', () => {
  let repo:    jest.Mocked<IRegistrationRepository>;
  let useCase: CreateRegistrationUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo    = makeRepo();
    useCase = new CreateRegistrationUseCase(repo);
  });

  it('creates a registration with state=pending', async () => {
    repo.create.mockResolvedValue(undefined);

    const reg = await useCase.execute(INPUT);

    expect(reg.state).toBe('pending');
    expect(reg.studentUid).toBe('uid-1');
    expect(reg.email).toBe('u@example.com');
    expect(repo.create).toHaveBeenCalledTimes(1);
  });

  it('sets reason to null by default', async () => {
    repo.create.mockResolvedValue(undefined);

    const reg = await useCase.execute(INPUT);

    expect(reg.reason).toBeNull();
  });

  it('uses studentUid as the registration id', async () => {
    repo.create.mockResolvedValue(undefined);

    const reg = await useCase.execute(INPUT);

    expect(reg.id).toBe('uid-1');
  });

  it('propagates repo errors', async () => {
    repo.create.mockRejectedValue(new Error('Firestore error'));
    await expect(useCase.execute(INPUT)).rejects.toThrow('Firestore error');
  });
});
