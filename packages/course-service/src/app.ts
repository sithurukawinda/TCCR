import express           from 'express';
import helmet            from 'helmet';
import { errorHandler }  from '@shared/errors';
import { httpLogger }    from '@shared/logger';
import { healthRouter }  from '@shared/health';
import { courseRouter }   from './http/routes/courseRouter';
import { semesterRouter } from './http/routes/semesterRouter';
import { subjectRouter }  from './http/routes/subjectRouter';
import { lessonRouter }   from './http/routes/lessonRouter';
import { internalRouter } from './http/routes/internalRouter';

export const app = express();

app.use(helmet());
app.use(express.json());
app.use(httpLogger);

app.use(healthRouter);
app.use(internalRouter);
app.use(courseRouter);
app.use(semesterRouter);
app.use(subjectRouter);
app.use(lessonRouter);

app.use(errorHandler);
