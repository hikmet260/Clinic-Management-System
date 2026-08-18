import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetDatabase } from './db-helpers';
import { authHeader, createPatientAndVisit, createTestApp, login } from './test-app';

describe('Billing', () => {
  let app: INestApplication;
  let receptionistToken: string;
  let cashierToken: string;
  let nurseToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    receptionistToken = await login(app, 'receptionist@clinic.com');
    cashierToken = await login(app, 'cashier@clinic.com');
    nurseToken = await login(app, 'nurse@clinic.com');
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  it('creates an invoice with computed totals, marks the visit BILLED, marks paid, then completes', async () => {
    const { queueId } = await createPatientAndVisit(app, receptionistToken);

    const invoice = await request(app.getHttpServer())
      .post('/api/billing')
      .set(authHeader(cashierToken))
      .send({
        queueId,
        items: [
          { name: 'Consultation', quantity: 1, unitPrice: 50 },
          { name: 'Blood test', quantity: 2, unitPrice: 15 },
        ],
        discount: 5,
      })
      .expect(201);

    expect(invoice.body.subtotal).toBe('80.00');
    expect(invoice.body.discount).toBe('5.00');
    expect(invoice.body.totalAmount).toBe('75.00');
    expect(invoice.body.isPaid).toBe(false);

    await request(app.getHttpServer())
      .post('/api/billing')
      .set(authHeader(cashierToken))
      .send({ queueId, items: [{ name: 'Consultation', quantity: 1, unitPrice: 50 }] })
      .expect(400);

    const billable = await request(app.getHttpServer())
      .get('/api/billing/queue')
      .set(authHeader(cashierToken))
      .expect(200);
    expect(billable.body[0]).toMatchObject({ status: 'BILLED' });
    expect(billable.body[0].invoice.totalAmount).toBe('75.00');

    const paid = await request(app.getHttpServer())
      .patch(`/api/billing/${invoice.body.id}`)
      .set(authHeader(cashierToken))
      .send({ paymentMethod: 'CASH' })
      .expect(200);
    expect(paid.body.isPaid).toBe(true);

    await request(app.getHttpServer())
      .patch(`/api/billing/${invoice.body.id}`)
      .set(authHeader(cashierToken))
      .expect(400);

    const completed = await request(app.getHttpServer())
      .patch(`/api/queue/${queueId}/complete`)
      .set(authHeader(cashierToken))
      .expect(200);
    expect(completed.body.status).toBe('COMPLETED');
  });

  it('rejects billing a cancelled visit', async () => {
    const { queueId } = await createPatientAndVisit(app, receptionistToken);
    await request(app.getHttpServer())
      .patch(`/api/queue/${queueId}/cancel`)
      .set(authHeader(receptionistToken))
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/billing')
      .set(authHeader(cashierToken))
      .send({ queueId, items: [{ name: 'Consultation', quantity: 1, unitPrice: 50 }] })
      .expect(400);
  });

  it('rejects a discount above the subtotal', async () => {
    const { queueId } = await createPatientAndVisit(app, receptionistToken);
    await request(app.getHttpServer())
      .post('/api/billing')
      .set(authHeader(cashierToken))
      .send({ queueId, items: [{ name: 'Consultation', quantity: 1, unitPrice: 50 }], discount: 1000 })
      .expect(400);
  });

  it('rejects an invalid payment method', async () => {
    const { queueId } = await createPatientAndVisit(app, receptionistToken);
    await request(app.getHttpServer())
      .post('/api/billing')
      .set(authHeader(cashierToken))
      .send({
        queueId,
        items: [{ name: 'Consultation', quantity: 1, unitPrice: 50 }],
        paymentMethod: 'BITCOIN',
      })
      .expect(400);
  });

  it('preserves the chosen payment method when an unpaid invoice is later marked paid', async () => {
    const { queueId } = await createPatientAndVisit(app, receptionistToken);

    const invoice = await request(app.getHttpServer())
      .post('/api/billing')
      .set(authHeader(cashierToken))
      .send({
        queueId,
        items: [{ name: 'Consultation', quantity: 1, unitPrice: 50 }],
        paymentMethod: 'CARD',
      })
      .expect(201);

    expect(invoice.body.isPaid).toBe(false);
    expect(invoice.body.paymentMethod).toBe('CARD');

    const paid = await request(app.getHttpServer())
      .patch(`/api/billing/${invoice.body.id}`)
      .set(authHeader(cashierToken))
      .expect(200);

    expect(paid.body.isPaid).toBe(true);
    expect(paid.body.paymentMethod).toBe('CARD');
  });

  it('requires at least one invoice item', async () => {
    const { queueId } = await createPatientAndVisit(app, receptionistToken);
    await request(app.getHttpServer())
      .post('/api/billing')
      .set(authHeader(cashierToken))
      .send({ queueId, items: [] })
      .expect(400);
  });

  it('allows only cashiers to create invoices', async () => {
    const { queueId } = await createPatientAndVisit(app, receptionistToken);
    await request(app.getHttpServer())
      .post('/api/billing')
      .set(authHeader(nurseToken))
      .send({ queueId, items: [{ name: 'Consultation', quantity: 1, unitPrice: 50 }] })
      .expect(403);
  });
});
