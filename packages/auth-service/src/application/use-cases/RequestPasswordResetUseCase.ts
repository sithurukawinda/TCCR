import admin             from 'firebase-admin';
import { EmailClient }    from '../../infrastructure/clients/EmailClient';
import { logger }         from '@shared/logger';

export class RequestPasswordResetUseCase {
  constructor(
    private readonly emailClient: EmailClient,
  ) {}

  async execute(email: string): Promise<void> {
    // Generate Firebase password reset link (best-effort — silently null if user doesn't exist)
    let resetLink: string | null = null;
    try {
      resetLink = await admin.auth().generatePasswordResetLink(email);
    } catch (err) {
      // User may not exist in Firebase Auth — never surface this (email enumeration prevention)
      logger.debug({ email }, 'Could not generate Firebase reset link — user may not exist');
    }

    // Only send if we have a reset link — silently succeed otherwise (enumeration prevention)
    if (!resetLink) return;

    try {
      await this.emailClient.sendPasswordResetEmail(email, resetLink);
    } catch (err) {
      logger.error({ err, email }, 'Failed to send password reset email');
      // Never throw — always return 204 to prevent email enumeration
    }
  }
}
