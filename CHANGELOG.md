# sproutdb

## 1.3.0

### Minor Changes

- cabab38: ## Query, persistence and server overhaul

  ### Library
  - Primary keys (`table({ key: 'id' })`) with `get`, `upsert` and duplicate-key checks (`DuplicateKeyError`)
  - New methods: `findOne`, `count`, `clear`, `restore`, `subscribe`
  - Writes now return values: `insert`/`upsert` return the stored record; `update`/`delete`/`load` return counts
  - Queries: `$eq`, `$and`, `$not`, `$exists`, dot-path fields (`'address.city'`), `select` projection; unknown operators and invalid regexes throw `QueryError`
  - `snapshot`, `restore` and `transaction` helpers for whole databases
  - Persistence: `persist(db, adapter)` with `memoryAdapter`, `localStorageAdapter` and `jsonFileAdapter` (from `sproutdb/node`)
  - Validation accepts any validator with a `safeParse` method; `update` validates the merged record, and `update`/`load` are all-or-nothing
  - Bug fixes: `$or` combined with other fields, nested object/Date equality, `limit: 0`, `$ne: null`, records leaking internal references
  - The core library has no runtime dependencies (zod is no longer required)

  ### Server
  - `createServer()` returns an isolated `{ app, db, reset }`; `start()` returns the `http.Server` and accepts port 0
  - REST routes: `GET/POST /tables/:table`, `GET/PATCH/PUT/DELETE /tables/:table/:id`, query-string filtering, `X-Total-Count`
  - `POST /reset`, `GET /snapshot`, `POST /restore`, `DELETE /tables/:table`, and SSE change streams at `/tables/:table/events`
  - Web dashboard at `/dashboard`: browse, filter, sort and edit records, manage tables, live updates, snapshot/restore/reset and metrics (`createServer({ dashboard: false })` to turn it off)
  - CLI: `--persist <file>`, `--quiet`, seed-file validation
  - Bug fixes: `PUT /tables/:table/update` updated every row; prototype-named tables; errors now use 400/404/409 and JSON bodies

  ### Breaking changes
  - `DELETE /tables/:table/delete` requires a `where` object (send `{ "where": {} }` to delete everything)
  - Returned records are copies; mutating them no longer changes the table
  - Nested-object `where` values are compared by value instead of matching every record
  - With a seed, the server only creates the seeded tables (it no longer adds an empty `users` table)
  - Request logging is off for `createServer()` (it's on for `start()` and the CLI unless `--quiet`)
  - Package now uses an `exports` map (`sproutdb`, `sproutdb/server`, `sproutdb/node`)

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
