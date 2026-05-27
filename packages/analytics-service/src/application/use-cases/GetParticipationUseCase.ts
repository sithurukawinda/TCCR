import { IAnalyticsRepository } from '../../domain/repositories/IAnalyticsRepository';
import { resolveScope, AnalyticsFilters } from '../helpers/scope';
import { Role }                  from '@shared/auth-middleware';

export interface ParticipationResponse {
  scope: string;
  data: Array<{
    leaderUid:         string;
    leaderName:        string;
    averageAttendance: number;
    cellCount:         number;
  }>;
}

export class GetParticipationUseCase {
  constructor(private readonly repo: IAnalyticsRepository) {}

  async execute(uid: string, roles: Role[], filters?: AnalyticsFilters): Promise<ParticipationResponse> {
    const scope    = resolveScope(uid, roles, filters);
    const snapshot = await this.repo.findLatestByScope(scope);

    return {
      scope,
      data: snapshot?.metrics.participationByLeader ?? [],
    };
  }
}
