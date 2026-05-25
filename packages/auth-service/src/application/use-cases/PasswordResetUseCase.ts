import { config } from '../../config';

export class PasswordResetUseCase {
  async execute(email: string): Promise<void> {
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
    // Always succeed — never reveal whether email exists (spec §4)
  }
}
