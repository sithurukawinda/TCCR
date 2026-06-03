import { IUserRepository } from '../../domain/repositories/IUserRepository';
import { User }            from '../../domain/entities/User';

export class GetMasterUseCase {
  constructor(private readonly userRepo: IUserRepository) {}

  async execute(): Promise<User | null> {
    const result = await this.userRepo.findAll({ roleInArray: 'master', limit: 5 });
    const active = result.items.find(u => u.status !== 'suspended');
    return active ?? result.items[0] ?? null;
  }
}
