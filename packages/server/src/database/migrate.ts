import 'dotenv/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import * as schema from './schema';

async function runMigrations() {
  const connectionString =
    process.env.DATABASE_URL || 'postgres://clinic_user:clinic_password@localhost:5432/clinic_db';
  const queryClient = postgres(connectionString, { max: 1 });
  const db = drizzle(queryClient, { schema });

  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('✅ Migrations applied');

  await queryClient.end();
}

runMigrations().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
