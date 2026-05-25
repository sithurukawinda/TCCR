import { createHttpError }     from '@shared/errors';
import { IUserRepository }     from '../../domain/repositories/IUserRepository';
import { FirebaseAuthClient }  from '../../infrastructure/clients/FirebaseAuthClient';

export interface ChangePasswordInput {
  uid:             string;
  currentPassword: string;
  newPassword:     string;
}

export class ChangePasswordUseCase {
  constructor(
    private readonly userRepo:    IUserRepository,
    private readonly authClient:  FirebaseAuthClient,
  ) {}

  async execute(input: ChangePasswordInput): Promise<void> {
    const user = await this.userRepo.findById(input.uid);
    if (!user) throw createHttpError(404, 'USER_NOT_FOUND', 'User not found.');

    await this.authClient.verifyPassword(user.email, input.currentPassword);
    await this.authClient.updatePassword(input.uid, input.newPassword);
  }
}
