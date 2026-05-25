import { IUserRepository } from '../../domain/repositories/IUserRepository';

export class CheckEmailExistsUseCase {
  constructor(private readonly userRepo: IUserRepository) {}

  async execute(email: string): Promise<{ exists: boolean }> {
    const user = await this.userRepo.findByEmail(email);
    return { exists: user !== null };
  }
}
