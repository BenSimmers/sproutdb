# SproutDB

A tiny TypeScript in-memory database with a Mongo-style query language, optional schema validation, pluggable persistence and a mock REST server for tests and prototypes.

## Features

- **Simple, typed API**: tables of plain records with insert, find, update, delete, upsert and more
- **Queries**: comparison, set, regex, `$and`/`$or`/`$not`, dot-path fields, sorting, pagination and projection
- **Dependency-free library**: the core runs anywhere (Node, browsers, edge runtimes) with no runtime dependencies
- **Validation**: pass a Zod schema, or any validator with a `safeParse` method
- **Primary keys**: unique keys with `get` and `upsert`
- **Change subscriptions, snapshots and transactions**
- **Persistence adapters**: in-memory, `localStorage` and JSON file
- **Mock REST server**: `npx sproutdb` gives you a json-server-style API with seeding, reset/snapshot endpoints, live change streams and a web dashboard

## Installation

```bash
npm install sproutdb
```

Or run the server directly with npx:

```bash
npx sproutdb
```

## Quick Start

### As a Library

```typescript
import { create, table } from 'sproutdb';

type User = { id: number; name: string; email: string; age?: number; address?: { city: string } };
type Post = { id: number; title: string; content: string };

const db = create({
  users: table<User>({ key: 'id' }),
  posts: table<Post>(),
});

// Insert (returns the stored record)
db.users.insert({ id: 1, name: 'Alice', email: 'alice@example.com', age: 30 });

// Load many at once (all or nothing)
db.users.load([
  { id: 2, name: 'Bob', email: 'bob@example.com', age: 17 },
  { id: 3, name: 'Charlie', email: 'charlie@example.com', address: { city: 'Paris' } },
]);

// Query
const adults = db.users.find({
  where: { age: { $gte: 18 } },
  sort: { name: 'asc' },
  limit: 10,
});

const result = db.users.find({
  where: {
    $or: [{ name: { $regex: /^A/ } }, { 'address.city': 'Paris' }],
  },
  select: ['id', 'name'],
});

db.users.findOne({ where: { email: 'bob@example.com' } });
db.users.count({ where: { age: { $exists: true } } });

// Primary-key helpers (need the `key` option)
db.users.get(1);
db.users.upsert({ id: 1, name: 'Alice Smith', email: 'alice@example.com' });

// Update and delete return the number of affected records
db.users.update({ where: { id: 2 } }, { age: 18 });
db.users.delete({ where: { id: 3 } });
```

Records are copied on the way in and out, so changing an object you inserted or got back never changes the table. Use `update` instead.

### As a Test Database Server

```bash
npx sproutdb --port 3001 --seed sprout.json
```

In your own test suite, create an isolated server per test instead:

```typescript
import request from 'supertest';
import { createServer } from 'sproutdb/server';

const { app, db } = createServer({ seed: { users: [{ id: 1, name: 'Alice' }] } });
await request(app).get('/tables/users/1'); // { id: 1, name: 'Alice' }
```

## API Reference

### Database

#### `create(tables)` → Database
Creates a database from a map of table name → table.

