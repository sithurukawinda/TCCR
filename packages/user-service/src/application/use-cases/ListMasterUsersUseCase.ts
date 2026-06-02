import { IUserRepository, FindAllResult } from '../../domain/repositories/IUserRepository';

export class ListMasterUsersUseCase {
  constructor(private readonly userRepo: IUserRepository) {}

  async execute(limit = 20, cursor?: string): Promise<FindAllResult> {
    return this.userRepo.findAll({ limit, cursor, role: 'master' });
  }
}
