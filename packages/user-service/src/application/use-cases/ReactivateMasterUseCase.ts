import { createHttpError }    from '@shared/errors';
import { IUserRepository }    from '../../domain/repositories/IUserRepository';
import { FirebaseAuthClient } from '../../infrastructure/clients/FirebaseAuthClient';
import { User }               from '../../domain/entities/User';

export class ReactivateMasterUseCase {
  constructor(
    private readonly userRepo:   IUserRepository,
    private readonly authClient: FirebaseAuthClient,
  ) {}

  async execute(uid: string): Promise<User> {
    const user = await this.userRepo.findById(uid);
    if (!user) throw createHttpError(404, 'USER_NOT_FOUND', 'User not found.');
    if (!user.roles.includes('master')) {
      throw createHttpError(404, 'USER_NOT_FOUND', 'Master user not found.');
    }
    if (!user.isSuspended()) {
      throw createHttpError(409, 'NOT_SUSPENDED', 'Master is not suspended.');
    }

    // Singleton guard — block reactivation if another active master exists
    const existing = await this.userRepo.findAll({ roleInArray: 'master', limit: 5 });
    const activeMaster = existing.items.find(u => u.uid !== uid && u.status !== 'suspended');
    if (activeMaster) {
      throw createHttpError(
        409,
        'MASTER_ALREADY_EXISTS',
        'Another active Master already exists.',
      );
    }

    user.reactivate();
    await this.userRepo.update(user);
    await this.authClient.enableUser(uid);

    return user;
  }
}