#### `table<T>(options?)` → Table<T>
Creates a table. `options` can be a validator (see [Validation](#validation)) or an object:

- `schema`: a validator used on insert, load, update, upsert and restore
- `key`: the primary-key field. It must be present and unique, and enables `get` and `upsert`.

#### `snapshot(db)` → Snapshot / `restore(db, snapshot)`
Copies every table's data to a plain, JSON-safe object, and puts it back. `restore` clears tables that are missing from the snapshot.

#### `transaction(db, fn)` → result of `fn`
Runs `fn(db)`. If it throws, every table is rolled back to where it was. `fn` must be synchronous.

```typescript
transaction(db, tx => {
  tx.users.update({ where: { id: 1 } }, { balance: 0 });
  tx.ledger.insert({ userId: 1, amount: -100 }); // if this throws, the update is undone too
});
```

### Table Methods

| Method | Returns | Notes |
|---|---|---|
| `insert(record)` | the stored record | |
| `load(records)` | number loaded | all or nothing |
| `find(query?)` | matching records | see [Queries](#queries) |
| `findOne(query?)` | first match or `undefined` | |
| `count(query?)` | number | uses `where` only |
| `all()` | every record | |
| `get(key)` | record or `undefined` | needs `key` option |
| `upsert(record)` | the stored record | needs `key` option |
| `update({ where }, changes)` | number updated | validates the merged record; all or nothing |
| `delete({ where })` | number deleted | no `where` deletes everything |
| `clear()` | | |
| `restore(records)` | | replaces all records (validated) |
| `subscribe(listener)` | unsubscribe function | see [Subscriptions](#subscriptions) |

### Queries

`find` and `findOne` accept:

- `where`: conditions (below)
- `sort`: e.g. `{ name: 'asc', age: 'desc' }`. Missing values sort last.
- `limit` / `offset`: pagination
- `select`: fields to return, e.g. `['id', 'name']`

`where` conditions:

| Condition | Example |
|---|---|
| Equality (deep for objects, arrays and Dates) | `{ name: 'Alice' }`, `{ address: { city: 'Paris' } }` |
| Comparison | `{ age: { $gt: 18, $lte: 65 } }`, `$eq`, `$ne` |
| Sets | `{ status: { $in: ['active', 'pending'] } }`, `$nin` |
| Regex | `{ email: { $regex: /@example\.com$/ } }` |
| Presence | `{ deletedAt: { $exists: false } }` |
| Negation | `{ name: { $not: { $regex: '^A' } } }` |
| Logic | `{ $or: [...] }`, `{ $and: [...] }` (combined with other fields using AND) |
| Nested fields | `{ 'address.city': 'Paris' }` |

An unknown operator or an invalid regex throws a `QueryError`.

### Validation

Pass a Zod schema, or any object with a Zod-style `safeParse` method. Zod isn't a dependency of SproutDB.

```typescript
import { z } from 'zod';
import { table, ValidationError } from 'sproutdb';

const users = table({ schema: z.object({ id: z.number(), email: z.string().email() }), key: 'id' });

try {
  users.insert({ id: 1, email: 'not-an-email' });
} catch (error) {
  if (error instanceof ValidationError) console.log(error.issues);
}
```

A duplicate or changed-to-duplicate primary key throws a `DuplicateKeyError`.

### Subscriptions

```typescript
const unsubscribe = db.users.subscribe(event => {
  // event.type: 'insert' | 'update' | 'delete' | 'replace'
  // event.records: the affected records (a copy)
});
```

### Persistence

`persist(db, adapter)` loads any saved data into the tables, then saves after every change. It returns `{ save(), stop() }`.

```typescript
import { persist, localStorageAdapter, memoryAdapter } from 'sproutdb';
import { jsonFileAdapter } from 'sproutdb/node'; // Node.js only

persist(db, localStorageAdapter('my-app'));  // browsers
persist(db, jsonFileAdapter('./data.json')); // Node.js
persist(db, memoryAdapter());                // tests
```

You can also write your own adapter: it's an object with `read(): Snapshot | undefined` and `write(snapshot): void`.

## Server

### CLI

```bash
npx sproutdb [--port 3000] [--seed <file-or-folder>] [--persist <file>] [--quiet]
```

- `--seed`: initial data (see [Seeding Data](#seeding-data)). `POST /reset` returns to it.
- `--persist`: saves every change to a JSON file and loads it on the next start (it's used instead of the seed when it exists).
- `--port 0`: picks a free port.

### Dashboard

The server includes a web dashboard at `http://localhost:3000/dashboard` (`/` redirects there). You can:

- browse tables with filtering (same query-string syntax as the REST API), sorting and pagination
- add, edit and delete records, and create or drop tables
- watch changes arrive live, whoever makes them
- download a snapshot, restore one from a file, or reset to the seed
- see request metrics and the busiest endpoints

Turn it off with `createServer({ dashboard: false })`.

### Programmatic

```typescript
import { createServer, start } from 'sproutdb/server';

// An Express app plus its database, without listening. Ideal with supertest.
const { app, db, reset } = createServer({ seed, storage, logging });

// Or listen on a port. Returns the Node http.Server, so call server.close() when done.
const server = start(0, seed);
```

### REST Endpoints

Record ids in URLs match either string or numeric ids (`/users/1` finds `id: 1` or `id: "1"`).

| Route | Description |
|---|---|
| `GET /tables/:table` | List records, filtered by the query string (below). Sets `X-Total-Count`. |
| `POST /tables/:table` | Create a record. Assigns `id` if missing (next number, or a UUID). Returns 201. |
| `GET /tables/:table/:id` | Get one record |
| `PATCH /tables/:table/:id` | Merge fields into a record |
| `PUT /tables/:table/:id` | Replace a record (keeping its id) |
| `DELETE /tables/:table/:id` | Delete a record. Returns 204. |
| `GET /tables/:table/events` | Server-sent events for every change (`event: insert\|update\|delete\|replace`, `data: records`) |
| `GET /tables` / `POST /tables` / `DELETE /tables/:table` | List, create (`{ name, records? }`) or drop tables |
| `POST /reset` | Restore the seed data and drop tables created at runtime |
| `GET /snapshot` / `POST /restore` | Save and restore the whole database |
| `GET /health` / `GET /metrics` | Status and request metrics |

List query string:

```
GET /tables/users?role=admin&age[$gte]=18&tags[$in]=a,b&address.city=Paris&_sort=-age,name&_limit=10&_offset=20&_select=id,name
```

- `field=value` means equality. Repeat the parameter to match any of several values.
- `field[$op]=value` works for `$eq $ne $gt $gte $lt $lte $in $nin $regex $exists`. `$in` and `$nin` take comma-separated lists.
- Numbers, `true`, `false` and `null` are converted automatically.
- `_sort` takes comma-separated fields; prefix a field with `-` for descending.

The original RPC-style routes still work:

- `POST /tables/:table/insert`: body is the record
- `POST /tables/:table/find`: body is a query (`where`, `sort`, `limit`, `offset`, `select`)
- `GET /tables/:table/all`
- `PUT /tables/:table/update`: `{ "where": {...}, "update": {...} }`
- `DELETE /tables/:table/delete`: `{ "where": {...} }`. Send `{ "where": {} }` to delete everything.
- `POST /tables/:table/load`: `{ "records": [...] }`

Errors are returned as JSON: 400 for invalid input, validation and query errors; 404 for a missing table or record; 409 for an existing table or duplicate key.

```bash
curl -X POST http://localhost:3000/tables/users \
  -H "Content-Type: application/json" \
  -d '{"name": "Alice", "email": "alice@example.com"}'
```

## Seeding Data

Create a `sprout.json` file or a `plant/` folder with JSON files. Without a seed, the server starts with an empty `users` table.

### Single File (sprout.json)
```json
{
  "users": [
    { "id": 1, "name": "Alice", "email": "alice@example.com" }
  ],
  "posts": [
    { "id": 1, "title": "Hello World", "content": "..." }
  ]
}
```

### Folder Structure (plant/)
```
plant/
  users.json
  posts.json
```

Each `.json` file contains an array of records for that table.

## Development

```bash
pnpm install
pnpm build
pnpm test
```

## Changesets

This repository uses [Changesets](https://github.com/changesets/changesets) to manage versioning and changelogs. When making changes to the codebase, you can create a changeset by running `pnpm changeset` and following the prompts. This will generate a markdown file in the `changesets` directory, which will be used to update the version and changelog when publishing.

## Using devcontainer

This repository includes a devcontainer configuration for a consistent development environment. To use it:

1. Open the repository in Visual Studio Code.
2. If prompted, reopen the repository in a container.
3. The devcontainer will automatically install the dependencies and set up the environment.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details
