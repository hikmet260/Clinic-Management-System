export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://clinic_user:clinic_password@localhost:5432/clinic_test';

export const MAINTENANCE_DATABASE_URL =
  process.env.MAINTENANCE_DATABASE_URL ?? 'postgres://clinic_user:clinic_password@localhost:5432/postgres';
