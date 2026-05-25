import { OAuth2Client }  from 'google-auth-library';
import { createHttpError } from '@shared/errors';
import { config }          from '../../config';

export interface GooglePayload {
  email:     string;
  name:      string;
  googleUid: string; // Google's sub claim
}

export class GoogleAuthClient {
  private readonly client: OAuth2Client;

  constructor() {
    this.client = new OAuth2Client(config.googleClientId);
  }

  async verifyIdToken(idToken: string): Promise<GooglePayload> {
    // Emulator bypass: accept base64-encoded JSON test payload in non-production
    if (process.env.FIREBASE_AUTH_EMULATOR_HOST && process.env.NODE_ENV !== 'production') {
      try {
        const parsed = JSON.parse(Buffer.from(idToken, 'base64').toString('utf8')) as Record<string, unknown>;
        if (typeof parsed?.email === 'string') {
          return {
            email:     parsed.email,
            name:      (parsed.name as string | undefined) ?? parsed.email.split('@')[0],
            googleUid: (parsed.sub  as string | undefined) ?? parsed.email,
          };
        }
      } catch { /* not a test payload — fall through to real verification */ }
    }

    try {
      const ticket  = await this.client.verifyIdToken({
        idToken,
        audience: config.googleClientId || undefined,
      });
      const payload = ticket.getPayload();
      if (!payload?.email) {
        throw createHttpError(401, 'FEDERATED_TOKEN_INVALID', 'Google token is missing email claim.');
      }
      return {
        email:     payload.email,
        name:      payload.name ?? payload.email.split('@')[0],
        googleUid: payload.sub,
      };
    } catch (err: unknown) {
      if ((err as { status?: number }).status === 401) throw err;
      throw createHttpError(401, 'FEDERATED_TOKEN_INVALID', 'Google ID token verification failed.');
    }
  }
}
