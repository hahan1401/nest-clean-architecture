import { AppDataSource } from './data-source';

/**
 * Applies (or reverts, with --revert) TypeORM migrations against DATABASE_URL.
 * Run via `npm run migration:run` / `npm run migration:revert`.
 */
async function run(): Promise<void> {
  const revert = process.argv.includes('--revert');
  const ds = await AppDataSource.initialize();
  try {
    if (revert) {
      await ds.undoLastMigration();
      console.log('Reverted the last migration.');
    } else {
      const applied = await ds.runMigrations();
      console.log(
        applied.length
          ? `Applied ${applied.length} migration(s): ${applied.map((m) => m.name).join(', ')}`
          : 'No pending migrations.',
      );
    }
  } finally {
    await ds.destroy();
  }
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
