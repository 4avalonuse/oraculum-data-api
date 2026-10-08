import { ensureTables } from './db/schema.js';
import { syncDatasetCatalog } from './db/catalog.js';
import { seedEvents } from './events/seed.js';

let schemaReady = false;
let schemaPromise = null;

async function initializeSchema(db) {
  await ensureTables(db);
  await syncDatasetCatalog(db);
  await seedEvents(db);
}

export async function ensureSchema(db) {
  // Reuse initialization within the same Worker isolate. A cold isolate still
  // verifies the schema and catalog, so this remains safe after restarts.
  if (schemaReady) return;
  if (!schemaPromise) {
    schemaPromise = initializeSchema(db)
      .then(() => { schemaReady = true; })
      .catch((error) => {
        schemaPromise = null;
        throw error;
      });
  }
  return schemaPromise;
}
