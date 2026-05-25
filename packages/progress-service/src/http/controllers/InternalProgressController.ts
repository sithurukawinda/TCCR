import { Request, Response, NextFunction } from 'express';
import { fromZodError }                     from '@shared/errors';
import { ResetProgressUseCase }             from '../../application/use-cases/ResetProgressUseCase';
import { resetProgressSchema }              from '../validators/progressValidator';

export class InternalProgressController {
  constructor(private readonly resetUC: ResetProgressUseCase) {}

  reset = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = resetProgressSchema.safeParse(req.body);
      if (!parsed.success) return next(fromZodError(parsed.error));
      const requestId = (req.headers['x-request-id'] as string) ?? '';
      await this.resetUC.execute(parsed.data.studentUid, parsed.data.courseId, requestId);
      res.status(204).send();
    } catch (err) { next(err); }
  };
}
