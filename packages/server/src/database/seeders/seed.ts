import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as bcrypt from 'bcrypt';
import * as schema from '../schema';

async function seed() {
  console.log('🌱 Starting database seeding...');

  const connectionString = process.env.DATABASE_URL || 'postgres://clinic_user:clinic_password@localhost:5432/clinic_db';
  const queryClient = postgres(connectionString);
  const db = drizzle(queryClient, { schema });

  const defaultPassword = 'password123';
  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  const seedUsers = [
    {
      email: 'admin@clinic.com',
      fullName: 'System Admin',
      role: 'ADMIN' as const,
      passwordHash,
    },
    {
      email: 'doctor@clinic.com',
      fullName: 'Dr. Sarah Smith',
      role: 'DOCTOR' as const,
      passwordHash,
    },
    {
      email: 'nurse@clinic.com',
      fullName: 'Nurse John Doe',
      role: 'NURSE' as const,
      passwordHash,
    },
    {
      email: 'receptionist@clinic.com',
      fullName: 'Alice Receptionist',
      role: 'RECEPTIONIST' as const,
      passwordHash,
    },
    {
      email: 'cashier@clinic.com',
      fullName: 'Bob Cashier',
      role: 'CASHIER' as const,
      passwordHash,
    },
    {
      email: 'labtech@clinic.com',
      fullName: 'Lab Tech Lee',
      role: 'LAB_TECH' as const,
      passwordHash,
    },
  ];

  for (const user of seedUsers) {
    await db
      .insert(schema.users)
      .values(user)
      .onConflictDoNothing({ target: schema.users.email });
  }

  console.log('✅ Seeding complete! Added default users:');
  console.log('   Password for all test users: password123');
  console.log('   - admin@clinic.com (ADMIN)');
  console.log('   - doctor@clinic.com (DOCTOR)');
  console.log('   - nurse@clinic.com (NURSE)');
  console.log('   - receptionist@clinic.com (RECEPTIONIST)');
  console.log('   - cashier@clinic.com (CASHIER)');
  console.log('   - labtech@clinic.com (LAB_TECH)');

  await queryClient.end();
}

seed().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});