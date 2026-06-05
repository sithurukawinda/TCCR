import { Request, Response, NextFunction } from 'express';
import { getAuth }                         from 'firebase-admin/auth';
import { createHttpError }                 from '@shared/errors';
import { logger }                          from '@shared/logger';

export type Role = 'member' | 'student' | 'leader' | 'g12' | 'admin' | 'super_admin' | 'master';

export interface Principal {
  uid:               string;
  email:             string;
  role:              Role;   // primary role (for backward compat — use roles[] for authorization)
  roles:             Role[]; // full additive roles array e.g. ["member","student","leader"]
  tempReportAccess:  boolean; // temporary org-wide report access granted by super_admin
  reportsFullAccess: boolean; // org-wide report access granted to a G12 user by super_admin
  tempMasterAccess:  boolean; // time-limited master-level access for G12 user (computed from expiresAt claim)
}

export interface AuthenticatedRequest extends Request {
  principal: Principal;
}

export interface AuthenticateOptions {
  /**
   * When true, the email-verification gate is bypassed.
   * Use on routes that must remain accessible before the user verifies their
   * email address (e.g. POST /auth/logout, POST /auth/apple/revoke).
   */
  allowUnverified?: boolean;
  /**
   * Absolute session cap, in seconds. The session is forced to expire this long
   * after the user actually signed in (the token's `auth_time` claim), regardless
   * of how many times the ID token has silently refreshed. Defaults to
   * SESSION_MAX_AGE_SECONDS (4 hours). Pass 0 to disable the cap for a route.
   */
  maxSessionAgeSeconds?: number;
}

/**
 * Absolute session lifetime, in seconds. Firebase ID tokens themselves only live
 * 1 hour and the client SDK refreshes them silently — `auth_time` does NOT change
 * on refresh, so it is the true wall-clock age of the session. Once the session is
 * older than this, `authenticate()` returns 401 SESSION_EXPIRED and the client must
 * sign the user in again (hard logout — not a token refresh). Override per-process
 * via the SESSION_MAX_AGE_SECONDS env var; default 4 hours (14400 s).
 *
 * (Read from process.env here rather than a service config.ts because this is a
 * shared library consumed by every service — it has no config.ts of its own.)
 */
const SESSION_MAX_AGE_SECONDS = Number(process.env.SESSION_MAX_AGE_SECONDS) || 4 * 60 * 60;

// ── authenticate ─────────────────────────────────────────────────────────────

/**
 * Build a structured, token-free context object for auth-failure logging.
 * The raw token is never included — the logger additionally redacts the
 * `authorization` header, so it is safe to attach `req` elsewhere.
 */
function authFailureContext(req: Request, errorCode: string, firebaseCode?: string) {
  return {
    errorCode,
    firebaseCode,
    method:    req.method,
    path:      req.originalUrl ?? req.url,
    requestId: req.headers['x-request-id'],
    ip:        req.ip,
  };
}

