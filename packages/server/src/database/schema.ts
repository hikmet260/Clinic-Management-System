import { pgTable, text, timestamp, uuid, integer, decimal, boolean, jsonb, foreignKey, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// 1. USERS & ROLES
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  fullName: text('full_name').notNull(),
  role: text('role', { 
    enum: ['ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST', 'CASHIER', 'LAB_TECH'] 
  }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 2. PATIENT RECORDS
export const patients = pgTable('patients', {
  id: uuid('id').primaryKey().defaultRandom(),
  mrn: text('mrn').notNull().unique(),
  fullName: text('full_name').notNull(),
  dob: text('dob').notNull(),
  gender: text('gender', { enum: ['MALE', 'FEMALE', 'OTHER'] }).notNull(),
  phone: text('phone').notNull(),
  address: text('address'),
  emergencyContact: text('emergency_contact'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 3. QUEUE & VISITS
export const queue = pgTable('queue', {
  id: uuid('id').primaryKey().defaultRandom(),
  patientId: uuid('patient_id').notNull(),
  tokenNumber: integer('token_number').notNull(),
  status: text('status', { 
    enum: ['WAITING', 'TRIAGED', 'IN_CONSULTATION', 'LAB_PENDING', 'BILLED', 'COMPLETED', 'CANCELLED'] 
  }).default('WAITING').notNull(),
  assignedDoctorId: uuid('assigned_doctor_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  foreignKey({ columns: [table.patientId], foreignColumns: [patients.id] }),
  foreignKey({ columns: [table.assignedDoctorId], foreignColumns: [users.id] }),
  uniqueIndex('queue_daily_token_unique').on(sql`(date(${table.createdAt}))`, table.tokenNumber),
]);

// 4. TRIAGE & VITALS
export const vitals = pgTable('vitals', {
  id: uuid('id').primaryKey().defaultRandom(),
  queueId: uuid('queue_id').notNull(),
  patientId: uuid('patient_id').notNull(),
  nurseId: uuid('nurse_id').notNull(),
  systolicBp: integer('systolic_bp'),
  diastolicBp: integer('diastolic_bp'),
  heartRate: integer('heart_rate'),
  temperature: decimal('temperature', { precision: 4, scale: 1 }),
  weight: decimal('weight', { precision: 5, scale: 2 }),
  height: decimal('height', { precision: 5, scale: 2 }),
  bmi: decimal('bmi', { precision: 4, scale: 1 }),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  foreignKey({ columns: [table.queueId], foreignColumns: [queue.id] }),
  foreignKey({ columns: [table.patientId], foreignColumns: [patients.id] }),
  foreignKey({ columns: [table.nurseId], foreignColumns: [users.id] }),
]);

// 5. DOCTOR CONSULTATIONS (SOAP Notes)
export const consultations = pgTable('consultations', {
  id: uuid('id').primaryKey().defaultRandom(),
  queueId: uuid('queue_id').notNull(),
  patientId: uuid('patient_id').notNull(),
  doctorId: uuid('doctor_id').notNull(),
  subjective: text('subjective').notNull(),
  objective: text('objective').notNull(),
  assessment: text('assessment').notNull(),
  plan: text('plan').notNull(),
  icd10Code: text('icd10_code'),
  icd10Description: text('icd10_description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  foreignKey({ columns: [table.queueId], foreignColumns: [queue.id] }),
  foreignKey({ columns: [table.patientId], foreignColumns: [patients.id] }),
  foreignKey({ columns: [table.doctorId], foreignColumns: [users.id] }),
]);

// 6. PRESCRIPTIONS
export const prescriptions = pgTable('prescriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  consultationId: uuid('consultation_id').notNull(),
  patientId: uuid('patient_id').notNull(),
  doctorId: uuid('doctor_id').notNull(),
  medications: jsonb('medications').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  foreignKey({ columns: [table.consultationId], foreignColumns: [consultations.id] }),
  foreignKey({ columns: [table.patientId], foreignColumns: [patients.id] }),
  foreignKey({ columns: [table.doctorId], foreignColumns: [users.id] }),
]);

// 7. LAB ORDERS
export const labOrders = pgTable('lab_orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  consultationId: uuid('consultation_id').notNull(),
  patientId: uuid('patient_id').notNull(),
  testName: text('test_name').notNull(),
  status: text('status', { enum: ['PENDING', 'COMPLETED', 'CANCELLED'] }).default('PENDING').notNull(),
  result: text('result'),
  labTechId: uuid('lab_tech_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  foreignKey({ columns: [table.consultationId], foreignColumns: [consultations.id] }),
  foreignKey({ columns: [table.patientId], foreignColumns: [patients.id] }),
  foreignKey({ columns: [table.labTechId], foreignColumns: [users.id] }),
]);

// 8. BILLING & INVOICES
export const invoices = pgTable('invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  patientId: uuid('patient_id').notNull(),
  queueId: uuid('queue_id').notNull(),
  cashierId: uuid('cashier_id'),
  items: jsonb('items').notNull(),
  subtotal: decimal('subtotal', { precision: 10, scale: 2 }).notNull(),
  discount: decimal('discount', { precision: 10, scale: 2 }).default('0.00'),
  totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).notNull(),
  isPaid: boolean('is_paid').default(false).notNull(),
  paymentMethod: text('payment_method', { enum: ['CASH', 'CARD', 'INSURANCE', 'MOBILE_MONEY'] }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  foreignKey({ columns: [table.patientId], foreignColumns: [patients.id] }),
  foreignKey({ columns: [table.queueId], foreignColumns: [queue.id] }),
  foreignKey({ columns: [table.cashierId], foreignColumns: [users.id] }),
]);