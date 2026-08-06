import 'reflect-metadata';
import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { DataSource } from 'typeorm';
import { UserOrmEntity } from './entities/user.orm-entity';
import { InitSchema1730000000000 } from './migrations/1730000000000-InitSchema';

// Standalone DataSource used by the migration scripts (npm run migration:run).
// Loads DATABASE_URL from .env.local / .env so the CLI has the same connection
// as the running services.
for (const file of ['.env.local', '.env']) {
  const path = resolve(process.cwd(), file);
  if (existsSync(path)) {
    config({ path, override: true });
  }
}

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [UserOrmEntity],
  migrations: [InitSchema1730000000000],
  synchronize: false,
});

export default AppDataSource;
