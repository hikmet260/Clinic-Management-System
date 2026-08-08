import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { randomBytes } from 'node:crypto';
import * as schema from '../../database/schema';
import { DRIZZLE } from '../../database/database.module';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Gender = 'MALE' | 'FEMALE' | 'OTHER';

const GENDERS: Gender[] = ['MALE', 'FEMALE', 'OTHER'];

export interface CreatePatientInput {
  fullName?: string;
  dob?: string;
  gender?: string;
  phone?: string;
  address?: string;
  emergencyContact?: string;
}

@Injectable()
export class PatientsService {
  constructor(@Inject(DRIZZLE) private db: PostgresJsDatabase<typeof schema>) {}

  private generateMrn(): string {
    return `MRN-${randomBytes(4).toString('hex').toUpperCase()}`;
  }

  async create(input: CreatePatientInput) {
    if (!input.fullName?.trim() || !input.dob || !input.gender || !input.phone?.trim()) {
      throw new BadRequestException('fullName, dob, gender, and phone are required');
    }

    const gender = input.gender as Gender;
    if (!GENDERS.includes(gender)) {
      throw new BadRequestException(`gender must be one of ${GENDERS.join(', ')}`);
    }

    const [patient] = await this.db
      .insert(schema.patients)
      .values({
        mrn: this.generateMrn(),
        fullName: input.fullName.trim(),
        dob: input.dob,
        gender,
        phone: input.phone.trim(),
        address: input.address?.trim() || null,
        emergencyContact: input.emergencyContact?.trim() || null,
      })
      .returning();

    return patient;
  }

  async search(query: string) {
    const q = query.trim();
    if (!q) {
      return [];
    }

    const pattern = `%${q}%`;
    return this.db
      .select()
      .from(schema.patients)
      .where(
        or(
          ilike(schema.patients.fullName, pattern),
          ilike(schema.patients.phone, pattern),
          ilike(schema.patients.mrn, pattern),
        ),
      )
      .orderBy(schema.patients.fullName)
      .limit(20);
  }

  async list(query: string, page: number, pageSize: number) {
    const q = query.trim();
    const where = q
      ? or(
          ilike(schema.patients.fullName, `%${q}%`),
          ilike(schema.patients.phone, `%${q}%`),
          ilike(schema.patients.mrn, `%${q}%`),
        )
      : undefined;

    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(schema.patients)
      .where(where);

    const items = await this.db
      .select()
      .from(schema.patients)
      .where(where)
      .orderBy(schema.patients.fullName)
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    return { items, total: Number(count), page, pageSize };
  }

  async findHistory(patientId: string) {
    if (!patientId || !UUID_REGEX.test(patientId)) {
      throw new BadRequestException('patientId must be a valid UUID');
    }

    const [patient] = await this.db
      .select()
      .from(schema.patients)
      .where(eq(schema.patients.id, patientId));

    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    const visits = await this.db
      .select()
      .from(schema.queue)
      .where(eq(schema.queue.patientId, patientId))
      .orderBy(desc(schema.queue.createdAt));

    if (visits.length === 0) {
      return { patient, visits: [] };
    }

    const queueIds = visits.map((visit) => visit.id);

    const [vitals, consultations, invoices] = await Promise.all([
      this.db.select().from(schema.vitals).where(inArray(schema.vitals.queueId, queueIds)),
      this.db.select().from(schema.consultations).where(inArray(schema.consultations.queueId, queueIds)),
      this.db.select().from(schema.invoices).where(inArray(schema.invoices.queueId, queueIds)),
    ]);

    const consultationByQueue = new Map(consultations.map((c) => [c.queueId, c]));
    const consultationIds = [...consultationByQueue.values()].map((c) => c.id);

    const [labOrders, prescriptions] = consultationIds.length
      ? await Promise.all([
          this.db
            .select()
            .from(schema.labOrders)
            .where(inArray(schema.labOrders.consultationId, consultationIds)),
          this.db
            .select()
            .from(schema.prescriptions)
            .where(inArray(schema.prescriptions.consultationId, consultationIds)),
        ])
      : [[], []];

    const labByConsultation = new Map<string, (typeof labOrders)[number][]>();
    for (const order of labOrders) {
      const list = labByConsultation.get(order.consultationId);
      if (list) {
        list.push(order);
      } else {
        labByConsultation.set(order.consultationId, [order]);
      }
    }

    const rxByConsultation = new Map<string, (typeof prescriptions)[number][]>();
    for (const rx of prescriptions) {
      const list = rxByConsultation.get(rx.consultationId);
      if (list) {
        list.push(rx);
      } else {
        rxByConsultation.set(rx.consultationId, [rx]);
      }
    }

    return {
      patient,
      visits: visits.map((visit) => {
        const consultation = consultationByQueue.get(visit.id) ?? null;
        return {
          id: visit.id,
          tokenNumber: visit.tokenNumber,
          status: visit.status,
          createdAt: visit.createdAt,
          updatedAt: visit.updatedAt,
          vitals: vitals.find((record) => record.queueId === visit.id) ?? null,
          consultation,
          invoice: invoices.find((record) => record.queueId === visit.id) ?? null,
          labOrders: consultation
            ? (labByConsultation.get(consultation.id) ?? []).map((order) => ({
                ...order,
                queueId: visit.id,
              }))
            : [],
          prescriptions: consultation ? (rxByConsultation.get(consultation.id) ?? []) : [],
        };
      }),
    };
  }
}
