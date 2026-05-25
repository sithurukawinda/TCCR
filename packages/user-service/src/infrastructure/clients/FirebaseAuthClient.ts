import { getAuth }         from 'firebase-admin/auth';
import { createHttpError } from '@shared/errors';
import { config }          from '../../config';

export interface CreateUserInput {
  email:       string;
  password:    string;
  displayName: string;
}

export class FirebaseAuthClient {
  async createUser(input: CreateUserInput): Promise<string> {
    try {
      const record = await getAuth().createUser({
        email:       input.email,
        password:    input.password,
        displayName: input.displayName,
      });
      return record.uid;
    } catch (err: unknown) {
      if ((err as { code?: string })?.code === 'auth/email-already-exists') {
        throw createHttpError(409, 'EMAIL_EXISTS', 'Email address already registered.');
      }
      throw err;
    }
  }

  async setCustomClaims(uid: string, claims: Record<string, unknown>): Promise<void> {
    await getAuth().setCustomUserClaims(uid, claims);
  }

  async disableUser(uid: string): Promise<void> {
    await getAuth().updateUser(uid, { disabled: true });
  }

  async enableUser(uid: string): Promise<void> {
    await getAuth().updateUser(uid, { disabled: false });
  }

  async updatePassword(uid: string, newPassword: string): Promise<void> {
    await getAuth().updateUser(uid, { password: newPassword });
  }

  async deleteUser(uid: string): Promise<void> {
    await getAuth().deleteUser(uid);
  }

  async verifyPassword(email: string, password: string): Promise<void> {
    const emulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
    const base = emulatorHost
      ? `http://${emulatorHost}/identitytoolkit.googleapis.com/v1`
      : 'https://identitytoolkit.googleapis.com/v1';
    const url = `${base}/accounts:signInWithPassword?key=${config.firebaseWebApiKey}`;
    const res = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password, returnSecureToken: false }),
    });
    if (!res.ok) {
      throw createHttpError(401, 'WRONG_PASSWORD', 'Current password is incorrect.');
    }
  }

  async generatePasswordResetLink(email: string): Promise<string> {
    return getAuth().generatePasswordResetLink(email);
  }

  async addRoleToUser(uid: string, role: string): Promise<void> {
    const record  = await getAuth().getUser(uid);
    const claims  = record.customClaims ?? {};
    const current: string[] = Array.isArray(claims.roles) ? (claims.roles as string[]) : [];
    if (current.includes(role)) return;
    await getAuth().setCustomUserClaims(uid, { ...claims, roles: [...current, role] });
  }

  async removeRoleFromUser(uid: string, role: string): Promise<void> {
    const record  = await getAuth().getUser(uid);
    const claims  = record.customClaims ?? {};
    const current: string[] = Array.isArray(claims.roles) ? (claims.roles as string[]) : [];
    await getAuth().setCustomUserClaims(uid, { ...claims, roles: current.filter(r => r !== role) });
  }
}