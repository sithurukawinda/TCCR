import express             from 'express';
import helmet              from 'helmet';
import { errorHandler }    from '@shared/errors';
import { httpLogger }      from '@shared/logger';
import { healthRouter }    from '@shared/health';
import { analyticsRouter } from './http/routes/analyticsRouter';

export const app = express();

app.use(helmet());
app.use(express.json());
app.use(httpLogger);
app.use(healthRouter);
app.use(analyticsRouter);
app.use(errorHandler);