export function authenticate(options: AuthenticateOptions = {}) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      logger.debug(authFailureContext(req, 'MISSING_TOKEN'), 'auth: missing/malformed Authorization header');
      return next(createHttpError(401, 'MISSING_TOKEN', 'Authorization header is missing or malformed.'));
    }

    const token = authHeader.slice(7);

    try {
      const decoded = await getAuth().verifyIdToken(token, true); // checkRevoked=true

      // decoded.role  — top-level claim written by setCustomUserClaims (may lag on brand-new
      //                 federated accounts before Firebase propagates the write globally).
      // fbClaims.role — written by developerClaims in createCustomToken; always present in the
      //                 very first ID token issued via signInWithCustomToken.
      const fbClaims = (decoded.firebase as Record<string, unknown> | undefined)?.['claims'] as Record<string, unknown> | undefined;
      const role     = (decoded.role ?? fbClaims?.['role']) as Role | undefined;

      if (!role) {
        logger.warn(authFailureContext(req, 'INVALID_TOKEN'), 'auth: token missing role claim');
        return next(createHttpError(401, 'INVALID_TOKEN', 'Token is missing role claim.'));
      }

      const roles = ((decoded.roles ?? fbClaims?.['roles']) as Role[] | undefined) ?? [role];

      // Absolute session cap — force re-authentication a fixed time after the user
      // actually signed in. `auth_time` is the Unix-seconds timestamp of the real
      // sign-in and does NOT advance when the ID token auto-refreshes, so this is a
      // true session age (not a token age). Distinct from TOKEN_EXPIRED: the client
      // must NOT refresh-and-retry on SESSION_EXPIRED — it must sign the user out.
      // Skipped on allowUnverified routes (logout/revoke) so a user past the cap can
      // still cleanly end their session. Skipped if auth_time is absent (legacy tokens).
      const maxSessionAge = options.maxSessionAgeSeconds ?? SESSION_MAX_AGE_SECONDS;
      if (!options.allowUnverified && maxSessionAge > 0 && typeof decoded.auth_time === 'number') {
        const sessionAgeSeconds = Math.floor(Date.now() / 1000) - decoded.auth_time;
        if (sessionAgeSeconds > maxSessionAge) {
          logger.info(authFailureContext(req, 'SESSION_EXPIRED'), 'auth: session exceeded max age');
          return next(createHttpError(401, 'SESSION_EXPIRED', 'Session expired. Please sign in again.'));
        }
      }

      // Email-verification gate — reject unverified users unless the route explicitly
      // opts out (allowUnverified: true). Federated users (Google/Apple) always have
      // email_verified=true in Firebase so they are never affected by this check.
      if (!options.allowUnverified && decoded.email_verified === false) {
        logger.info(authFailureContext(req, 'EMAIL_NOT_VERIFIED'), 'auth: email not verified');
        return next(createHttpError(
          403,
          'EMAIL_NOT_VERIFIED',
          'Please verify your email address before continuing. Check your inbox or resend via POST /auth/resend-verification.',
        ));
      }

      const tmaExpiry = decoded.tempMasterAccessExpiresAt as string | undefined;

      (req as AuthenticatedRequest).principal = {
        uid:               decoded.uid,
        email:             decoded.email ?? '',
        role,
        roles,
        tempReportAccess:  decoded.tempReportAccess  === true,
        reportsFullAccess: decoded.reportsFullAccess === true,
        tempMasterAccess:  !!tmaExpiry && new Date(tmaExpiry) > new Date(),
      };

      next();
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;

      // Client contract for these auth failures:
      //   TOKEN_EXPIRED                     → silently refresh the Firebase ID token
      //                                       (getIdToken(true)) and retry the request once.
      //   TOKEN_REVOKED / ACCOUNT_DISABLED  → end the session (hard logout); do not retry.
      //   INVALID_TOKEN / MISSING_TOKEN     → treat as unauthenticated.
      // Treating *every* 401 as a hard logout is the usual cause of the
      // "auto-logged-out after ~1 hour" symptom — that 401 is TOKEN_EXPIRED and
      // is recoverable via a token refresh.
      if (code === 'auth/id-token-revoked') {
        logger.warn(authFailureContext(req, 'TOKEN_REVOKED', code), 'auth: id token revoked');
        return next(createHttpError(401, 'TOKEN_REVOKED', 'Session has been revoked.'));
      }
      if (code === 'auth/id-token-expired') {
        // Routine — Firebase ID tokens expire after 1 hour. Logged at info so the
        // signal is visible without being treated as an error: a user-visible
        // logout correlating with this line means the client is not refreshing.
        logger.info(authFailureContext(req, 'TOKEN_EXPIRED', code), 'auth: id token expired');
        return next(createHttpError(401, 'TOKEN_EXPIRED', 'Token has expired.'));
      }
      if (code === 'auth/user-disabled') {
        // checkRevoked=true surfaces disabled accounts (admin suspension or the
        // failed-login lockout) here. Return a distinct code so clients and logs
        // can tell a suspended account apart from a malformed token.
        logger.warn(authFailureContext(req, 'ACCOUNT_DISABLED', code), 'auth: account disabled');
        return next(createHttpError(403, 'ACCOUNT_DISABLED', 'This account has been disabled.'));
      }

      logger.warn(authFailureContext(req, 'INVALID_TOKEN', code), 'auth: token verification failed');
      return next(createHttpError(401, 'INVALID_TOKEN', 'Token could not be verified.'));
    }
  };
}

// ── authorize ────────────────────────────────────────────────────────────────

export function authorize(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const principal = (req as AuthenticatedRequest).principal;

    if (!principal) {
      return next(createHttpError(401, 'UNAUTHENTICATED', 'Authentication required.'));
    }

    // super_admin — G12 level access + analytics + add/suspend only (no admin CRUD)
    // master     — G12 level access + org-wide report visibility
    const effectiveRoles: Role[] = principal.roles.includes('super_admin')
      ? ([...new Set([...principal.roles, 'g12', 'leader', 'student', 'member'])] as Role[])
      : principal.roles.includes('master')
        ? (['master', 'g12', 'leader', 'student', 'member'] as Role[])
        : principal.roles;

    const allowed = roles.some(r => effectiveRoles.includes(r));

    if (!allowed) {
      return next(
        createHttpError(
          403,
          'FORBIDDEN',
          `Role '${principal.role}' is not permitted to perform this action.`,
        ),
      );
    }

    next();
  };
}

// ── mustBeOwnerOrAdmin ───────────────────────────────────────────────────────

export function mustBeOwnerOrAdmin(getResourceUid: (req: Request) => string | undefined) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const principal   = (req as AuthenticatedRequest).principal;
    const resourceUid = getResourceUid(req);

    if (!resourceUid) return next();

    const isOwner = principal.uid === resourceUid;
    const isAdmin = principal.roles.includes('admin');

    if (!isOwner && !isAdmin) {
      return next(
        createHttpError(403, 'FORBIDDEN', 'You do not have access to this resource.'),
      );
    }

    next();
  };
}
