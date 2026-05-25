import { createHttpError }  from '@shared/errors';
import { IUserRepository }  from '../../domain/repositories/IUserRepository';

const VALID_PROVIDERS = ['google', 'apple'] as const;
type Provider = typeof VALID_PROVIDERS[number];

export class UnlinkProviderUseCase {
  constructor(private readonly userRepo: IUserRepository) {}

  async execute(uid: string, provider: string): Promise<string[]> {
    if (!VALID_PROVIDERS.includes(provider as Provider)) {
      throw createHttpError(400, 'VALIDATION_ERROR', 'Provider must be "google" or "apple".');
    }

    const user = await this.userRepo.findById(uid);
    if (!user) throw createHttpError(404, 'USER_NOT_FOUND', 'User not found.');

    const providerId = provider === 'google' ? 'google.com' : 'apple.com';
    user.unlinkProvider(providerId); // throws 409 if only provider
    await this.userRepo.update(user);
    return user.providers;
  }
}
