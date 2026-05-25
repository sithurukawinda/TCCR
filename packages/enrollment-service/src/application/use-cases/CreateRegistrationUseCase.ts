import { IRegistrationRepository } from '../../domain/repositories/IRegistrationRepository';
import { Registration }            from '../../domain/entities/Registration';

export interface CreateRegistrationInput {
  studentUid: string;
  email:      string;
  firstName:  string;
  lastName:   string;
}

export class CreateRegistrationUseCase {
  constructor(private readonly regRepo: IRegistrationRepository) {}

  async execute(input: CreateRegistrationInput): Promise<Registration> {
    const now = new Date().toISOString();
    const reg = new Registration({
      id:         input.studentUid,
      studentUid: input.studentUid,
      email:      input.email,
      firstName:  input.firstName,
      lastName:   input.lastName,
      state:      'pending',
      reason:     null,
      createdAt:  now,
      updatedAt:  now,
    });
    await this.regRepo.create(reg);
    return reg;
  }
}
