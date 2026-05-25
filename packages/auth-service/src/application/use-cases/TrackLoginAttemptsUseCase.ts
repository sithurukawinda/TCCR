import { getAuth }                        from 'firebase-admin/auth';
import { ILoginAttemptsRepository }       from '../../infrastructure/repositories/FirestoreLoginAttemptsRepository';

const LOCKOUT_THRESHOLD = 10;
const WINDOW_MS         = 15 * 60 * 1000; // 15 minutes

export interface TrackResult {
  locked:   boolean;
  attempts: number;
}

export class TrackLoginAttemptsUseCase {
  constructor(private readonly attemptsRepo: ILoginAttemptsRepository) {}

  async execute(email: string): Promise<TrackResult> {
    const now      = Date.now();
    const existing = await this.attemptsRepo.findByEmail(email);

    let attempts    = 1;
    let windowStart = new Date(now).toISOString();

    if (existing) {
      const windowAge = now - new Date(existing.windowStart).getTime();

      if (windowAge < WINDOW_MS) {
        attempts    = existing.attempts + 1;
        windowStart = existing.windowStart;
      }
      // else: window expired — reset to 1
    }

    await this.attemptsRepo.save({ email, attempts, windowStart });

    if (attempts >= LOCKOUT_THRESHOLD) {
      try {
        const user = await getAuth().getUserByEmail(email);
        await getAuth().updateUser(user.uid, { disabled: true });
      } catch {
        // User may not exist — ignore
      }
      return { locked: true, attempts };
    }

    return { locked: false, attempts };
  }
}
