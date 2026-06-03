import { IAnalyticsRepository } from '../../domain/repositories/IAnalyticsRepository';
import { resolveScope, AnalyticsFilters } from '../helpers/scope';
import { Role }                  from '@shared/auth-middleware';

export interface GrowthTrendResponse {
  scope: string;
  data: Array<{
    periodKey:         string;
    memberGrowth:      number;
    participationRate: number;
  }>;
}

export class GetGrowthTrendUseCase {
  constructor(private readonly repo: IAnalyticsRepository) {}

  async execute(
    uid:               string,
    roles:             Role[],
    from?:             string,
    to?:               string,
    filters?:          AnalyticsFilters,
    reportsFullAccess?: boolean,
  ): Promise<GrowthTrendResponse> {
    const scope     = resolveScope(uid, roles, filters, reportsFullAccess);
    const snapshots = await this.repo.findByScope(scope, from, to, 52);

    const data = snapshots.map(s => ({
      periodKey:         s.periodKey,
      memberGrowth:      s.metrics.memberGrowth,
      participationRate: s.metrics.participationRate,
    }));

    return { scope, data };
  }
}
