import { IAnalyticsRepository } from '../../domain/repositories/IAnalyticsRepository';
import { resolveScope, getISOWeekKey, AnalyticsFilters } from '../helpers/scope';
import { Role } from '@shared/auth-middleware';

export interface MeetingTypesResponse {
  scope:     string;
  period:    string;
  breakdown: { g12: number; care: number; children: number; outreach: number };
}

export class GetMeetingTypesUseCase {
  constructor(private readonly repo: IAnalyticsRepository) {}

  async execute(uid: string, roles: Role[], filters?: AnalyticsFilters): Promise<MeetingTypesResponse> {
    const scope    = resolveScope(uid, roles, filters);
    const snapshot = await this.repo.findLatestByScope(scope);
    const period   = snapshot?.periodKey ?? getISOWeekKey(new Date());

    return {
      scope,
      period,
      breakdown: snapshot?.metrics.meetingTypeBreakdown ?? { g12: 0, care: 0, children: 0, outreach: 0 },
    };
  }
}
