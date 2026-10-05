#!/usr/bin/env node

import { Command } from 'commander';
import { start } from './server.js';
import { jsonFileAdapter } from './node.js';
import type { Snapshot } from './lib/types/index.js';
import fs from 'fs';
import path from 'path';

const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};

const readJson = (filePath: string): unknown => {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (error) {
    return fail(`Could not read ${filePath}: ${(error as Error).message}`);
  }
};

/**
 * Loads seed data from a JSON file ({ table: records[] }) or a folder of <table>.json files (records[]).
 */
const loadSeed = (seedPath: string): Snapshot => {
  if (!fs.existsSync(seedPath)) {
    return fail(`Seed file or folder not found: ${seedPath}`);
  }

  if (fs.statSync(seedPath).isDirectory()) {
    const seed: Snapshot = {};
    const files = fs.readdirSync(seedPath).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const filePath = path.join(seedPath, file);
      const records = readJson(filePath);
      if (!Array.isArray(records)) {
        fail(`${filePath} must contain an array of records`);
      }
      seed[path.basename(file, '.json')] = records as unknown[];
    }
    return seed;
  }

  const seed = readJson(seedPath);
  if (typeof seed !== 'object' || seed === null || Array.isArray(seed)) {
    return fail(`${seedPath} must contain an object of table name → records array`);
  }
  for (const [name, records] of Object.entries(seed)) {
    if (!Array.isArray(records)) {
      fail(`Table "${name}" in ${seedPath} must be an array of records`);
    }
  }
  return seed as Snapshot;
};

const program = new Command();

program
  .name('sproutdb')
  .description('Start a test database server')
  .option('-p, --port <port>', 'port to run on (0 picks a free port)', '3000')
  .option('-s, --seed <path>', 'path to seed data JSON file or folder')
  .option('--persist <file>', 'save data to this JSON file and load it on startup')
  .option('-q, --quiet', 'do not log requests')
  .action((options) => {
    const port = Number(options.port);
    if (!Number.isInteger(port) || port < 0 || port > 65535) {
      fail(`Invalid port: ${options.port}`);
    }
    const seedData = options.seed ? loadSeed(path.resolve(options.seed)) : undefined;
    start(port, seedData, {
      logging: !options.quiet,
      storage: options.persist ? jsonFileAdapter(options.persist) : undefined,
    });
  });

program.parse();
