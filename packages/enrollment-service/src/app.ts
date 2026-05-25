import express           from 'express';
import helmet            from 'helmet';
import { errorHandler }  from '@shared/errors';
import { httpLogger }    from '@shared/logger';
import { healthRouter }  from '@shared/health';
import { enrollmentRouter } from './http/routes/enrollmentRouter';
import { internalRouter }   from './http/routes/internalRouter';

export const app = express();

app.use(helmet());
app.use(express.json());
app.use(httpLogger);
app.use(healthRouter);
app.use(internalRouter);
app.use(enrollmentRouter);
app.use(errorHandler);
