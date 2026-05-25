import { Router }                  from 'express';
import { authenticate, authorize } from '@shared/auth-middleware';
import { container }               from '../../container';

export const subjectRouter = Router();

subjectRouter.patch( '/subjects/:id', authenticate(), authorize('admin'), container.subjectController.update);
subjectRouter.delete('/subjects/:id', authenticate(), authorize('admin'), container.subjectController.remove);
