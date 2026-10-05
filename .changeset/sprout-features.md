---
"sproutdb": minor
---

## Query, persistence and server overhaul

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
