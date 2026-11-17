import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startApiServer } from './server.js';

export * from './middleware/admin-auth.js';
export * from './middleware/tenant-context.js';
export * from './modules/index.js';
export * from './plugins/observability.js';
export * from './routes/health.js';
export * from './routes/v1.js';
export * from './server.js';

const currentFile = resolve(fileURLToPath(import.meta.url));
const entryFile = process.argv[1] ? resolve(process.argv[1]) : '';

if (currentFile === entryFile) {
  startApiServer().catch((error) => {
    console.error('Fatal API startup error:', error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
