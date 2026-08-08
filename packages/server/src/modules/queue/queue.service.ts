import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../database/schema';
import { DRIZZLE } from '../../database/database.module';
import { QueueGateway } from './queue.gateway';

const ACTIVE_STATUSES = ['WAITING', 'TRIAGED', 'IN_CONSULTATION', 'LAB_PENDING'] as const;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_TOKEN_RETRIES = 3;

@Injectable()
export class QueueService {
  constructor(
    @Inject(DRIZZLE) private db: PostgresJsDatabase<typeof schema>,
    private readonly queueGateway: QueueGateway,
  ) {}

  private startOfToday(): Date {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }

  private async allocateTokenAndInsert(patientId: string): Promise<typeof schema.queue.$inferSelect> {
    const dayLockKey = Math.floor(this.startOfToday().getTime() / 86400000);

    for (let attempt = 0; attempt < MAX_TOKEN_RETRIES; attempt++) {
      try {
        return await this.db.transaction(async (tx) => {
          await tx.execute(sql`select pg_advisory_xact_lock(${dayLockKey})`);

          const [active] = await tx
            .select({ id: schema.queue.id })
            .from(schema.queue)
            .where(
              and(
                eq(schema.queue.patientId, patientId),
                gte(schema.queue.createdAt, this.startOfToday()),
                inArray(schema.queue.status, [...ACTIVE_STATUSES]),
              ),
            )
            .limit(1);

          if (active) {
            throw new BadRequestException('Patient already has an active visit today');
          }

          const [last] = await tx
            .select({ tokenNumber: schema.queue.tokenNumber })
            .from(schema.queue)
            .where(gte(schema.queue.createdAt, this.startOfToday()))
            .orderBy(desc(schema.queue.tokenNumber))
            .limit(1);

          const [entry] = await tx
            .insert(schema.queue)
            .values({
              patientId,
              tokenNumber: (last?.tokenNumber ?? 0) + 1,
              status: 'WAITING',
            })
            .returning();

          return entry;
        });
      } catch (err) {
        const isUniqueViolation = (err as { code?: string } | null)?.code === '23505';
        if (isUniqueViolation && attempt < MAX_TOKEN_RETRIES - 1) {
          continue;
        }
        throw err;
      }
    }

    throw new Error('Could not allocate a queue token after retries');
  }

  async registerVisit(patientId: string) {
    if (!patientId) {
      throw new BadRequestException('patientId is required');
    }
    if (!UUID_REGEX.test(patientId)) {
      throw new BadRequestException('patientId must be a valid UUID');
    }

    const [patient] = await this.db
      .select({ id: schema.patients.id })
      .from(schema.patients)
      .where(eq(schema.patients.id, patientId));

    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    const entry = await this.allocateTokenAndInsert(patientId);
    this.queueGateway.broadcastQueueChanged('visit-registered');
    return entry;
  }

  async listToday() {
    const rows = await this.db
      .select({
        id: schema.queue.id,
        patientId: schema.queue.patientId,
        tokenNumber: schema.queue.tokenNumber,
        status: schema.queue.status,
        assignedDoctorId: schema.queue.assignedDoctorId,
        createdAt: schema.queue.createdAt,
        updatedAt: schema.queue.updatedAt,
        patientName: schema.patients.fullName,
        patientMrn: schema.patients.mrn,
        vitalsId: schema.vitals.id,
        consultationId: schema.consultations.id,
      })
      .from(schema.queue)
      .innerJoin(schema.patients, eq(schema.queue.patientId, schema.patients.id))
      .leftJoin(schema.vitals, eq(schema.vitals.queueId, schema.queue.id))
      .leftJoin(schema.consultations, eq(schema.consultations.queueId, schema.queue.id))
      .where(gte(schema.queue.createdAt, this.startOfToday()))
      .orderBy(asc(schema.queue.tokenNumber));

    return rows.map(({ vitalsId, consultationId, ...entry }) => ({
      ...entry,
      hasVitals: Boolean(vitalsId),
      hasConsultation: Boolean(consultationId),
    }));
  }

  async listMonitor() {
    const rows = await this.db
      .select({
        tokenNumber: schema.queue.tokenNumber,
        status: schema.queue.status,
        patientName: schema.patients.fullName,
        vitalsId: schema.vitals.id,
        consultationId: schema.consultations.id,
      })
      .from(schema.queue)
      .innerJoin(schema.patients, eq(schema.queue.patientId, schema.patients.id))
      .leftJoin(schema.vitals, eq(schema.vitals.queueId, schema.queue.id))
      .leftJoin(schema.consultations, eq(schema.consultations.queueId, schema.queue.id))
      .where(gte(schema.queue.createdAt, this.startOfToday()))
      .orderBy(asc(schema.queue.tokenNumber));

    return rows.map((row) => ({
      tokenNumber: row.tokenNumber,
      status: row.status,
      hasVitals: Boolean(row.vitalsId),
      hasConsultation: Boolean(row.consultationId),
      displayName: maskName(row.patientName),
    }));
  }
}

function maskName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  const first = parts[0] ?? fullName;
  const lastInitial = parts.length > 1 ? parts[parts.length - 1].charAt(0).toUpperCase() : '';
  return lastInitial ? `${first} ${lastInitial}.` : first;
}
