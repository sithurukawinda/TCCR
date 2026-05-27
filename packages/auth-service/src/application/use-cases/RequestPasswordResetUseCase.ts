import admin             from 'firebase-admin';
import { IOtpRepository } from '../../infrastructure/repositories/FirestoreOtpRepository';
import { EmailClient }    from '../../infrastructure/clients/EmailClient';
import { logger }         from '@shared/logger';

const OTP_TTL_MINUTES = 15;

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export class RequestPasswordResetUseCase {
  constructor(
    private readonly otpRepo:     IOtpRepository,
    private readonly emailClient: EmailClient,
  ) {}

  async execute(email: string): Promise<void> {
    const otp       = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();

    // Save OTP for in-app verification (Step 2)
    await this.otpRepo.save({ email, otp, expiresAt, attempts: 0 });

    // Generate Firebase password reset link (best-effort — silently null if user doesn't exist)
    let resetLink: string | null = null;
    try {
      resetLink = await admin.auth().generatePasswordResetLink(email);
    } catch (err) {
      // User may not exist in Firebase Auth — never surface this (email enumeration prevention)
      logger.debug({ email }, 'Could not generate Firebase reset link — user may not exist');
    }

    // Send one email with both the OTP code and (if available) the direct reset link
    try {
      await this.emailClient.sendPasswordResetEmail(email, otp, resetLink);
    } catch (err) {
      logger.error({ err, email }, 'Failed to send password reset email');
      // Never throw — always return 204 to prevent email enumeration
    }
  }
}
