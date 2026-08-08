import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, gte, inArray, isNull, not, sql } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../database/schema';
import { DRIZZLE } from '../../database/database.module';

const RANGES = ['today', '7d', '30d', 'all'] as const;
export type AnalyticsRange = (typeof RANGES)[number];

const ACTIVE_STATUSES = ['WAITING', 'TRIAGED', 'IN_CONSULTATION', 'LAB_PENDING'] as const;

export interface DayCount {
  date: string;
  count: number;
}

export interface DayRevenue {
  date: string;
  amount: string;
}

export interface StatusCount {
  status: string;
  count: number;
}

export interface GenderCount {
  gender: string;
  count: number;
}

export interface Icd10Count {
  code: string | null;
  description: string | null;
  count: number;
}

export interface LabTestCount {
  testName: string;
  count: number;
}

export interface PaymentMethodRevenue {
  method: string;
  amount: string;
}

export interface AnalyticsOverview {
  range: AnalyticsRange;
  totals: {
    totalVisits: number;
    activeNow: number;
    completed: number;
    cancelled: number;
    avgWaitMinutes: number | null;
    avgVisitDurationMinutes: number | null;
    newPatients: number;
  };
  revenue: {
    totalRevenue: string;
    outstanding: string;
    invoiceCount: number;
    paidCount: number;
    byPaymentMethod: PaymentMethodRevenue[];
  };
  visitsByDay: DayCount[];
  revenueByDay: DayRevenue[];
  visitsByStatus: StatusCount[];
  patientsByGender: GenderCount[];
  topIcd10: Icd10Count[];
  topLabTests: LabTestCount[];
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function money(n: number): string {
  return round2(n).toFixed(2);
}

function round1(n: number): number {
  return Math.round((n + Number.EPSILON) * 10) / 10;
}

@Injectable()
export class AnalyticsService {
  constructor(@Inject(DRIZZLE) private db: PostgresJsDatabase<typeof schema>) {}

  private startOfToday(): Date {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }

  private rangeStart(range: AnalyticsRange): Date | null {
    if (range === 'all') {
      return null;
    }
    const start = this.startOfToday();
    if (range === 'today') {
      return start;
    }
    start.setDate(start.getDate() - (range === '7d' ? 6 : 29));
    return start;
  }

  async overview(range: string): Promise<AnalyticsOverview> {
    if (!RANGES.includes(range as AnalyticsRange)) {
      throw new BadRequestException(`range must be one of ${RANGES.join(', ')}`);
    }

    const resolved = range as AnalyticsRange;
    const start = this.rangeStart(resolved);
    const queueWhere = start ? gte(schema.queue.createdAt, start) : undefined;
    const invoicesWhere = start ? gte(schema.invoices.createdAt, start) : undefined;
    const consultationsWhere = start ? gte(schema.consultations.createdAt, start) : undefined;
    const labOrdersWhere = start ? gte(schema.labOrders.createdAt, start) : undefined;
    const patientsWhere = start ? gte(schema.patients.createdAt, start) : undefined;

    const visitsByStatus = await this.db
      .select({
        status: schema.queue.status,
        count: sql<number>`count(*)::int`,
      })
      .from(schema.queue)
      .where(queueWhere)
      .groupBy(schema.queue.status)
      .orderBy(desc(sql`count(*)`));

    const [activeRow] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.queue)
      .where(
        and(inArray(schema.queue.status, [...ACTIVE_STATUSES]), gte(schema.queue.createdAt, this.startOfToday())),
      );

    const [newPatientsRow] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.patients)
      .where(patientsWhere);

    const [waitRow] = await this.db
      .select({
        avg: sql<string>`avg(extract(epoch from (${schema.vitals.createdAt} - ${schema.queue.createdAt})) / 60)`,
      })
      .from(schema.queue)
      .innerJoin(schema.vitals, eq(schema.vitals.queueId, schema.queue.id))
      .where(queueWhere);

    const [durationRow] = await this.db
      .select({
        avg: sql<string>`avg(extract(epoch from (${schema.queue.updatedAt} - ${schema.queue.createdAt})) / 60)`,
      })
      .from(schema.queue)
      .where(and(eq(schema.queue.status, 'BILLED'), queueWhere));

    const invoices = await this.db
      .select({
        totalAmount: schema.invoices.totalAmount,
        isPaid: schema.invoices.isPaid,
        paymentMethod: schema.invoices.paymentMethod,
      })
      .from(schema.invoices)
      .where(invoicesWhere);

