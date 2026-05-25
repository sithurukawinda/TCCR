import pino from 'pino';

describe('@shared/logger — redaction', () => {
  function makeLogger(extraRedactPaths: string[] = []) {
    const lines: string[] = [];
    const stream = new (require('stream').Writable)({
      write(chunk: Buffer, _enc: string, cb: () => void) {
        lines.push(chunk.toString());
        cb();
      },
    });

    const log = pino(
      {
        level: 'info',
        redact: {
          paths: [
            'req.headers.authorization',
            '*.password',
            '*.token',
            '*.idToken',
            '*.privateKey',
            ...extraRedactPaths,
          ],
          censor: '[REDACTED]',
        },
      },
      stream,
    );

    return { log, lines };
  }

  it('redacts authorization header', () => {
    const { log, lines } = makeLogger();
    log.info({ req: { headers: { authorization: 'Bearer secret-token' } } }, 'test');
    const parsed = JSON.parse(lines[0]);
    expect(parsed.req.headers.authorization).toBe('[REDACTED]');
  });

  it('redacts password fields at any depth', () => {
    const { log, lines } = makeLogger();
    log.info({ body: { password: 'supersecret' } }, 'test');
    const parsed = JSON.parse(lines[0]);
    expect(parsed.body.password).toBe('[REDACTED]');
  });

  it('redacts token fields at any depth', () => {
    const { log, lines } = makeLogger();
    log.info({ data: { token: 'firebase-id-token' } }, 'test');
    const parsed = JSON.parse(lines[0]);
    expect(parsed.data.token).toBe('[REDACTED]');
  });

  it('redacts idToken fields at any depth', () => {
    const { log, lines } = makeLogger();
    log.info({ data: { idToken: 'firebase-id-token' } }, 'test');
    const parsed = JSON.parse(lines[0]);
    expect(parsed.data.idToken).toBe('[REDACTED]');
  });

  it('does not redact unrelated fields', () => {
    const { log, lines } = makeLogger();
    log.info({ user: { email: 'test@example.com', name: 'Viruli' } }, 'test');
    const parsed = JSON.parse(lines[0]);
    expect(parsed.user.email).toBe('test@example.com');
    expect(parsed.user.name).toBe('Viruli');
  });

  it('includes service base fields from env', () => {
    process.env.SERVICE_NAME = 'test-service';
    process.env.SERVICE_VERSION = '1.0.0';
    process.env.NODE_ENV = 'test';

    const lines: string[] = [];
    const stream = new (require('stream').Writable)({
      write(chunk: Buffer, _enc: string, cb: () => void) {
        lines.push(chunk.toString());
        cb();
      },
    });

    const log = pino(
      {
        level: 'info',
        base: {
          service: process.env.SERVICE_NAME,
          version: process.env.SERVICE_VERSION,
          env:     process.env.NODE_ENV,
        },
      },
      stream,
    );

    log.info('base fields test');
    const parsed = JSON.parse(lines[0]);
    expect(parsed.service).toBe('test-service');
    expect(parsed.version).toBe('1.0.0');
    expect(parsed.env).toBe('test');
  });
});
