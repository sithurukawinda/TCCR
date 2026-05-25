import { Request, Response, NextFunction }    from 'express';
import { fromZodError }                        from '@shared/errors';
import { sendSuccess }                         from '@shared/response';
import { CreateRegistrationUseCase }           from '../../application/use-cases/CreateRegistrationUseCase';
import { IEnrollmentRepository }              from '../../domain/repositories/IEnrollmentRepository';
import { internalCreateRegistrationSchema }    from '../validators/enrollmentValidator';

export class InternalEnrollmentController {
  constructor(
    private readonly createRegistrationUC: CreateRegistrationUseCase,
    private readonly enrollRepo:           IEnrollmentRepository,
  ) {}

  createRegistration = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = internalCreateRegistrationSchema.safeParse(req.body);
      if (!parsed.success) return next(fromZodError(parsed.error));
      const reg = await this.createRegistrationUC.execute(parsed.data);
      sendSuccess(res, reg, 201);
    } catch (err) { next(err); }
  };

  checkEnrollment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { studentUid, courseId } = req.query as { studentUid: string; courseId: string };
      const enrollment = await this.enrollRepo.findByStudentAndCourse(studentUid, courseId);
      sendSuccess(res, { enrolled: enrollment?.state === 'approved' });
    } catch (err) { next(err); }
  };
}
