# sproutdb

## 1.2.0

### Minor Changes

- 8d13e52: ## Enhanced Server Monitoring and Schema Validation

  ### Server Metrics and Logging
  - Added comprehensive metrics tracking system for monitoring server performance
    - Request count by method and endpoint
    - Response time tracking (average and total)
    - Error rate monitoring
    - Server uptime tracking
  - Implemented custom request logging middleware with timestamp and performance metrics
  - Added `/metrics` endpoint exposing server statistics, database info, and memory usage
  - Enhanced `/health` endpoint with detailed system status including database metrics

  ### Runtime Schema Validation
  - Added Zod-based runtime schema validation for all table operations
  - Optional schema parameter for `table()` function enabling type-safe data validation
  - Comprehensive validation for `insert`, `update`, and `load` operations
  - Detailed validation error messages with field-specific feedback
  - Backward compatibility maintained - validation is opt-in via schema parameter
  - Added `ValidationError` class for structured error handling

## 1.1.3

### Patch Changes

- 75fc357: add endpoint to get all tablenames

## 1.1.2

### Patch Changes

- 4ee071a: add a create table endpoint

## 1.1.1

### Patch Changes

- f216277: fix cli command

## 1.1.0

### Minor Changes

- 28c2276: adding extra functionality to the find function to handle different systems which are native to the library

## 1.0.1

### Patch Changes

- b7ab1de: add documentation on how to use sproutdb

## 1.0.0

### Major Changes

- 10c9e72: Added HTTP server with REST API for database operations (insert, find, all, delete, update, load). Introduced npx command for running a test database server with optional port configuration. Added seeding functionality to load initial data from JSON files or folders.

## 0.2.2

### Patch Changes

- 8351bad: update config

## 0.2.1

### Patch Changes

- a609aed: fix table find to return either single or array depending on result length

## 0.2.0

### Minor Changes

- 4f4b303: add basic functionality
