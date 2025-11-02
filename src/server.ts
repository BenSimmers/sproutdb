import express from 'express';
import cors from 'cors';
import { create, table } from './index.js';
import { Database, Table } from './lib/types/index.js';

const app = express();
app.use(cors());
app.use(express.json());

// Create a sample database with a users table
let db: Database<Record<string, Table<unknown>>> = create({
  users: table<{ id: number; name: string; email: string }>(),
});

// Routes

// Insert a record into a table
app.post('/tables/:table/insert', (req, res) => {
  try {
    const tableName = req.params.table as keyof typeof db;
    if (!db[tableName]) {
      return res.status(404).json({ error: 'Table not found' });
    }
    db[tableName].insert(req.body);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Find records in a table
app.post('/tables/:table/find', (req, res) => {
  try {
    const tableName = req.params.table as keyof typeof db;
    if (!db[tableName]) {
      return res.status(404).json({ error: 'Table not found' });
    }
    const result = db[tableName].find(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get all records from a table
app.get('/tables/:table/all', (req, res) => {
  try {
    const tableName = req.params.table as keyof typeof db;
    if (!db[tableName]) {
      return res.status(404).json({ error: 'Table not found' });
    }
    const result = db[tableName].all();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Delete records from a table
app.delete('/tables/:table/delete', (req, res) => {
  try {
    const tableName = req.params.table as keyof typeof db;
    if (!db[tableName]) {
      return res.status(404).json({ error: 'Table not found' });
    }
    db[tableName].delete(req.body);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Update records in a table
app.put('/tables/:table/update', (req, res) => {
  try {
    const tableName = req.params.table as keyof typeof db;
    if (!db[tableName]) {
      return res.status(404).json({ error: 'Table not found' });
    }
    const { where, update } = req.body;
    db[tableName].update(where, update);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Load multiple records into a table
app.post('/tables/:table/load', (req, res) => {
  try {
    const tableName = req.params.table as keyof typeof db;
    if (!db[tableName]) {
      return res.status(404).json({ error: 'Table not found' });
    }
    db[tableName].load(req.body.records);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Create a new table
app.post('/tables', (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Table name is required' });
    }
    if (db[name]) {
      return res.status(409).json({ error: 'Table already exists' });
    }
    db[name] = table<unknown>();
    res.status(201).json({ success: true, message: `Table '${name}' created` });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// get all table names
app.get('/tables', (req, res) => {
  try {
    const tableNames = Object.keys(db);
    return res.status(200).json(tableNames);
  } catch (error) {
    return res.status(500).json({ error: (error as Error).message });
  }
});


export { app };

export function start(port: number = 3000, seedData?: Record<string, unknown[]>) {
  if (seedData) {
    const schema: Record<string, Table<unknown>> = { users: table<{ id: number; name: string; email: string }>() };
    for (const tableName of Object.keys(seedData)) {
      if (!schema[tableName]) {
        schema[tableName] = table<unknown>();
      }
    }
    db = create(schema);
    for (const [tableName, records] of Object.entries(seedData)) {
      db[tableName].load(records);
    }
  }
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}