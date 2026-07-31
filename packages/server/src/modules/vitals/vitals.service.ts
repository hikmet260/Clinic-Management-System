import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../database/schema';
import { DRIZZLE } from '../../database/database.module';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TERMINAL_STATUSES = ['BILLED', 'COMPLETED', 'CANCELLED'];

export interface VitalsInput {
  queueId?: string;
  systolicBp?: number;
  diastolicBp?: number;
  heartRate?: number;
  temperature?: number;
  weight?: number;
  height?: number;
  notes?: string;
}

function numberInRange(value: unknown, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) {
    throw new BadRequestException(`value must be a number between ${min} and ${max}`);
  }
  return n;
}

@Injectable()
export class VitalsService {
  constructor(@Inject(DRIZZLE) private db: PostgresJsDatabase<typeof schema>) {}

  private computeBmi(weightKg: number, heightCm: number): string {
    const meters = heightCm / 100;
    return (weightKg / (meters * meters)).toFixed(1);
  }

  async findForVisit(queueId: string) {
    if (!queueId || !UUID_REGEX.test(queueId)) {
      throw new BadRequestException('queueId must be a valid UUID');
    }

    const [record] = await this.db
      .select()
      .from(schema.vitals)
      .where(eq(schema.vitals.queueId, queueId));

    if (!record) {
      throw new NotFoundException('No vitals recorded for this visit');
    }
    return record;
  }

  async save(input: VitalsInput, nurseId: string) {
    const queueId = input.queueId ?? '';
    if (!queueId || !UUID_REGEX.test(queueId)) {
      throw new BadRequestException('queueId must be a valid UUID');
    }

    const parse = (value: unknown, min: number, max: number): number | undefined => {
      if (value === undefined || value === null || value === '') return undefined;
      return numberInRange(value, min, max);
    };

    const systolicBp = parse(input.systolicBp, 1, 300);
    const diastolicBp = parse(input.diastolicBp, 1, 300);
    const heartRate = parse(input.heartRate, 1, 300);
    const temperature = parse(input.temperature, 30, 45);
    const weight = parse(input.weight, 0.5, 400);
    const height = parse(input.height, 20, 250);
    const notes = input.notes?.trim() || null;

    const hasAny = [systolicBp, diastolicBp, heartRate, temperature, weight, height].some(
      (v) => v !== undefined,
    );
    if (!hasAny && !notes) {
      throw new BadRequestException('Provide at least one vital sign');
    }

    const [visit] = await this.db
      .select({ id: schema.queue.id, patientId: schema.queue.patientId, status: schema.queue.status })
      .from(schema.queue)
      .where(eq(schema.queue.id, queueId));

    if (!visit) {
      throw new NotFoundException('Visit not found');
    }
    if (TERMINAL_STATUSES.includes(visit.status)) {
      throw new BadRequestException('Cannot record vitals for a completed visit');
    }

    const values: Partial<typeof schema.vitals.$inferInsert> = {
      systolicBp,
      diastolicBp,
      heartRate,
      temperature: temperature !== undefined ? String(temperature) : undefined,
      weight: weight !== undefined ? String(weight) : undefined,
      height: height !== undefined ? String(height) : undefined,
      notes,
    };
    if (weight !== undefined && height !== undefined) {
      values.bmi = this.computeBmi(weight, height);
    }

    const [existing] = await this.db
      .select({ id: schema.vitals.id })
      .from(schema.vitals)
      .where(eq(schema.vitals.queueId, queueId));

    let record;
    if (existing) {
      [record] = await this.db
        .update(schema.vitals)
        .set(values)
        .where(eq(schema.vitals.id, existing.id))
        .returning();
    } else {
      [record] = await this.db
        .insert(schema.vitals)
        .values({ queueId, patientId: visit.patientId, nurseId, ...values })
        .returning();
    }

    await this.db
      .update(schema.queue)
      .set({ status: 'TRIAGED', updatedAt: new Date() })
      .where(eq(schema.queue.id, queueId));

    return record;
  }
}
