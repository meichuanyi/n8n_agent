/**
 * Jest configuration for n8n-templates tests
 */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.js'],
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  collectCoverageFrom: [
    'neo4j-mcp/src/**/*.js',
    'supabase-mcp/**/*.js',
    'context7-*.js',
    '!**/node_modules/**',
    '!**/vendor/**'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  // Setup files if needed
  // setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  verbose: true
};