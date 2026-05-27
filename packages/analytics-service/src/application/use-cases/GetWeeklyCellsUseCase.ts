import { IAnalyticsRepository } from '../../domain/repositories/IAnalyticsRepository';
import { resolveScope, lastNWeekKeys, AnalyticsFilters } from '../helpers/scope';
import { Role } from '@shared/auth-middleware';

export interface WeeklyCellsResponse {
  scope:      string;
  periodType: 'weekly';
  data: Array<{
    periodKey:   string;
    cellCount:   number;
    activeCells: number;
    reportCount: number;
  }>;
}

export class GetWeeklyCellsUseCase {
  constructor(private readonly repo: IAnalyticsRepository) {}

  async execute(
    uid:     string,
    roles:   Role[],
    weeks:   number,
    filters?: AnalyticsFilters,
  ): Promise<WeeklyCellsResponse> {
    const scope    = resolveScope(uid, roles, filters);
    const weekKeys = lastNWeekKeys(Math.min(weeks, 52));
    const from     = weekKeys[0];
    const to       = weekKeys[weekKeys.length - 1];

    const snapshots = await this.repo.findByScope(scope, from, to, weeks);
    const byKey     = new Map(snapshots.map(s => [s.periodKey, s]));

    const data = weekKeys.map(key => {
      const snap = byKey.get(key);
      return {
        periodKey:   key,
        cellCount:   snap?.metrics.cellCount   ?? 0,
        activeCells: snap?.metrics.activeCells ?? 0,
        reportCount: snap?.metrics.reportCount ?? 0,
      };
    });

    return { scope, periodType: 'weekly', data };
  }
}
