import { logger } from '@shared/logger';
import { config } from './config';
import { app }    from './app';

const server = app.listen(config.port, () => {
  logger.info({ port: config.port }, `${config.serviceName} listening`);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received — shutting down gracefully');
  server.close(() => process.exit(0));
});
