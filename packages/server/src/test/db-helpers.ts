import * as bcrypt from 'bcrypt';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../database/schema';
import { TEST_DATABASE_URL } from './test-db';

export interface TestDb {
  client: postgres.Sql;
  db: ReturnType<typeof drizzle<typeof schema>>;
}

export async function connectTestDb(): Promise<TestDb> {
  const client = postgres(TEST_DATABASE_URL, { max: 1 });
  const db = drizzle(client, { schema });
  return { client, db };
}

const SEED_USERS = [
  { id: '11111111-1111-4111-8111-111111111111', email: 'admin@clinic.com', fullName: 'System Admin', role: 'ADMIN' as const },
  { id: '22222222-2222-4222-8222-222222222222', email: 'doctor@clinic.com', fullName: 'Dr. Sarah Smith', role: 'DOCTOR' as const },
  { id: '33333333-3333-4333-8333-333333333333', email: 'nurse@clinic.com', fullName: 'Nurse John Doe', role: 'NURSE' as const },
  { id: '44444444-4444-4444-8444-444444444444', email: 'receptionist@clinic.com', fullName: 'Alice Receptionist', role: 'RECEPTIONIST' as const },
  { id: '55555555-5555-4555-8555-555555555555', email: 'cashier@clinic.com', fullName: 'Bob Cashier', role: 'CASHIER' as const },
  { id: '66666666-6666-4666-8666-666666666666', email: 'labtech@clinic.com', fullName: 'Lab Tech Lee', role: 'LAB_TECH' as const },
];

export async function seedDefaultUsers(db: ReturnType<typeof drizzle<typeof schema>>): Promise<void> {
  const passwordHash = await bcrypt.hash('password123', 10);
  await db
    .insert(schema.users)
    .values(SEED_USERS.map((user) => ({ ...user, passwordHash })))
    .onConflictDoNothing({ target: schema.users.email });
}

export async function resetDatabase(): Promise<void> {
  const client = postgres(TEST_DATABASE_URL, { max: 1 });
  await client.unsafe(
    'TRUNCATE TABLE consultations, invoices, lab_orders, patients, prescriptions, queue, users, vitals RESTART IDENTITY CASCADE',
  );
  await client.end();

  const { db, client: seededClient } = await connectTestDb();
  await seedDefaultUsers(db);
  await seededClient.end();
}
