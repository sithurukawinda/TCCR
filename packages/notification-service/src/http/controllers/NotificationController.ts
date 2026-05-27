import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest }             from '@shared/auth-middleware';
import { fromZodError, createHttpError }    from '@shared/errors';
import { sendSuccess, sendPaginated }       from '@shared/response';
import { INotificationRepository }         from '../../domain/repositories/INotificationRepository';
import { listNotificationsSchema }          from '../validators/notificationValidator';

export class NotificationController {
  constructor(private readonly notifRepo: INotificationRepository) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = listNotificationsSchema.safeParse(req.query);
      if (!parsed.success) return next(fromZodError(parsed.error));
      const { uid } = (req as AuthenticatedRequest).principal;
      const result  = await this.notifRepo.findByUser(uid, { limit: parsed.data.limit, cursor: parsed.data.cursor, read: parsed.data.read });
      sendPaginated(res, result.items, result.nextCursor, result.total);
    } catch (err) { next(err); }
  };

  markRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { uid } = (req as AuthenticatedRequest).principal;
      await this.notifRepo.markRead(req.params.id, uid);
      sendSuccess(res, { id: req.params.id, read: true });
    } catch (err) { next(err); }
  };

  markAllRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { uid } = (req as AuthenticatedRequest).principal;
      await this.notifRepo.markAllRead(uid);
      sendSuccess(res, { message: 'All notifications marked as read.' });
    } catch (err) { next(err); }
  };
}

// Keep createHttpError import used
void createHttpError;
