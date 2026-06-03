import { createHttpError }    from '@shared/errors';
import { IUserRepository }    from '../../domain/repositories/IUserRepository';
import { FirebaseAuthClient } from '../../infrastructure/clients/FirebaseAuthClient';
import { User }               from '../../domain/entities/User';

export class RevokeTempReportAccessUseCase {
  constructor(
    private readonly userRepo:   IUserRepository,
    private readonly authClient: FirebaseAuthClient,
  ) {}

  async execute(uid: string): Promise<User> {
    const user = await this.userRepo.findById(uid);
    if (!user) throw createHttpError(404, 'USER_NOT_FOUND', 'User not found.');

    user.tempReportAccess = false;
    await this.userRepo.update(user);
    await this.authClient.setTempReportAccess(uid, false);

    return user;
  }
}
