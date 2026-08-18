import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../database/schema';
import { DRIZZLE } from '../../database/database.module';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TERMINAL_STATUSES = ['BILLED', 'COMPLETED', 'CANCELLED'];

export interface MedicationInput {
  name?: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  instructions?: string;
}

export interface PrescriptionInput {
  queueId?: string;
  medications?: MedicationInput[];
  notes?: string;
}

@Injectable()
export class PrescriptionsService {
  constructor(@Inject(DRIZZLE) private db: PostgresJsDatabase<typeof schema>) {}

  async findForVisit(queueId: string) {
    if (!queueId || !UUID_REGEX.test(queueId)) {
      throw new BadRequestException('queueId must be a valid UUID');
    }

    const [consultation] = await this.db
      .select({ id: schema.consultations.id })
      .from(schema.consultations)
      .where(eq(schema.consultations.queueId, queueId));

    if (!consultation) {
      throw new NotFoundException('No consultation recorded for this visit');
    }

    const [record] = await this.db
      .select()
      .from(schema.prescriptions)
      .where(eq(schema.prescriptions.consultationId, consultation.id));

    if (!record) {
      throw new NotFoundException('No prescription recorded for this visit');
    }
    return record;
  }

  async save(input: PrescriptionInput, doctorId: string) {
    const queueId = input.queueId ?? '';
    if (!queueId || !UUID_REGEX.test(queueId)) {
      throw new BadRequestException('queueId must be a valid UUID');
    }

    if (!Array.isArray(input.medications) || input.medications.length === 0) {
      throw new BadRequestException('At least one medication is required');
    }

    const medications = input.medications.map((med) => {
      const name = med.name?.trim();
      if (!name) {
        throw new BadRequestException('Each medication requires a name');
      }
      const cleaned: Record<string, string> = { name };
      const optional: (keyof MedicationInput)[] = ['dosage', 'frequency', 'duration', 'instructions'];
      for (const field of optional) {
        const value = med[field]?.trim();
        if (value) {
          cleaned[field] = value;
        }
      }
      return cleaned;
    });

    const notes = input.notes?.trim() || null;

    const [visit] = await this.db
      .select({ id: schema.queue.id, patientId: schema.queue.patientId, status: schema.queue.status })
      .from(schema.queue)
      .where(eq(schema.queue.id, queueId));

    if (!visit) {
      throw new NotFoundException('Visit not found');
    }
    if (TERMINAL_STATUSES.includes(visit.status)) {
      throw new BadRequestException('Cannot prescribe for a completed visit');
    }

    const [consultation] = await this.db
      .select({ id: schema.consultations.id })
      .from(schema.consultations)
      .where(eq(schema.consultations.queueId, queueId));

    if (!consultation) {
      throw new BadRequestException('Record a consultation before writing a prescription');
    }

    const [existing] = await this.db
      .select({ id: schema.prescriptions.id })
      .from(schema.prescriptions)
      .where(eq(schema.prescriptions.consultationId, consultation.id));

    let record;
    if (existing) {
      [record] = await this.db
        .update(schema.prescriptions)
        .set({ medications, notes })
        .where(eq(schema.prescriptions.id, existing.id))
        .returning();
    } else {
      [record] = await this.db
        .insert(schema.prescriptions)
        .values({
          consultationId: consultation.id,
          patientId: visit.patientId,
          doctorId,
          medications,
          notes,
        })
        .returning();
    }

    return record;
  }
}
