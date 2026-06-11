import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  setupFiles: ['<rootDir>/tests/setup.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: { rootDir: '.' } }],
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/server.ts',
  ],
  coverageThreshold: {
    global: {
      lines: 85,
      functions: 85,
      branches: 85,
      statements: 85,
    },
  },
  coverageReporters: ['text', 'html', 'lcov'],
  coverageDirectory: 'coverage',
};

export default config;
