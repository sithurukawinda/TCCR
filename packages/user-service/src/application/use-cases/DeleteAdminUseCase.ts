import { createHttpError }    from '@shared/errors';
import { IUserRepository }    from '../../domain/repositories/IUserRepository';
import { FirebaseAuthClient } from '../../infrastructure/clients/FirebaseAuthClient';

export class DeleteAdminUseCase {
  constructor(
    private readonly userRepo:   IUserRepository,
    private readonly authClient: FirebaseAuthClient,
  ) {}

  async execute(uid: string): Promise<void> {
    const user = await this.userRepo.findById(uid);
    if (!user) throw createHttpError(404, 'USER_NOT_FOUND', 'User not found.');
    if (user.role !== 'admin') throw createHttpError(404, 'USER_NOT_FOUND', 'User not found.');

    await this.userRepo.hardDelete(uid);
    await this.authClient.deleteUser(uid);
  }
}
