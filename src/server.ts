import express from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import type { Server } from 'http';
import { table } from './modules/table.js';
import { snapshot, transaction } from './modules/database.js';
import type { StorageAdapter } from './modules/persist.js';
import {
  Database,
  DuplicateKeyError,
  QueryError,
  Snapshot,
  Table,
  ValidationError,
  WhereClause,
} from './lib/types/index.js';
import { isPlainObject } from './lib/query.js';

type AnyTable = Table<Record<string, unknown>>;
type AnyDatabase = Database<Record<string, AnyTable>>;

export interface ServerOptions {
  /** Initial data, keyed by table name. `POST /reset` returns the database to this state. */
  seed?: Snapshot;
  /** Saves every change, and loads saved data (instead of the seed) on startup. */
  storage?: StorageAdapter;
  /** Log each request to the console. */
  logging?: boolean;
  /** Serve the web dashboard at `/dashboard` (default `true`). */
  dashboard?: boolean;
}

export interface SproutServer {
  app: express.Express;
  /** The live database, for inspecting or preparing state directly in tests. */
  db: AnyDatabase;
  /** Restores the seed data and removes tables created at runtime. */
  reset(): void;
}

interface ServerMetrics {
  requests: {
    total: number;
    byMethod: Record<string, number>;
    byEndpoint: Record<string, number>;
    errors: number;
  };
  performance: {
    avgResponseTime: number;
    totalResponseTime: number;
  };
  startTime: Date;
}

const DEFAULT_SEED: Snapshot = { users: [] };

/** The dashboard's static files sit next to this module (in src/ during development, dist/ once built). */
const DASHBOARD_DIR = fileURLToPath(new URL('./dashboard/', import.meta.url));

/**
 * Converts a query-string value to a number, boolean or null where it looks like one.
 */
const coerce = (raw: string): unknown => {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw === 'null') return null;
  if (raw.trim() !== '' && !Number.isNaN(Number(raw))) return Number(raw);
  return raw;
};

/**
 * Values from the URL are strings, but stored values may be numbers: match either form.
 */
const eitherForm = (raw: string): unknown[] => {
  const coerced = coerce(raw);
  return coerced === raw ? [raw] : [raw, coerced];
};

/**
 * Turns a query string into find() options, e.g.
 * `?role=admin&age[$gte]=18&tags[$in]=a,b&_sort=-age,name&_limit=10&_offset=20&_select=id,name`
 */
const parseListQuery = (query: Record<string, unknown>) => {
  const where: Record<string, unknown> = {};
  const options: {
    where: WhereClause<Record<string, unknown>>;
    sort?: Record<string, 'asc' | 'desc'>;
    limit?: number;
    offset?: number;
    select?: string[];
  } = { where };

  const asNumber = (name: string, value: string) => {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0) throw new QueryError(`${name} must be a non-negative integer`);
    return n;
  };

  for (const [param, rawValue] of Object.entries(query)) {
    const values = (Array.isArray(rawValue) ? rawValue : [rawValue]).map(String);
    const value = values[values.length - 1];

    if (param === '_sort') {
      options.sort = Object.fromEntries(
        value.split(',').filter(Boolean).map(field => (field.startsWith('-') ? [field.slice(1), 'desc'] : [field, 'asc'])),
      );
      continue;
    }
    if (param === '_limit') { options.limit = asNumber('_limit', value); continue; }
    if (param === '_offset') { options.offset = asNumber('_offset', value); continue; }
    if (param === '_select') { options.select = value.split(',').filter(Boolean); continue; }

    const match = /^(.+)\[(\$\w+)\]$/.exec(param);
    if (!match) {
      // Plain `field=value` (repeat the parameter to match any of several values)
      where[param] = { $in: values.flatMap(eitherForm) };
      continue;
    }

    const [, field, op] = match;
    const condition = (where[field] ??= {}) as Record<string, unknown>;
    if (!isPlainObject(condition) || Object.keys(condition).some(k => !k.startsWith('$'))) {
      throw new QueryError(`Conflicting conditions for "${field}"`);
    }
    switch (op) {
      case '$in':
      case '$nin':
        condition[op] = value.split(',').flatMap(eitherForm);
        break;
      case '$eq':
        condition.$in = eitherForm(value);
        break;
      case '$ne':
        condition.$nin = eitherForm(value);
        break;
      case '$regex':
        condition.$regex = value;
        break;
      case '$exists':
        condition.$exists = value !== 'false';
        break;
      default:
        condition[op] = coerce(value);
    }
  }
  return options;
};

