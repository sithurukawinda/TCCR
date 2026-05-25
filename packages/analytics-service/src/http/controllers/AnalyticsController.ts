import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest }             from '@shared/auth-middleware';
import { fromZodError }                     from '@shared/errors';
import { sendSuccess }                      from '@shared/response';
import { GetWeeklyCellsUseCase }            from '../../application/use-cases/GetWeeklyCellsUseCase';
import { GetAttendanceTrendUseCase }        from '../../application/use-cases/GetAttendanceTrendUseCase';
import { GetMeetingTypesUseCase }           from '../../application/use-cases/GetMeetingTypesUseCase';
import { GetGrowthTrendUseCase }            from '../../application/use-cases/GetGrowthTrendUseCase';
import { GetParticipationUseCase }          from '../../application/use-cases/GetParticipationUseCase';
import { ExportAnalyticsUseCase, ChartType } from '../../application/use-cases/ExportAnalyticsUseCase';
import { weeklyCellsSchema, attendanceSchema, growthSchema, exportSchema } from '../validators/analyticsValidator';

export class AnalyticsController {
  constructor(
    private readonly weeklyCellsUC:  GetWeeklyCellsUseCase,
    private readonly attendanceUC:   GetAttendanceTrendUseCase,
    private readonly meetingTypesUC: GetMeetingTypesUseCase,
    private readonly growthUC:       GetGrowthTrendUseCase,
    private readonly participationUC: GetParticipationUseCase,
    private readonly exportUC:        ExportAnalyticsUseCase,
  ) {}

  weeklyCells = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = weeklyCellsSchema.safeParse(req.query);
      if (!parsed.success) return next(fromZodError(parsed.error));
      const { uid, roles } = (req as AuthenticatedRequest).principal;
      const result = await this.weeklyCellsUC.execute(uid, roles, parsed.data.weeks);
      sendSuccess(res, result);
    } catch (err) { next(err); }
  };

  attendance = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = attendanceSchema.safeParse(req.query);
      if (!parsed.success) return next(fromZodError(parsed.error));
      const { uid, roles } = (req as AuthenticatedRequest).principal;
      const result = await this.attendanceUC.execute(uid, roles, parsed.data.from, parsed.data.to);
      sendSuccess(res, result);
    } catch (err) { next(err); }
  };

  meetingTypes = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { uid, roles } = (req as AuthenticatedRequest).principal;
      const result = await this.meetingTypesUC.execute(uid, roles);
      sendSuccess(res, result);
    } catch (err) { next(err); }
  };

  growth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = growthSchema.safeParse(req.query);
      if (!parsed.success) return next(fromZodError(parsed.error));
      const { uid, roles } = (req as AuthenticatedRequest).principal;
      const result = await this.growthUC.execute(uid, roles, parsed.data.from, parsed.data.to);
      sendSuccess(res, result);
    } catch (err) { next(err); }
  };

  participation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { uid, roles } = (req as AuthenticatedRequest).principal;
      const result = await this.participationUC.execute(uid, roles);
      sendSuccess(res, result);
    } catch (err) { next(err); }
  };

  export = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const chart  = req.params.chart as ChartType;
      const parsed = exportSchema.safeParse(req.query);
      if (!parsed.success) return next(fromZodError(parsed.error));
      const { uid, roles } = (req as AuthenticatedRequest).principal;
      const csv = await this.exportUC.execute(chart, uid, roles, {
        from:  parsed.data.from,
        to:    parsed.data.to,
        weeks: String(parsed.data.weeks),
      });
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="analytics-${chart}-export.csv"`);
      res.status(200).send(csv);
    } catch (err) { next(err); }
  };
}
