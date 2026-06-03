import express        from 'express';
import helmet         from 'helmet';
import { errorHandler } from '@shared/errors';
import { httpLogger }   from '@shared/logger';
import { healthRouter } from '@shared/health';
import { meRouter }          from './http/routes/meRouter';
import { usersRouter }       from './http/routes/usersRouter';
import { superAdminRouter }  from './http/routes/superAdminRouter';
import { internalRouter }    from './http/routes/internalRouter';

export const app = express();

app.use(helmet());
app.use(express.json());
app.use(httpLogger);

app.use(healthRouter);
app.use(internalRouter);
app.use(meRouter);
app.use(usersRouter);
app.use(superAdminRouter);

app.use(errorHandler);
