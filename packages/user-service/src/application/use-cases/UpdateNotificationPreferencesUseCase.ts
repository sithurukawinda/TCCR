import { createHttpError }        from '@shared/errors';
import { IUserRepository }         from '../../domain/repositories/IUserRepository';
import { NotificationPreferences } from '../../domain/entities/User';

export class UpdateNotificationPreferencesUseCase {
  constructor(private readonly userRepo: IUserRepository) {}

  async execute(uid: string, prefs: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
    const user = await this.userRepo.findById(uid);
    if (!user) throw createHttpError(404, 'USER_NOT_FOUND', 'User not found.');

    user.updateNotificationPreferences(prefs);
    await this.userRepo.update(user);
    return user.notificationPreferences;
  }
}
