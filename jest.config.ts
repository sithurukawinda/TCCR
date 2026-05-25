import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/unit/**/*.test.ts'],
  moduleNameMapper: {
    '^@shared/firebase$': '<rootDir>/packages/shared/firebase/src/index.ts',
    '^@shared/logger$': '<rootDir>/packages/shared/logger/src/index.ts',
    '^@shared/errors$': '<rootDir>/packages/shared/errors/src/index.ts',
    '^@shared/auth-middleware$': '<rootDir>/packages/shared/auth-middleware/src/index.ts',
    '^@shared/events$': '<rootDir>/packages/shared/events/src/index.ts',
    '^@shared/internal-http-client$': '<rootDir>/packages/shared/internal-http-client/src/index.ts',
    '^@shared/response$': '<rootDir>/packages/shared/response/src/index.ts',
    '^@shared/health$': '<rootDir>/packages/shared/health/src/index.ts',
    '^@shared/tracing$': '<rootDir>/packages/shared/tracing/src/index.ts',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: [
    'packages/**/src/**/*.ts',
    // Startup files excluded from all coverage
    '!packages/**/src/index.ts',
    '!packages/**/src/server.ts',
    // Infrastructure layer — requires Firestore emulator (integration tests only)
    '!packages/**/src/infrastructure/repositories/**',
    '!packages/**/src/infrastructure/clients/**',
    '!packages/**/src/infrastructure/cache/**',
    // HTTP layer — requires running Express server (integration tests only)
    '!packages/**/src/http/routes/**',
    '!packages/**/src/http/controllers/**',
    '!packages/**/src/http/middleware/**',
    '!packages/**/src/http/validators/**',
    // Wiring / config files — no testable logic
    '!packages/**/src/app.ts',
    '!packages/**/src/container.ts',
    '!packages/**/src/config.ts',
    '!packages/**/src/worker.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};

export default config;
