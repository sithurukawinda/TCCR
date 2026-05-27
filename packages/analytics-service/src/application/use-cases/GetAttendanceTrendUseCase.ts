import { IAnalyticsRepository } from '../../domain/repositories/IAnalyticsRepository';
import { resolveScope, AnalyticsFilters } from '../helpers/scope';
import { Role }                  from '@shared/auth-middleware';

export interface AttendanceTrendResponse {
  scope: string;
  data: Array<{
    periodKey:    string;
    present:      number;
    absent:       number;
    visitors:     number;
    children:     number;
    newAttendees: number;
  }>;
}

export class GetAttendanceTrendUseCase {
  constructor(private readonly repo: IAnalyticsRepository) {}

  async execute(
    uid:      string,
    roles:    Role[],
    from?:    string,
    to?:      string,
    filters?: AnalyticsFilters,
  ): Promise<AttendanceTrendResponse> {
    const scope     = resolveScope(uid, roles, filters);
    const snapshots = await this.repo.findByScope(scope, from, to, 52);

    const data = snapshots.map(s => ({
      periodKey:    s.periodKey,
      present:      s.metrics.attendance.present,
      absent:       s.metrics.attendance.absent,
      visitors:     s.metrics.attendance.visitors,
      children:     s.metrics.attendance.children,
      newAttendees: s.metrics.attendance.newAttendees,
    }));

    return { scope, data };
  }
}
