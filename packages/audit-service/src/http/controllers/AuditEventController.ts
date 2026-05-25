import { Request, Response, NextFunction } from 'express';
import { fromZodError }                     from '@shared/errors';
import { logger }                           from '@shared/logger';
import { AuditEventHandler }               from '../../application/handlers/AuditEventHandler';
import { internalEventSchema }              from '../validators/auditValidator';

export class AuditEventController {
  constructor(private readonly auditHandler: AuditEventHandler) {}

  receiveEvent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = internalEventSchema.safeParse(req.body);
      if (!parsed.success) return next(fromZodError(parsed.error));

      const { eventType, payload, requestId } = parsed.data;

      if (eventType === 'audit.action') {
        await this.auditHandler.handle(
          payload as Parameters<typeof this.auditHandler.handle>[0],
          requestId,
        );
      } else {
        // Any event type → write a generic audit record
        await this.auditHandler.handle(
          { action: eventType, ...payload } as Parameters<typeof this.auditHandler.handle>[0],
          requestId,
        );
        logger.info({ eventType }, 'Audit record created');
      }

      res.status(204).send();
    } catch (err) { next(err); }
  };
}
