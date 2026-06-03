import { logger } from '@shared/logger';
import { config } from './config';
import { app }    from './app';

const server = app.listen(config.port, () => {
  logger.info({ port: config.port }, `${config.serviceName} listening`);
});

// Keep connections alive longer than the typical load-balancer idle timeout (60 s).
// Without this, the LB reuses a connection the Node process already closed, causing
// a TCP reset + full TLS re-handshake on the next request (~200–800 ms extra latency).
server.keepAliveTimeout = 65_000;
server.headersTimeout   = 66_000; // must be > keepAliveTimeout

process.on('SIGTERM', () => {
  logger.info('SIGTERM received — shutting down gracefully');
  server.close(() => process.exit(0));
});
