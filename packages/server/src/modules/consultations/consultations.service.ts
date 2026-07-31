import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../database/schema';
import { DRIZZLE } from '../../database/database.module';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TERMINAL_STATUSES = ['BILLED', 'COMPLETED', 'CANCELLED'];

export interface ConsultationInput {
  queueId?: string;
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  icd10Code?: string;
  icd10Description?: string;
}

@Injectable()
export class ConsultationsService {
  constructor(@Inject(DRIZZLE) private db: PostgresJsDatabase<typeof schema>) {}

  async findForVisit(queueId: string) {
    if (!queueId || !UUID_REGEX.test(queueId)) {
      throw new BadRequestException('queueId must be a valid UUID');
    }

    const [record] = await this.db
      .select()
      .from(schema.consultations)
      .where(eq(schema.consultations.queueId, queueId));

    if (!record) {
      throw new NotFoundException('No consultation recorded for this visit');
    }
    return record;
  }

  async save(input: ConsultationInput, doctorId: string) {
    const queueId = input.queueId ?? '';
    if (!queueId || !UUID_REGEX.test(queueId)) {
      throw new BadRequestException('queueId must be a valid UUID');
    }

    const subjective = input.subjective?.trim() ?? '';
    const objective = input.objective?.trim() ?? '';
    const assessment = input.assessment?.trim() ?? '';
    const plan = input.plan?.trim() ?? '';
    if (!subjective || !objective || !assessment || !plan) {
      throw new BadRequestException('Subjective, objective, assessment, and plan are required');
    }

    const icd10Code = input.icd10Code?.trim() || null;
    const icd10Description = input.icd10Description?.trim() || null;

    const [visit] = await this.db
      .select({ id: schema.queue.id, patientId: schema.queue.patientId, status: schema.queue.status })
      .from(schema.queue)
      .where(eq(schema.queue.id, queueId));

    if (!visit) {
      throw new NotFoundException('Visit not found');
    }
    if (TERMINAL_STATUSES.includes(visit.status)) {
      throw new BadRequestException('Cannot record a consultation for a completed visit');
    }

    const [existing] = await this.db
      .select({ id: schema.consultations.id })
      .from(schema.consultations)
      .where(eq(schema.consultations.queueId, queueId));

    const values = { subjective, objective, assessment, plan, icd10Code, icd10Description };

    let record;
    if (existing) {
      [record] = await this.db
        .update(schema.consultations)
        .set(values)
        .where(eq(schema.consultations.id, existing.id))
        .returning();
    } else {
      [record] = await this.db
        .insert(schema.consultations)
        .values({ queueId, patientId: visit.patientId, doctorId, ...values })
        .returning();
    }

    await this.db
      .update(schema.queue)
      .set({ status: 'IN_CONSULTATION', updatedAt: new Date() })
      .where(eq(schema.queue.id, queueId));

    return record;
  }
}
