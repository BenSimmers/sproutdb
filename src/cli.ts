import { Command } from 'commander';
import { start } from './server.js';
import fs from 'fs';
import path from 'path';

const program = new Command();

program
  .name('sproutdb')
  .description('Start a test database server')
  .option('-p, --port <port>', 'port to run on', '3000')
  .option('-s, --seed <path>', 'path to seed data JSON file or folder')
  .action((options) => {
    const port = parseInt(options.port, 10);
    let seedData: Record<string, unknown[]> | undefined = undefined;
    if (options.seed) {
      const seedPath = path.resolve(options.seed);
      if (fs.existsSync(seedPath)) {
        if (fs.statSync(seedPath).isDirectory()) {
          // Load all .json files in the folder
          seedData = {};
          const files = fs.readdirSync(seedPath).filter(f => f.endsWith('.json'));
          for (const file of files) {
            const tableName = path.basename(file, '.json');
            const filePath = path.join(seedPath, file);
            const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            seedData[tableName] = data;
          }
        } else {
          // Load single JSON file
          seedData = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));
        }
      } else {
        console.error(`Seed file or folder not found: ${seedPath}`);
        process.exit(1);
      }
    }
    start(port, seedData);
  });

program.parse();