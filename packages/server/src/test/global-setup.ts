import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { connectTestDb, seedDefaultUsers } from './db-helpers';
import { MAINTENANCE_DATABASE_URL, TEST_DATABASE_URL } from './test-db';

export default async function globalSetup(): Promise<void> {
  const admin = postgres(MAINTENANCE_DATABASE_URL, { max: 1 });
  try {
    const dbName = new URL(TEST_DATABASE_URL).pathname.slice(1);
    const [row] = await admin<{ exists: boolean }[]>`
      select exists(select 1 from pg_database where datname = ${dbName}) as exists
    `;
    if (!row?.exists) {
      await admin`create database ${admin(dbName)}`;
    }
  } finally {
    await admin.end();
  }

  const { db, client } = await connectTestDb();
  try {
    await migrate(db, { migrationsFolder: './drizzle' });
    await seedDefaultUsers(db);
  } finally {
    await client.end();
  }
}
