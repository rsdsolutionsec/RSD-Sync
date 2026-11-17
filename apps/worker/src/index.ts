import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runWorkerProcess } from './worker.js';

export * from './consumers/index.js';
export * from './processors/index.js';
export * from './schedulers/index.js';
export * from './worker.js';

const currentFile = resolve(fileURLToPath(import.meta.url));
const entryFile = process.argv[1] ? resolve(process.argv[1]) : '';

if (currentFile === entryFile) {
  runWorkerProcess().catch((error) => {
    console.error('Fatal Worker startup error:', error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
