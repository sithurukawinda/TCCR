import type { Config } from 'jest';

const config: Config = {
  preset:          'ts-jest',
  testEnvironment: 'node',
  testMatch:       ['**/tests/integration/**/*.test.ts'],
  testTimeout:     30000,
  // Serial execution required: all tests share the same Auth+Firestore emulator.
  // Parallel workers call clearAuth() concurrently, deleting users mid-test and
  // invalidating tokens in sibling workers.
  maxWorkers:      1,
  // Runs before each test file module is loaded — sets emulator env vars + initialises Firebase Admin
  setupFiles:      ['<rootDir>/tests/integration/setup.ts'],
  moduleNameMapper: {
    '^@shared/firebase$':             '<rootDir>/packages/shared/firebase/src/index.ts',
    '^@shared/logger$':               '<rootDir>/packages/shared/logger/src/index.ts',
    '^@shared/errors$':               '<rootDir>/packages/shared/errors/src/index.ts',
    '^@shared/auth-middleware$':      '<rootDir>/packages/shared/auth-middleware/src/index.ts',
    '^@shared/events$':               '<rootDir>/packages/shared/events/src/index.ts',
    '^@shared/internal-http-client$': '<rootDir>/packages/shared/internal-http-client/src/index.ts',
    '^@shared/response$':             '<rootDir>/packages/shared/response/src/index.ts',
    '^@shared/health$':               '<rootDir>/packages/shared/health/src/index.ts',
    '^@shared/tracing$':              '<rootDir>/packages/shared/tracing/src/index.ts',
    '^@/(.*)$':                       '<rootDir>/src/$1',
  },
};

export default config;
