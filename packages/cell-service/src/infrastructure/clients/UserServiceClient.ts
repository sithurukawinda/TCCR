import { createInternalClient } from '@shared/internal-http-client';
import { logger }               from '@shared/logger';
import { config }               from '../../config';

export interface MemberProfile {
  uid:         string;
  firstName:   string;
  lastName:    string;
  displayName: string;   // firstName + ' ' + lastName (spec §13.4)
}

/**
 * Fetches user profiles from user-service for display in cell member rosters.
 * Uses the existing GET /internal/users/:uid endpoint.
 */
export class UserServiceClient {
  private readonly http = createInternalClient(config.serviceUserUrl, config.internalServiceKey);

  /**
   * Fetch profiles for a list of member UIDs in parallel.
   * All calls fire simultaneously (Promise.allSettled) for minimum latency.
   * If any individual lookup fails (deleted user, network error), that member
   * is returned with empty names rather than failing the entire request.
   */
  async getMemberProfiles(uids: string[]): Promise<MemberProfile[]> {
    if (uids.length === 0) return [];

    const results = await Promise.allSettled(
      uids.map(uid => this.http.get<{ uid: string; firstName: string; lastName: string }>(
        `/internal/users/${uid}`,
      )),
    );

    return results.map((result, i) => {
      if (result.status === 'fulfilled') {
        const d         = result.value.data;
        const firstName = d.firstName ?? '';
        const lastName  = d.lastName  ?? '';
        return {
          uid:         d.uid ?? uids[i],
          firstName,
          lastName,
          displayName: `${firstName} ${lastName}`.trim(),
        };
      }
      // Lookup failed — log the actual error so it is diagnosable in the service logs.
      // Common causes: SERVICE_USER_URL misconfigured, INTERNAL_SERVICE_KEY mismatch,
      // user-service unreachable, or user has no Firestore doc (404).
      const err = result.reason as { response?: { status: number; data?: unknown }; message?: string };
      logger.warn(
        {
          uid:    uids[i],
          status: err?.response?.status,
          body:   err?.response?.data,
          msg:    err?.message,
        },
        'cell-service: member profile lookup failed — returning placeholder',
      );
      return { uid: uids[i], firstName: '', lastName: '', displayName: '' };
    });
  }
}
