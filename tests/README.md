# Test-Driven Development (TDD) for n8n-templates

This directory contains test files for the n8n-templates project, following the TDD methodology.

## TDD Approach

Our test-driven development process consists of the following stages:

1. **Write a Test**: We first write a test that defines the desired behavior of the function or feature.
2. **Run the Test**: Verify that the test fails (since the functionality doesn't exist yet).
3. **Implement the Function**: Write the simplest code that passes the test.
4. **Run the Tests Again**: Ensure all tests pass.
5. **Refactor**: Clean up and optimize the code while ensuring tests still pass.
6. **Repeat**: Move to the next function or feature.

## Test Structure

Each test file follows a consistent pattern:

1. **Setup**: Define the test environment, including mocks for dependencies.
2. **Test Suites**: Group related tests together in `describe` blocks.
3. **Individual Tests**: Write specific test cases that verify a single aspect of functionality.
4. **Cleanup**: Reset any global state changes after each test.

## Mocking Strategy

To isolate our tests from external dependencies, we use several mocking techniques:

- **Database Mocking**: We mock Neo4j and Supabase clients to avoid actual database connections.
- **Server Mocking**: For external processes like the Context7 MCP, we mock the child_process module.
- **Filesystem Mocking**: We mock fs operations to avoid actual file system changes during tests.

## Running Tests

Use the following commands to run tests:

```bash
# Run all tests
npm test

# Run tests in watch mode (development)
npm run test:watch

# Run tests with code coverage report
npm run test:coverage
```

## Coverage Targets

Our project aims for at least 70% code coverage across:

- Statements
- Branches
- Functions
- Lines

We've achieved excellent coverage results for our codebase:
- Neo4j Service: 100% statements, 94.02% branches, 100% functions, 100% lines
- Supabase Vector Service: 100% statement coverage
- Context7 Documentation Fetching: 100% statement coverage

## Test Files

Each test file contains comprehensive tests for its respective module:

- **neo4j-service.test.js**: Tests for Neo4j graph database integration functions
  - `storeWorkflow`: Tests successful workflow storage, error handling, and edge cases
  - `getWorkflow`: Tests workflow retrieval, JSON parsing, and error scenarios
  - `getWorkflowRelationships`: Tests relationship retrieval for nodes and similar workflows
  - `searchWorkflows`: Tests search with different criteria and error handling
  - `generateId`: Tests ID generation with various inputs

- **supabase-vector.test.js**: Tests for Supabase with pgvector integration
  - `storeWorkflow`: Tests storing workflows with embeddings
  - `searchSimilarWorkflows`: Tests similarity search functionality
  - `searchWorkflows`: Tests workflow search by various criteria

- **context7-docs.test.js**: Tests for n8n documentation fetching with Context7
  - `connectToContext7Server`: Tests server connection and messaging
  - `processUrl`: Tests URL processing functionality

## Implementation Details

### Mock Design

Our mock design follows these principles:

1. **Isolation**: Each test fully isolates the function being tested by mocking all dependencies
2. **Realistic Behavior**: Mocks simulate realistic behavior of external systems
3. **Edge Cases**: Mocks include scenarios for error handling and edge cases
4. **Context Awareness**: Mocks for functions like database queries respond differently based on inputs

### Error Handling Coverage

We've added specific tests for error scenarios in all core functions:

- Database connection errors
- Transaction failures
- Query failures
- Data parsing errors
- Missing resources (e.g., workflows not found)

### Edge Case Coverage

We've included tests for various edge cases such as:

- Missing or malformed input data
- Invalid JSON formatting
- Connection scenarios with missing source or target nodes
- Various search criteria combinations

## Adding New Tests

When adding new functionality:

1. Create a new test file if it's a new module.
2. Add test cases for all code paths (success, failure, edge cases).
3. Ensure proper mocking of external dependencies.
4. Run the full test suite to check for regressions.
5. Aim for high code coverage (at least 70% across all metrics).
6. Document specific test strategies in the test file.