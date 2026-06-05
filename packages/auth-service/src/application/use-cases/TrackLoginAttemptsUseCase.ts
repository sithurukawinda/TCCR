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

    let attempts     = 1;
    let windowStart  = new Date(now).toISOString();
    let windowExpired = false;

    if (existing) {
      const windowAge = now - new Date(existing.windowStart).getTime();

      if (windowAge < WINDOW_MS) {
        attempts    = existing.attempts + 1;
        windowStart = existing.windowStart;
      } else {
        windowExpired = true; // window expired — reset to 1
      }
    }

    // Lockout self-heal: once the 15-minute window has elapsed, clear any
    // `disabled` flag a previous lockout set on the Firebase account so the user
    // can sign in again without admin intervention. Without this the account
    // stays permanently disabled — and because authenticate() uses
    // checkRevoked=true, a disabled account also invalidates any still-active
    // session on its next request, surfacing as a sudden "logged out" event.
    if (windowExpired) {
      try {
        const user = await getAuth().getUserByEmail(email);
        if (user.disabled) {
          await getAuth().updateUser(user.uid, { disabled: false });
        }
      } catch {
        // User may not exist — ignore
      }
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
