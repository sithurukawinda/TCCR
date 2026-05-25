import { createHttpError }  from '@shared/errors';
import { IUserRepository }  from '../../domain/repositories/IUserRepository';
import { User }             from '../../domain/entities/User';

export class GetMeUseCase {
  constructor(private readonly userRepo: IUserRepository) {}

  async execute(uid: string): Promise<User> {
    const user = await this.userRepo.findById(uid);
    if (!user) throw createHttpError(404, 'USER_NOT_FOUND', 'User not found.');
    return user;
  }
}
