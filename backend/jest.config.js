/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  setupFiles: ['<rootDir>/tests/setupEnv.ts'],
  globalSetup: '<rootDir>/tests/globalSetup.ts',
  globalTeardown: '<rootDir>/tests/globalTeardown.ts',
  testTimeout: 30000,
  // Keep console clean-ish; ts-jest handles TS on the fly.
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: { noUnusedLocals: false, noUnusedParameters: false } }],
  },
};
