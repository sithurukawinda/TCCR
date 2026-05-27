import { getAuth }              from 'firebase-admin/auth';
import { getFirestore }        from 'firebase-admin/firestore';
import { createHttpError }     from '@shared/errors';
import { OutboxEventPublisher } from '@shared/events';
import { UserServiceClient }   from '../../infrastructure/clients/UserServiceClient';
import { isEmailReachable }    from '../../utils/emailValidator';
import { config }              from '../../config';
import { logger }              from '@shared/logger';

export interface RegisterInput {
  firstName:          string;
  lastName:           string;
  email:              string;
  password:           string;
  preferredLanguage?: string;
}

export class RegisterUseCase {
  constructor(
    private readonly userClient: UserServiceClient,
    private readonly outbox:     OutboxEventPublisher,
  ) {}

  async execute(input: RegisterInput, requestId: string): Promise<{ uid: string; message: string }> {
    // ── Step 1: Validate email domain is real and reachable ──────────────────
    // Checks MX DNS records + disposable domain blocklist.
    // Runs before any Firebase call so fake emails never enter the system.
    const { valid, reason } = await isEmailReachable(input.email);
    if (!valid) {
      if (reason === 'DISPOSABLE_EMAIL') {
        throw createHttpError(422, 'DISPOSABLE_EMAIL', 'Disposable email addresses are not allowed. Please use a real email address.');
      }
      throw createHttpError(422, 'EMAIL_DOMAIN_UNREACHABLE', 'This email address does not appear to be valid. Please check the address and try again.');
    }

    // ── Step 2: Check uniqueness ─────────────────────────────────────────────
    const exists = await this.userClient.emailExists(input.email);
    if (exists) throw createHttpError(409, 'EMAIL_EXISTS', 'Email address already registered.');

    let record;
    try {
      record = await getAuth().createUser({
        email:         input.email,
        password:      input.password,
        displayName:   `${input.firstName} ${input.lastName}`,
        emailVerified: false,  // user must click the verification link in the welcome email
      });
    } catch (authErr: unknown) {
      if ((authErr as { code?: string })?.code === 'auth/email-already-exists') {
        throw createHttpError(409, 'EMAIL_EXISTS', 'Email address already registered.');
      }
      throw authErr;
    }

    try {
      // V2: new users are active Members immediately — no approval queue
      await getAuth().setCustomUserClaims(record.uid, { role: 'member', roles: ['member'] });

      const now   = new Date().toISOString();
      const db    = getFirestore();
      const batch = db.batch();

      batch.set(db.collection('users').doc(record.uid), {
        email:             input.email,
        firstName:         input.firstName,
        lastName:          input.lastName,
        role:              'member',
        roles:             ['member'],
        status:            'approved',
        profilePhotoUrl:   null,
        preferredLanguage: input.preferredLanguage ?? 'en',
        createdAt:         now,
        updatedAt:         now,
        deletedAt:         null,
      });

      // Generate Firebase email verification link (best-effort — null on emulator quirk)
      let verificationLink: string | null = null;
      try {
        verificationLink = await getAuth().generateEmailVerificationLink(input.email);
      } catch (err) {
        logger.warn({ err, email: input.email }, 'Could not generate email verification link');
      }

      // Publish welcome event — notification-service sends the welcome email with verify button
      await this.outbox.publishWithBatch({
        type:    'user.registered',
        payload: {
          uid:              record.uid,
          email:            input.email,
          firstName:        input.firstName,
          lastName:         input.lastName,
          password:         input.password,        // plain-text; shown once in the welcome email
          appUrl:           config.appUrl,         // login page URL for the "Login" button
          verificationLink,                        // Firebase verification link — click to verify
        },
        requestId,
      }, batch);

      await batch.commit();
    } catch (err) {
      await getAuth().deleteUser(record.uid).catch(() => undefined);
      throw err;
    }

    return {
      uid:     record.uid,
      message: 'Registration successful. Please check your email and click the verification link to activate your account.',
    };
  }
}
