import { AnalyticsSnapshot } from '../entities/AnalyticsSnapshot';

export interface IAnalyticsRepository {
  findByScope(scope: string, from?: string, to?: string, limit?: number): Promise<AnalyticsSnapshot[]>;
  findLatestByScope(scope: string): Promise<AnalyticsSnapshot | null>;
}