    const paidInvoices = invoices.filter((invoice) => invoice.isPaid);
    const totalRevenue = round2(
      paidInvoices.reduce((sum, invoice) => sum + Number(invoice.totalAmount), 0),
    );
    const outstanding = round2(
      invoices
        .filter((invoice) => !invoice.isPaid)
        .reduce((sum, invoice) => sum + Number(invoice.totalAmount), 0),
    );

    const byMethod = new Map<string, number>();
    for (const invoice of paidInvoices) {
      const method = invoice.paymentMethod ?? 'CASH';
      byMethod.set(method, (byMethod.get(method) ?? 0) + Number(invoice.totalAmount));
    }
    const byPaymentMethod = [...byMethod.entries()]
      .map(([method, amount]) => ({ method, amount: money(round2(amount)) }))
      .sort((a, b) => Number(b.amount) - Number(a.amount));

    const visitsByDay = await this.db
      .select({
        date: sql<string>`to_char(${schema.queue.createdAt}, 'YYYY-MM-DD')`,
        count: sql<number>`count(*)::int`,
      })
      .from(schema.queue)
      .where(queueWhere)
      .groupBy(sql`to_char(${schema.queue.createdAt}, 'YYYY-MM-DD')`)
      .orderBy(asc(sql`min(${schema.queue.createdAt})`));

    const revenueByDay = await this.db
      .select({
        date: sql<string>`to_char(${schema.invoices.createdAt}, 'YYYY-MM-DD')`,
        amount: sql<string>`sum(${schema.invoices.totalAmount})`,
      })
      .from(schema.invoices)
      .where(and(eq(schema.invoices.isPaid, true), invoicesWhere))
      .groupBy(sql`to_char(${schema.invoices.createdAt}, 'YYYY-MM-DD')`)
      .orderBy(asc(sql`min(${schema.invoices.createdAt})`));

    const patientsByGender = await this.db
      .select({
        gender: schema.patients.gender,
        count: sql<number>`count(*)::int`,
      })
      .from(schema.patients)
      .where(patientsWhere)
      .groupBy(schema.patients.gender)
      .orderBy(desc(sql`count(*)`));

    const topIcd10 = await this.db
      .select({
        code: schema.consultations.icd10Code,
        description: schema.consultations.icd10Description,
        count: sql<number>`count(*)::int`,
      })
      .from(schema.consultations)
      .where(and(not(isNull(schema.consultations.icd10Code)), consultationsWhere))
      .groupBy(schema.consultations.icd10Code, schema.consultations.icd10Description)
      .orderBy(desc(sql`count(*)`))
      .limit(10);

    const topLabTests = await this.db
      .select({
        testName: schema.labOrders.testName,
        count: sql<number>`count(*)::int`,
      })
      .from(schema.labOrders)
      .where(and(not(eq(schema.labOrders.status, 'CANCELLED')), labOrdersWhere))
      .groupBy(schema.labOrders.testName)
      .orderBy(desc(sql`count(*)`))
      .limit(10);

    const totalVisits = visitsByStatus.reduce((sum, row) => sum + row.count, 0);
    const completed = visitsByStatus.find((row) => row.status === 'COMPLETED')?.count ?? 0;
    const cancelled = visitsByStatus.find((row) => row.status === 'CANCELLED')?.count ?? 0;

    return {
      range: resolved,
      totals: {
        totalVisits,
        activeNow: activeRow?.count ?? 0,
        completed,
        cancelled,
        avgWaitMinutes: waitRow?.avg != null ? round1(Number(waitRow.avg)) : null,
        avgVisitDurationMinutes:
          durationRow?.avg != null ? Math.max(round1(Number(durationRow.avg)), 0) : null,
        newPatients: newPatientsRow?.count ?? 0,
      },
      revenue: {
        totalRevenue: money(totalRevenue),
        outstanding: money(outstanding),
        invoiceCount: invoices.length,
        paidCount: paidInvoices.length,
        byPaymentMethod,
      },
      visitsByDay: visitsByDay.map((row) => ({ date: row.date, count: row.count })),
      revenueByDay: revenueByDay.map((row) => ({
        date: row.date,
        amount: money(Number(row.amount ?? 0)),
      })),
      visitsByStatus: visitsByStatus.map((row) => ({ status: row.status, count: row.count })),
      patientsByGender: patientsByGender.map((row) => ({ gender: row.gender, count: row.count })),
      topIcd10: topIcd10.map((row) => ({
        code: row.code,
        description: row.description,
        count: row.count,
      })),
      topLabTests: topLabTests.map((row) => ({ testName: row.testName, count: row.count })),
    };
  }
}
