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

    await this.otpRepo.save({ email, otp, expiresAt, attempts: 0 });

    try {
      await this.emailClient.sendOtp(email, otp);
    } catch (err) {
      logger.error({ err, email }, 'Failed to send OTP email');
      // Never throw — always return 204 to prevent email enumeration
    }
  }
}
