import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq, gte, sql } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../database/schema';
import { DRIZZLE } from '../../database/database.module';
import { QueueGateway } from '../queue/queue.gateway';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const FINAL_STATUSES = ['BILLED', 'COMPLETED', 'CANCELLED'];

export interface CreateLabOrderInput {
  queueId?: string;
  testName?: string;
}

export interface UpdateLabOrderInput {
  result?: string;
  status?: 'COMPLETED' | 'CANCELLED';
}

@Injectable()
export class LabOrdersService {
  constructor(
    @Inject(DRIZZLE) private db: PostgresJsDatabase<typeof schema>,
    private readonly queueGateway: QueueGateway,
  ) {}

  private startOfToday(): Date {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }

  async createOrder(input: CreateLabOrderInput, doctorId: string) {
    const queueId = input.queueId ?? '';
    if (!queueId || !UUID_REGEX.test(queueId)) {
      throw new BadRequestException('queueId must be a valid UUID');
    }

    const testName = input.testName?.trim();
    if (!testName) {
      throw new BadRequestException('testName is required');
    }

    const [visit] = await this.db
      .select({ id: schema.queue.id, patientId: schema.queue.patientId, status: schema.queue.status })
      .from(schema.queue)
      .where(eq(schema.queue.id, queueId));

    if (!visit) {
      throw new NotFoundException('Visit not found');
    }
    if (FINAL_STATUSES.includes(visit.status)) {
      throw new BadRequestException('Cannot order lab tests for a completed visit');
    }

    const [consultation] = await this.db
      .select({ id: schema.consultations.id })
      .from(schema.consultations)
      .where(eq(schema.consultations.queueId, queueId));

    if (!consultation) {
      throw new BadRequestException('Record a consultation before ordering lab tests');
    }

    const [record] = await this.db
      .insert(schema.labOrders)
      .values({
        consultationId: consultation.id,
        patientId: visit.patientId,
        testName,
        status: 'PENDING',
      })
      .returning();

    await this.db
      .update(schema.queue)
      .set({ status: 'LAB_PENDING', updatedAt: new Date() })
      .where(eq(schema.queue.id, queueId));

    this.queueGateway.broadcastQueueChanged('lab-order-created');
    return record;
  }

  async listToday() {
    const rows = await this.db
      .select({
        id: schema.labOrders.id,
        consultationId: schema.labOrders.consultationId,
        patientId: schema.labOrders.patientId,
        testName: schema.labOrders.testName,
        status: schema.labOrders.status,
        result: schema.labOrders.result,
        labTechId: schema.labOrders.labTechId,
        createdAt: schema.labOrders.createdAt,
        updatedAt: schema.labOrders.updatedAt,
        queueId: schema.queue.id,
        tokenNumber: schema.queue.tokenNumber,
        queueStatus: schema.queue.status,
        patientName: schema.patients.fullName,
        patientMrn: schema.patients.mrn,
      })
      .from(schema.labOrders)
      .innerJoin(schema.consultations, eq(schema.labOrders.consultationId, schema.consultations.id))
      .innerJoin(schema.queue, eq(schema.consultations.queueId, schema.queue.id))
      .innerJoin(schema.patients, eq(schema.queue.patientId, schema.patients.id))
      .where(gte(schema.queue.createdAt, this.startOfToday()))
      .orderBy(
        sql`case when ${schema.labOrders.status} = 'PENDING' then 0 else 1 end`,
        asc(schema.queue.tokenNumber),
        asc(schema.labOrders.createdAt),
      );

    return rows;
  }

  async findForVisit(queueId: string) {
    if (!queueId || !UUID_REGEX.test(queueId)) {
      throw new BadRequestException('queueId must be a valid UUID');
    }

    const rows = await this.db
      .select({
        id: schema.labOrders.id,
        consultationId: schema.labOrders.consultationId,
        patientId: schema.labOrders.patientId,
        testName: schema.labOrders.testName,
        status: schema.labOrders.status,
        result: schema.labOrders.result,
        labTechId: schema.labOrders.labTechId,
        createdAt: schema.labOrders.createdAt,
        updatedAt: schema.labOrders.updatedAt,
        queueId: schema.queue.id,
      })
      .from(schema.labOrders)
      .innerJoin(schema.consultations, eq(schema.labOrders.consultationId, schema.consultations.id))
      .innerJoin(schema.queue, eq(schema.consultations.queueId, schema.queue.id))
      .where(eq(schema.consultations.queueId, queueId))
      .orderBy(asc(schema.labOrders.createdAt));

    return rows;
  }

  async updateOrder(orderId: string, input: UpdateLabOrderInput, labTechId: string) {
    if (!orderId || !UUID_REGEX.test(orderId)) {
      throw new BadRequestException('orderId must be a valid UUID');
    }

    const status = input.status;
    if (status !== 'COMPLETED' && status !== 'CANCELLED') {
      throw new BadRequestException('status must be COMPLETED or CANCELLED');
    }

    const result = input.result?.trim() ?? null;
    if (status === 'COMPLETED' && !result) {
      throw new BadRequestException('A result is required to complete a lab order');
    }

    const [order] = await this.db
      .select({
        id: schema.labOrders.id,
        status: schema.labOrders.status,
        queueId: schema.queue.id,
        queueStatus: schema.queue.status,
      })
      .from(schema.labOrders)
      .innerJoin(schema.consultations, eq(schema.labOrders.consultationId, schema.consultations.id))
      .innerJoin(schema.queue, eq(schema.consultations.queueId, schema.queue.id))
      .where(eq(schema.labOrders.id, orderId));

    if (!order) {
      throw new NotFoundException('Lab order not found');
    }
    if (order.status !== 'PENDING') {
      throw new BadRequestException('Lab order has already been finalized');
    }

    const [record] = await this.db
      .update(schema.labOrders)
      .set({
        status,
        result: status === 'COMPLETED' ? result : null,
        labTechId: status === 'COMPLETED' ? labTechId : null,
        updatedAt: new Date(),
      })
      .where(eq(schema.labOrders.id, orderId))
      .returning();

    if (order.queueStatus === 'LAB_PENDING') {
      const [pending] = await this.db
        .select({ id: schema.labOrders.id })
        .from(schema.labOrders)
        .innerJoin(schema.consultations, eq(schema.labOrders.consultationId, schema.consultations.id))
        .where(
          and(
            eq(schema.consultations.queueId, order.queueId),
            eq(schema.labOrders.status, 'PENDING'),
          ),
        )
        .limit(1);

      if (!pending) {
        await this.db
          .update(schema.queue)
          .set({ status: 'IN_CONSULTATION', updatedAt: new Date() })
          .where(eq(schema.queue.id, order.queueId));
      }
    }

    this.queueGateway.broadcastQueueChanged('lab-order-resolved');
    return record;
  }
}
