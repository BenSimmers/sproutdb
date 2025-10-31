# SproutDB

A tiny, dependency-free TypeScript key-value store with pluggable persistence. Now includes an HTTP server for testing and development.

## Features

- **Simple API**: Easy-to-use key-value store with table-based structure
- **TypeScript First**: TypeScript support with type safety
- **Pluggable Persistence**: Extend with custom storage backends
- **HTTP Server**: REST API for database operations
- **npx Command**: Run a test database server instantly
- **Seeding**: Load initial data from JSON files or folders

## Installation

```bash
npm install sproutdb
```

Or use directly with npx:

```bash
npx sproutdb
```

## Quick Start

### As a Library

```typescript
import { create, table } from 'sproutdb';

const db = create({
  users: table<{ id: number; name: string; email: string }>(),
  posts: table<{ id: number; title: string; content: string }>(),
});

// Insert data
db.users.insert({ id: 1, name: 'Alice', email: 'alice@example.com' });

// Find data
const user = db.users.find({ where: { id: 1 } });

// Advanced queries
const adults = db.users.find({ 
  where: { age: { $gte: 18 } },
  sort: { name: 'asc' },
  limit: 10 
});

// Complex conditions
const result = db.users.find({
  where: { 
    $or: [
      { name: { $regex: /^A/ } },
      { age: { $lt: 30 } }
    ]
  }
});

// Get all
const allUsers = db.users.all();

// Update
db.users.update({ where: { id: 1 } }, { name: 'Alice Smith' });

// Delete
db.users.delete({ where: { id: 1 } });

// Load multiple records
db.users.load([
  { id: 2, name: 'Bob', email: 'bob@example.com' },
  { id: 3, name: 'Charlie', email: 'charlie@example.com' },
]);
```

### As a Test Database Server

Start a test database server:

```bash
npx sproutdb --port 3001
```

Or with seed data:

```bash
npx sproutdb --seed sprout.json
```

The server provides REST endpoints at `http://localhost:3000` (or specified port).

## API Reference

### Database Operations

#### `create(schema)` → Database
Creates a new database instance with the given table schema.

#### `table<T>()` → Table<T>
Creates a new table for records of type T.

### Table Methods

#### `insert(record: T)` → void
Inserts a new record into the table.

#### `find(query?: QueryOptions<T>)` → T[]
Finds records matching the query. Supports advanced filtering, sorting, and pagination.

Query options:
- `where`: Simple equality match or complex conditions with operators
- `sort`: Sort by fields (e.g., `{ name: 'asc', age: 'desc' }`)
- `limit`: Maximum number of records to return
- `offset`: Number of records to skip

Where conditions support:
- Simple equality: `{ name: 'Alice' }`
- Comparison operators: `{ age: { $gt: 18, $lt: 65 } }`
- Set operations: `{ status: { $in: ['active', 'pending'] } }`
- Regex matching: `{ email: { $regex: /@example\.com$/ } }`
- OR logic: `{ $or: [{ name: 'Alice' }, { name: 'Bob' }] }`

#### `all()` → readonly T[]
Returns all records in the table.

#### `update(query: { where?: Partial<T> | WhereClause<T> }, update: Partial<T>)` → void
Updates records matching the query with the given updates. Supports the same where conditions as `find`.

#### `delete(query: { where?: Partial<T> | WhereClause<T> })` → void
Deletes records matching the query. Supports the same where conditions as `find`.

#### `load(records: readonly T[])` → void
Loads multiple records into the table.

## REST API Endpoints

When running the server, the following endpoints are available:

- `POST /tables/:table/insert` - Insert a record
- `POST /tables/:table/find` - Find records
- `GET /tables/:table/all` - Get all records
- `PUT /tables/:table/update` - Update records
- `DELETE /tables/:table/delete` - Delete records
- `POST /tables/:table/load` - Load multiple records

Example request:

```bash
curl -X POST http://localhost:3000/tables/users/insert \
  -H "Content-Type: application/json" \
  -d '{"id": 1, "name": "Alice", "email": "alice@example.com"}'
```

## Seeding Data

Create a `sprout.json` file or a `plant/` folder with JSON files:

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
