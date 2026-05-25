import { FirestoreAnalyticsRepository } from './infrastructure/repositories/FirestoreAnalyticsRepository';
import { GetWeeklyCellsUseCase }         from './application/use-cases/GetWeeklyCellsUseCase';
import { GetAttendanceTrendUseCase }     from './application/use-cases/GetAttendanceTrendUseCase';
import { GetMeetingTypesUseCase }        from './application/use-cases/GetMeetingTypesUseCase';
import { GetGrowthTrendUseCase }         from './application/use-cases/GetGrowthTrendUseCase';
import { GetParticipationUseCase }       from './application/use-cases/GetParticipationUseCase';
import { ExportAnalyticsUseCase }        from './application/use-cases/ExportAnalyticsUseCase';
import { AnalyticsController }           from './http/controllers/AnalyticsController';

const repo = new FirestoreAnalyticsRepository();

export const container = {
  analyticsController: new AnalyticsController(
    new GetWeeklyCellsUseCase(repo),
    new GetAttendanceTrendUseCase(repo),
    new GetMeetingTypesUseCase(repo),
    new GetGrowthTrendUseCase(repo),
    new GetParticipationUseCase(repo),
    new ExportAnalyticsUseCase(repo),
  ),
};
