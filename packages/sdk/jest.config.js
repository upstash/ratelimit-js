/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  injectGlobals: false,
  verbose: true,
  maxConcurrency: 1,
  testTimeout: 120_000,
};
