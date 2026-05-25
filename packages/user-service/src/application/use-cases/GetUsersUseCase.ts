import { IUserRepository, FindAllOptions, FindAllResult } from '../../domain/repositories/IUserRepository';
import { Role }                                           from '@shared/auth-middleware';

export class GetUsersUseCase {
  constructor(private readonly userRepo: IUserRepository) {}

  async execute(opts: FindAllOptions, callerRoles: Role[] = []): Promise<FindAllResult> {
    const isAdmin = callerRoles.includes('admin') || callerRoles.includes('super_admin');

    if (!isAdmin) {
      // Leaders and G12: only see approved non-admin members
      return this.userRepo.findAll({
        ...opts,
        status:       'approved',
        excludeRoles: ['admin', 'super_admin'],
      });
    }

    return this.userRepo.findAll(opts);
  }
}
