import { Router }       from 'express';
import { internalAuth } from '../middleware/internalAuth';
import { container }    from '../../container';

export const internalRouter = Router();

internalRouter.post('/internal/events', internalAuth, container.eventController.receiveEvent);
