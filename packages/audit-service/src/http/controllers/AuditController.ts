import { Request, Response, NextFunction } from 'express';
import { fromZodError }                     from '@shared/errors';
import { sendPaginated }                    from '@shared/response';
import { IAuditRepository, AuditLogDTO, AuditListResult } from '../../domain/repositories/IAuditRepository';
import { auditQuerySchema, userAuditQuerySchema }         from '../validators/auditValidator';
import { TtlCache }                                       from '../../infrastructure/cache/TtlCache';

export class AuditController {
  constructor(private readonly auditRepo: IAuditRepository) {}

  private static readonly listCache = new TtlCache<AuditListResult>(60_000);

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = auditQuerySchema.safeParse(req.query);
      if (!parsed.success) return next(fromZodError(parsed.error));

      const cacheKey = JSON.stringify(parsed.data);
      const cached   = AuditController.listCache.get(cacheKey);
      if (cached) {
        const items: AuditLogDTO[] = cached.items.map(entry => ({
          id:         entry.id,
          when:       entry.createdAt,
          actor:      { uid: entry.actorUid, email: entry.actorEmail },
          action:     entry.action,
          category:   entry.category,
          ip:         entry.ip,
          targetType: entry.targetType,
          targetId:   entry.targetId,
          requestId:  entry.requestId,
        }));
        return sendPaginated(res, items, cached.nextCursor, cached.total);
      }

      const result = await this.auditRepo.findAll(parsed.data);
      AuditController.listCache.set(cacheKey, result);
      const items: AuditLogDTO[] = result.items.map(entry => ({
        id:         entry.id,
        when:       entry.createdAt,
        actor:      { uid: entry.actorUid, email: entry.actorEmail },
        action:     entry.action,
        category:   entry.category,
        ip:         entry.ip,
        targetType: entry.targetType,
        targetId:   entry.targetId,
        requestId:  entry.requestId,
      }));
      sendPaginated(res, items, result.nextCursor, result.total);
    } catch (err) { next(err); }
  };

  userTimeline = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = userAuditQuerySchema.safeParse(req.query);
      if (!parsed.success) return next(fromZodError(parsed.error));

      const result = await this.auditRepo.findAll({ ...parsed.data, actorUid: req.params.uid });
      const items: AuditLogDTO[] = result.items.map(entry => ({
        id:         entry.id,
        when:       entry.createdAt,
        actor:      { uid: entry.actorUid, email: entry.actorEmail },
        action:     entry.action,
        category:   entry.category,
        ip:         entry.ip,
        targetType: entry.targetType,
        targetId:   entry.targetId,
        requestId:  entry.requestId,
      }));
      sendPaginated(res, items, result.nextCursor, result.total);
    } catch (err) { next(err); }
  };
}
