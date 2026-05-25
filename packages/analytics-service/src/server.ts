import { initFirebaseAdmin } from '@shared/firebase';
import { logger }            from '@shared/logger';
import { config }            from './config';

async function start(): Promise<void> {
  initFirebaseAdmin();
  const { app } = await import('./app');
  app.listen(config.port, () => {
    logger.info({ port: config.port }, `${config.serviceName} listening`);
  });
}

start().catch((err: unknown) => {
  process.stderr.write(`Fatal startup error: ${String(err)}\n`);
  process.exit(1);
});