const sendError = (res: express.Response, error: unknown) => {
  if (error instanceof ValidationError) {
    return res.status(400).json({ error: error.message, issues: error.issues });
  }
  if (error instanceof QueryError) {
    return res.status(400).json({ error: error.message });
  }
  if (error instanceof DuplicateKeyError) {
    return res.status(409).json({ error: error.message });
  }
  const status = (error as { status?: number }).status;
  if (typeof status === 'number' && status >= 400 && status < 500) {
    return res.status(status).json({ error: (error as Error).message });
  }
  return res.status(500).json({ error: (error as Error).message });
};

/**
 * Creates an independent SproutDB HTTP server (an Express app plus its in-memory database).
 */
export function createServer(options: ServerOptions = {}): SproutServer {
  const { seed = DEFAULT_SEED, storage, logging = false, dashboard = true } = options;
  const app = express();


  const db: AnyDatabase = Object.create(null);

  const save = () => storage?.write(snapshot(db));

  const addTable = (name: string, records: unknown[] = []) => {
    const t: AnyTable = table<Record<string, unknown>>();
    t.load(records as Record<string, unknown>[]);
    t.subscribe(save);
    db[name] = t;
    return t;
  };

  const reset = () => {
    for (const name of Object.keys(db)) delete db[name];
    for (const [name, records] of Object.entries(seed)) addTable(name, records);
    save();
  };

  const saved = storage?.read();
  for (const [name, records] of Object.entries(saved ?? seed)) addTable(name, records);

  const metrics: ServerMetrics = {
    requests: { total: 0, byMethod: {}, byEndpoint: {}, errors: 0 },
    performance: { avgResponseTime: 0, totalResponseTime: 0 },
    startTime: new Date(),
  };
  const uptime = () => Date.now() - metrics.startTime.getTime();

  const requestLogger: express.RequestHandler = (req, res, next) => {
    const start = Date.now();
    metrics.requests.total++;
    metrics.requests.byMethod[req.method] = (metrics.requests.byMethod[req.method] || 0) + 1;

    if (logging) console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${req.ip}`);

    res.on('finish', () => {
      const duration = Date.now() - start;
      metrics.performance.totalResponseTime += duration;
      metrics.performance.avgResponseTime = metrics.performance.totalResponseTime / metrics.requests.total;

      const endpoint = req.route ? `${req.method} ${req.baseUrl}${req.route.path}` : `${req.method} (unmatched)`;
      metrics.requests.byEndpoint[endpoint] = (metrics.requests.byEndpoint[endpoint] || 0) + 1;

      if (res.statusCode >= 400) {
        metrics.requests.errors++;
      }

      if (logging) console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
    });

    next();
  };

  app.use(cors());
  app.use(express.json());
  app.use(requestLogger);

  if (dashboard) {
    app.get('/', (req, res) => res.redirect('dashboard/'));
    app.use(
      '/dashboard',
      (req, res, next) => {
        // The page loads ./styles.css and ./js/*, which only resolve correctly from "/dashboard/".
        if (!req.originalUrl.split('?')[0].endsWith('/') && req.path === '/') return res.redirect('dashboard/');
        next();
      },
      express.static(DASHBOARD_DIR),
    );
  }

  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: uptime(),
      version: process.env.npm_package_version || '1.0.0',
      database: {
        tables: Object.keys(db).length,
        totalRecords: Object.values(db).reduce((total, t) => total + t.count(), 0),
      },
    });
  });

  app.get('/metrics', (req, res) => {
    res.status(200).json({
      ...metrics,
      uptime: uptime(),
      database: {
        tables: Object.keys(db),
        tableCount: Object.keys(db).length,
        recordCounts: Object.fromEntries(Object.entries(db).map(([name, t]) => [name, t.count()])),
      },
      memory: process.memoryUsage(),
    });
  });

  app.post('/reset', (req, res) => {
    reset();
    res.json({ success: true });
  });

  app.get('/snapshot', (req, res) => {
    res.json(snapshot(db));
  });

  app.post('/restore', (req, res) => {
    const data = req.body;
    if (!isPlainObject(data) || !Object.values(data).every(Array.isArray)) {
      return res.status(400).json({ error: 'Body must be an object of table name → records array' });
    }
    try {
      for (const name of Object.keys(db)) delete db[name];
      for (const [name, records] of Object.entries(data)) addTable(name, records as unknown[]);
      save();
      res.json({ success: true });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.get('/tables', (req, res) => {
    res.status(200).json(Object.keys(db));
  });

  app.post('/tables', (req, res) => {
    const name = req.body?.name;
    if (typeof name !== 'string' || !name) {
      return res.status(400).json({ error: 'Table name is required' });
    }
    if (db[name]) {
      return res.status(409).json({ error: 'Table already exists' });
    }
    const records = req.body.records ?? [];
    if (!Array.isArray(records)) {
      return res.status(400).json({ error: '"records" must be an array' });
    }
    try {
      addTable(name, records);
      save();
      res.status(201).json({ success: true, message: `Table '${name}' created` });
    } catch (error) {
      sendError(res, error);
    }
  });

  const tables = express.Router();

  tables.param('table', (req, res, next, name: string) => {
    const t = db[name];
    if (!t) {
      return res.status(404).json({ error: 'Table not found' });
    }
    res.locals.table = t;
    res.locals.tableName = name;
    next();
  });

  const getTable = (res: express.Response) => res.locals.table as AnyTable;

  const handle = (fn: (req: express.Request, res: express.Response, t: AnyTable) => unknown): express.RequestHandler =>
    (req, res) => {
      try {
        fn(req, res, getTable(res));
      } catch (error) {
        sendError(res, error);
      }
    };

  /** A where clause matching the record with the given id (as a string or its numeric form). */
  const byId = (t: AnyTable, id: string) => ({ where: { [String(t.key ?? 'id')]: { $in: eitherForm(id) } } });

  /** The next id for a new record: max numeric id + 1, or a UUID if existing ids aren't numbers. */
  const nextId = (t: AnyTable, field: string) => {
    const ids = t.all().map(row => row[field]).filter(id => id !== undefined);
    if (ids.every(id => typeof id === 'number')) {
      return Math.max(0, ...(ids as number[])) + 1;
    }
    return randomUUID();
  };

  tables.delete('/:table', handle((req, res) => {
    delete db[res.locals.tableName];
    save();
    res.json({ success: true });
  }));


  // rpc style

  tables.post('/:table/insert', handle((req, res, t) => {
    if (req.body === undefined) {
      return res.status(400).json({ error: 'Request body is required' });
    }
    t.insert(req.body);
    res.json({ success: true });
  }));

  tables.post('/:table/find', handle((req, res, t) => {
    res.json(t.find(req.body ?? {}));
  }));

  tables.get('/:table/all', handle((req, res, t) => {
    res.json(t.all());
  }));

  tables.delete('/:table/delete', handle((req, res, t) => {
    if (!isPlainObject(req.body?.where)) {
      return res.status(400).json({ error: 'A "where" object is required; send { "where": {} } to delete all records' });
    }
    const deleted = t.delete({ where: req.body.where });
    res.json({ success: true, deleted });
  }));

  tables.put('/:table/update', handle((req, res, t) => {
    const { where, update } = req.body ?? {};
    if (!isPlainObject(where) || !isPlainObject(update)) {
      return res.status(400).json({ error: 'Both "where" and "update" objects are required' });
    }
    const updated = t.update({ where }, update);
    res.json({ success: true, updated });
  }));

  tables.post('/:table/load', handle((req, res, t) => {
    if (!Array.isArray(req.body?.records)) {
      return res.status(400).json({ error: 'A "records" array is required' });
    }
    const loaded = t.load(req.body.records);
    res.json({ success: true, loaded });
  }));

  // Stream changes as server-sent events: `event: insert|update|delete|replace`, `data: <records JSON>`.
  tables.get('/:table/events', (req, res) => {
    res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.flushHeaders();
    const unsubscribe = getTable(res).subscribe(event => {
      res.write(`event: ${event.type}\ndata: ${JSON.stringify(event.records)}\n\n`);
    });
    req.on('close', unsubscribe);
  });

  // REST routers

  // X-Total-Count is the total before pagination.
  tables.get('/:table', handle((req, res, t) => {
    const { select, ...query } = parseListQuery(req.query as Record<string, unknown>);
    res.set('X-Total-Count', String(t.count({ where: query.where })));
    res.json(select ? t.find({ ...query, select }) : t.find(query));
  }));

  tables.post('/:table', handle((req, res, t) => {
    if (!isPlainObject(req.body)) {
      return res.status(400).json({ error: 'Request body must be an object' });
    }
    const field = String(t.key ?? 'id');
    const record = req.body[field] === undefined ? { ...req.body, [field]: nextId(t, field) } : req.body;
    res.status(201).json(t.insert(record));
  }));

  tables.get('/:table/:id', handle((req, res, t) => {
    const record = t.findOne(byId(t, req.params.id));
    if (!record) return res.status(404).json({ error: 'Record not found' });
    res.json(record);
  }));

  tables.patch('/:table/:id', handle((req, res, t) => {
    if (!isPlainObject(req.body)) {
      return res.status(400).json({ error: 'Request body must be an object' });
    }
    const query = byId(t, req.params.id);
    if (t.update(query, req.body) === 0) return res.status(404).json({ error: 'Record not found' });
    res.json(t.findOne(query));
  }));

  tables.put('/:table/:id', handle((req, res, t) => {
    if (!isPlainObject(req.body)) {
      return res.status(400).json({ error: 'Request body must be an object' });
    }
    const query = byId(t, req.params.id);
    const existing = t.findOne(query);
    if (!existing) return res.status(404).json({ error: 'Record not found' });
    const field = String(t.key ?? 'id');
    const replacement = { ...req.body, [field]: existing[field] };
    // Delete + insert as one step, so a failed insert (e.g. validation) keeps the original.
    const inserted = transaction({ t }, ({ t }) => {
      t.delete(query);
      return t.insert(replacement);
    });
    res.json(inserted);
  }));

  tables.delete('/:table/:id', handle((req, res, t) => {
    if (t.delete(byId(t, req.params.id)) === 0) return res.status(404).json({ error: 'Record not found' });
    res.status(204).end();
  }));

  app.use('/tables', tables);

  app.use((error: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    sendError(res, error);
  });

  return { app, db, reset };
}

const defaultServer = createServer();
export const app = defaultServer.app;

/**
 * Starts a server. Pass port 0 to pick a free port (read it from `server.address()`).
 * @returns The Node HTTP server; call `close()` to stop it.
 */
export function start(port: number = 3000, seedData?: Snapshot, options: Omit<ServerOptions, 'seed'> = {}): Server {
  const { app } = createServer({ logging: true, ...options, seed: seedData });
  const server = app.listen(port, () => {
    const address = server.address();
    const actualPort = typeof address === 'object' && address ? address.port : port;
    console.log(`Server running on port http://localhost:${actualPort}`);
    if (options.dashboard !== false) console.log(`Dashboard: http://localhost:${actualPort}/dashboard/`);
  });
  return server;
}
