import { Request, Response, NextFunction } from 'express';
import { fromZodError }                    from '@shared/errors';
import { sendSuccess }                     from '@shared/response';
import { z }                               from 'zod';
import { GetStudentCourseUseCase }         from '../../application/use-cases/GetStudentCourseUseCase';

const studentCourseQuerySchema = z.object({
  batchId: z.string().uuid('batchId must be a UUID'),
});

export class StudentCourseController {
  constructor(private readonly getStudentCourseUC: GetStudentCourseUseCase) {}

  getOne = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = studentCourseQuerySchema.safeParse(req.query);
      if (!parsed.success) return next(fromZodError(parsed.error));
      const result = await this.getStudentCourseUC.execute(req.params.courseId, parsed.data.batchId);
      sendSuccess(res, result);
    } catch (err) { next(err); }
  };
}
