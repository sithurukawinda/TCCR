import { Router }       from 'express';
import { internalAuth } from '../middleware/internalAuth';
import { container }    from '../../container';

export const internalRouter = Router();

internalRouter.post('/internal/enrollments/registrations',   internalAuth, container.internalEnrollmentController.createRegistration);
internalRouter.get( '/internal/enrollments/status',          internalAuth, container.internalEnrollmentController.checkEnrollment);
