import { createHttpError }  from '@shared/errors';
import { IOtpRepository }   from '../../infrastructure/repositories/FirestoreOtpRepository';
import { config }           from '../../config';

const MAX_ATTEMPTS = 5;

export class VerifyOtpAndResetUseCase {
  constructor(private readonly otpRepo: IOtpRepository) {}

  async execute(email: string, otp: string): Promise<void> {
    const record = await this.otpRepo.findByEmail(email);

    if (!record) {
      throw createHttpError(400, 'INVALID_OTP', 'Invalid or expired verification code.');
    }

    if (new Date() > new Date(record.expiresAt)) {
      await this.otpRepo.delete(email);
      throw createHttpError(400, 'OTP_EXPIRED', 'Verification code has expired. Please request a new one.');
    }

    if (record.attempts >= MAX_ATTEMPTS) {
      await this.otpRepo.delete(email);
      throw createHttpError(400, 'OTP_MAX_ATTEMPTS', 'Too many incorrect attempts. Please request a new code.');
    }

    if (record.otp !== otp) {
      await this.otpRepo.save({ ...record, attempts: record.attempts + 1 });
      const remaining = MAX_ATTEMPTS - record.attempts - 1;
      throw createHttpError(400, 'INVALID_OTP', `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`);
    }

    // OTP is valid — delete it and trigger Firebase password reset email
    await this.otpRepo.delete(email);
    await this.sendFirebaseResetEmail(email);
  }

  private async sendFirebaseResetEmail(email: string): Promise<void> {
    const emulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
    const base = emulatorHost
      ? `http://${emulatorHost}/identitytoolkit.googleapis.com/v1`
      : 'https://identitytoolkit.googleapis.com/v1';
    const url = `${base}/accounts:sendOobCode?key=${config.firebaseWebApiKey}`;

    await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ requestType: 'PASSWORD_RESET', email }),
    }).catch(() => undefined);
  }
}
