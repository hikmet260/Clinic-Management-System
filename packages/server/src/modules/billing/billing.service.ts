import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { asc, eq, gte } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../database/schema';
import { DRIZZLE } from '../../database/database.module';
import { QueueGateway } from '../queue/queue.gateway';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TERMINAL_STATUSES = ['COMPLETED', 'CANCELLED'];

const PAYMENT_METHODS = ['CASH', 'CARD', 'INSURANCE', 'MOBILE_MONEY'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export interface InvoiceItem {
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface CreateInvoiceInput {
  queueId?: string;
  items?: InvoiceItem[];
  discount?: number;
  isPaid?: boolean;
  paymentMethod?: PaymentMethod;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function money(n: number): string {
  return round2(n).toFixed(2);
}

@Injectable()
export class BillingService {
  constructor(
    @Inject(DRIZZLE) private db: PostgresJsDatabase<typeof schema>,
    private readonly queueGateway: QueueGateway,
  ) {}

  private startOfToday(): Date {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }

  async listBillable() {
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
        hasVitals: schema.vitals.id,
        hasConsultation: schema.consultations.id,
        invoiceId: schema.invoices.id,
        invoiceItems: schema.invoices.items,
        invoiceSubtotal: schema.invoices.subtotal,
        invoiceDiscount: schema.invoices.discount,
        invoiceTotalAmount: schema.invoices.totalAmount,
        invoiceIsPaid: schema.invoices.isPaid,
        invoicePaymentMethod: schema.invoices.paymentMethod,
      })
      .from(schema.queue)
      .innerJoin(schema.patients, eq(schema.queue.patientId, schema.patients.id))
      .leftJoin(schema.vitals, eq(schema.vitals.queueId, schema.queue.id))
      .leftJoin(schema.consultations, eq(schema.consultations.queueId, schema.queue.id))
      .leftJoin(schema.invoices, eq(schema.invoices.queueId, schema.queue.id))
      .where(gte(schema.queue.createdAt, this.startOfToday()))
      .orderBy(asc(schema.queue.tokenNumber));

    return rows.map(
      ({ hasVitals, hasConsultation, invoiceId, invoiceItems, invoiceSubtotal, invoiceDiscount, invoiceTotalAmount, invoiceIsPaid, invoicePaymentMethod, ...entry }) => ({
        ...entry,
        hasVitals: Boolean(hasVitals),
        hasConsultation: Boolean(hasConsultation),
        invoice: invoiceId
          ? {
              id: invoiceId,
              items: invoiceItems as InvoiceItem[],
              subtotal: invoiceSubtotal,
              discount: invoiceDiscount,
              totalAmount: invoiceTotalAmount,
              isPaid: invoiceIsPaid,
              paymentMethod: invoicePaymentMethod,
            }
          : null,
      }),
    );
  }

  async findForVisit(queueId: string) {
    if (!queueId || !UUID_REGEX.test(queueId)) {
      throw new BadRequestException('queueId must be a valid UUID');
    }

    const [record] = await this.db
      .select()
      .from(schema.invoices)
      .where(eq(schema.invoices.queueId, queueId));

    if (!record) {
      throw new NotFoundException('No invoice recorded for this visit');
    }
    return record;
  }

  async createInvoice(input: CreateInvoiceInput, cashierId: string) {
    const queueId = input.queueId ?? '';
    if (!queueId || !UUID_REGEX.test(queueId)) {
      throw new BadRequestException('queueId must be a valid UUID');
    }

    if (!Array.isArray(input.items) || input.items.length === 0) {
      throw new BadRequestException('At least one invoice item is required');
    }

    const items: InvoiceItem[] = input.items.map((item) => {
      const name = item.name?.trim();
      if (!name) {
        throw new BadRequestException('Each invoice item requires a name');
      }
      const quantity = Number(item.quantity);
      if (!Number.isInteger(quantity) || quantity < 1) {
        throw new BadRequestException('Item quantity must be a positive integer');
      }
      const unitPrice = Number(item.unitPrice);
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        throw new BadRequestException('Item unit price must be a non-negative number');
      }
      return { name, quantity, unitPrice: round2(unitPrice) };
    });

    const discount = Number(input.discount ?? 0);
    if (!Number.isFinite(discount) || discount < 0) {
      throw new BadRequestException('Discount must be a non-negative number');
    }

    const paymentMethod = input.paymentMethod;
    if (paymentMethod && !PAYMENT_METHODS.includes(paymentMethod)) {
      throw new BadRequestException(`paymentMethod must be one of ${PAYMENT_METHODS.join(', ')}`);
    }

    const subtotal = round2(items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0));
    if (discount > subtotal) {
      throw new BadRequestException('Discount cannot exceed the subtotal');
    }
    const totalAmount = round2(subtotal - discount);

    const [visit] = await this.db
      .select({ id: schema.queue.id, patientId: schema.queue.patientId, status: schema.queue.status })
      .from(schema.queue)
      .where(eq(schema.queue.id, queueId));

    if (!visit) {
      throw new NotFoundException('Visit not found');
    }
    if (TERMINAL_STATUSES.includes(visit.status)) {
      throw new BadRequestException('Cannot bill a completed or cancelled visit');
    }

    const [existing] = await this.db
      .select({ id: schema.invoices.id })
      .from(schema.invoices)
      .where(eq(schema.invoices.queueId, queueId));

    if (existing) {
      throw new BadRequestException('This visit has already been invoiced');
    }

    const [record] = await this.db
      .insert(schema.invoices)
      .values({
        queueId,
        patientId: visit.patientId,
        cashierId,
        items,
        subtotal: money(subtotal),
        discount: money(discount),
        totalAmount: money(totalAmount),
        isPaid: input.isPaid ?? false,
        paymentMethod: paymentMethod ?? (input.isPaid ? 'CASH' : null),
      })
      .returning();

    await this.db
      .update(schema.queue)
      .set({ status: 'BILLED', updatedAt: new Date() })
      .where(eq(schema.queue.id, queueId));

    this.queueGateway.broadcastQueueChanged('visit-billed');
    return record;
  }

  async markPaid(invoiceId: string, paymentMethod?: PaymentMethod) {
    if (!invoiceId || !UUID_REGEX.test(invoiceId)) {
      throw new BadRequestException('invoiceId must be a valid UUID');
    }

    if (paymentMethod && !PAYMENT_METHODS.includes(paymentMethod)) {
      throw new BadRequestException(`paymentMethod must be one of ${PAYMENT_METHODS.join(', ')}`);
    }

    const [invoice] = await this.db
      .select({
        id: schema.invoices.id,
        isPaid: schema.invoices.isPaid,
        paymentMethod: schema.invoices.paymentMethod,
      })
      .from(schema.invoices)
      .where(eq(schema.invoices.id, invoiceId));

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    if (invoice.isPaid) {
      throw new BadRequestException('Invoice has already been paid');
    }

    const [record] = await this.db
      .update(schema.invoices)
      .set({ isPaid: true, paymentMethod: paymentMethod ?? invoice.paymentMethod ?? 'CASH' })
      .where(eq(schema.invoices.id, invoiceId))
      .returning();

    this.queueGateway.broadcastQueueChanged('invoice-paid');
    return record;
  }
}
