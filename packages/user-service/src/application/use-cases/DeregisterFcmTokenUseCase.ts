import { createHttpError } from '@shared/errors';
import { IUserRepository } from '../../domain/repositories/IUserRepository';

export class DeregisterFcmTokenUseCase {
  constructor(private readonly userRepo: IUserRepository) {}

  async execute(uid: string, token: string): Promise<void> {
    const user = await this.userRepo.findById(uid);
    if (!user) throw createHttpError(404, 'USER_NOT_FOUND', 'User not found.');

    if (!user.fcmTokens.includes(token)) return; // already absent — idempotent

    user.deregisterFcmToken(token);
    await this.userRepo.update(user);
  }
}
