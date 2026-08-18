import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetDatabase } from './db-helpers';
import { authHeader, createPatientAndVisit, createTestApp, login } from './test-app';

async function triageVisit(app: INestApplication, nurseToken: string, queueId: string) {
  await request(app.getHttpServer())
    .post('/api/vitals')
    .set(authHeader(nurseToken))
    .send({ queueId, systolicBp: 120, diastolicBp: 80, heartRate: 72 })
    .expect(201);
}

async function recordConsultation(app: INestApplication, doctorToken: string, queueId: string) {
  await request(app.getHttpServer())
    .post('/api/consultations')
    .set(authHeader(doctorToken))
    .send({
      queueId,
      subjective: 'Cough for 3 days',
      objective: 'Clear lungs',
      assessment: 'Upper respiratory infection',
      plan: 'Rest and fluids',
      icd10Code: 'J06.9',
      icd10Description: 'Acute upper respiratory infection',
    })
    .expect(201);
}

describe('Lab Orders', () => {
  let app: INestApplication;
  let receptionistToken: string;
  let nurseToken: string;
  let doctorToken: string;
  let labTechToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    receptionistToken = await login(app, 'receptionist@clinic.com');
    nurseToken = await login(app, 'nurse@clinic.com');
    doctorToken = await login(app, 'doctor@clinic.com');
    labTechToken = await login(app, 'labtech@clinic.com');
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  it('doctor creates a lab order and visit status becomes LAB_PENDING', async () => {
    const { queueId } = await createPatientAndVisit(app, receptionistToken);
    await triageVisit(app, nurseToken, queueId);
    await recordConsultation(app, doctorToken, queueId);

    const order = await request(app.getHttpServer())
      .post('/api/lab-orders')
      .set(authHeader(doctorToken))
      .send({ queueId, testName: 'CBC' })
      .expect(201);

    expect(order.body.testName).toBe('CBC');
    expect(order.body.status).toBe('PENDING');

    const queue = await request(app.getHttpServer())
      .get('/api/queue')
      .set(authHeader(doctorToken))
      .expect(200);
    expect(queue.body[0].status).toBe('LAB_PENDING');
  });

  it('lists today\'s orders with patient info', async () => {
    const { queueId } = await createPatientAndVisit(app, receptionistToken);
    await triageVisit(app, nurseToken, queueId);
    await recordConsultation(app, doctorToken, queueId);

    await request(app.getHttpServer())
      .post('/api/lab-orders')
      .set(authHeader(doctorToken))
      .send({ queueId, testName: 'Urinalysis' })
      .expect(201);

    const list = await request(app.getHttpServer())
      .get('/api/lab-orders')
      .set(authHeader(doctorToken))
      .expect(200);

    expect(list.body.length).toBe(1);
    expect(list.body[0].testName).toBe('Urinalysis');
    expect(list.body[0].patientName).toBe('Jane Doe');
    expect(list.body[0].status).toBe('PENDING');
  });

  it('finds orders for a specific visit', async () => {
    const { queueId } = await createPatientAndVisit(app, receptionistToken);
    await triageVisit(app, nurseToken, queueId);
    await recordConsultation(app, doctorToken, queueId);

    await request(app.getHttpServer())
      .post('/api/lab-orders')
      .set(authHeader(doctorToken))
      .send({ queueId, testName: 'X-Ray' })
      .expect(201);

    const forVisit = await request(app.getHttpServer())
      .get(`/api/lab-orders/${queueId}`)
      .set(authHeader(doctorToken))
      .expect(200);

    expect(forVisit.body.length).toBe(1);
    expect(forVisit.body[0].testName).toBe('X-Ray');
  });

  it('lab tech completes an order with a result', async () => {
    const { queueId } = await createPatientAndVisit(app, receptionistToken);
    await triageVisit(app, nurseToken, queueId);
    await recordConsultation(app, doctorToken, queueId);

    const order = await request(app.getHttpServer())
      .post('/api/lab-orders')
      .set(authHeader(doctorToken))
      .send({ queueId, testName: 'CBC' })
      .expect(201);

    const completed = await request(app.getHttpServer())
      .patch(`/api/lab-orders/${order.body.id}`)
      .set(authHeader(labTechToken))
      .send({ status: 'COMPLETED', result: 'WBC 7.5, Hgb 14.2' })
      .expect(200);

    expect(completed.body.status).toBe('COMPLETED');
    expect(completed.body.result).toBe('WBC 7.5, Hgb 14.2');
  });

  it('flips visit back to IN_CONSULTATION when last pending order is resolved', async () => {
    const { queueId } = await createPatientAndVisit(app, receptionistToken);
    await triageVisit(app, nurseToken, queueId);
    await recordConsultation(app, doctorToken, queueId);

    const order = await request(app.getHttpServer())
      .post('/api/lab-orders')
      .set(authHeader(doctorToken))
      .send({ queueId, testName: 'CBC' })
      .expect(201);

    let queue = await request(app.getHttpServer())
      .get('/api/queue')
      .set(authHeader(doctorToken))
      .expect(200);
    expect(queue.body[0].status).toBe('LAB_PENDING');

    await request(app.getHttpServer())
      .patch(`/api/lab-orders/${order.body.id}`)
      .set(authHeader(labTechToken))
      .send({ status: 'COMPLETED', result: 'Normal' })
      .expect(200);

    queue = await request(app.getHttpServer())
      .get('/api/queue')
      .set(authHeader(doctorToken))
      .expect(200);
    expect(queue.body[0].status).toBe('IN_CONSULTATION');
  });

  it('lab tech cancels an order', async () => {
    const { queueId } = await createPatientAndVisit(app, receptionistToken);
    await triageVisit(app, nurseToken, queueId);
    await recordConsultation(app, doctorToken, queueId);

    const order = await request(app.getHttpServer())
      .post('/api/lab-orders')
      .set(authHeader(doctorToken))
      .send({ queueId, testName: 'Lipid Panel' })
      .expect(201);

    const cancelled = await request(app.getHttpServer())
      .patch(`/api/lab-orders/${order.body.id}`)
      .set(authHeader(labTechToken))
      .send({ status: 'CANCELLED' })
      .expect(200);

    expect(cancelled.body.status).toBe('CANCELLED');
  });

  it('rejects completing an order without a result', async () => {
    const { queueId } = await createPatientAndVisit(app, receptionistToken);
    await triageVisit(app, nurseToken, queueId);
    await recordConsultation(app, doctorToken, queueId);

    const order = await request(app.getHttpServer())
      .post('/api/lab-orders')
      .set(authHeader(doctorToken))
      .send({ queueId, testName: 'CBC' })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/lab-orders/${order.body.id}`)
      .set(authHeader(labTechToken))
      .send({ status: 'COMPLETED' })
      .expect(400);
  });

  it('rejects updating an already finalized order', async () => {
    const { queueId } = await createPatientAndVisit(app, receptionistToken);
    await triageVisit(app, nurseToken, queueId);
    await recordConsultation(app, doctorToken, queueId);

    const order = await request(app.getHttpServer())
      .post('/api/lab-orders')
      .set(authHeader(doctorToken))
      .send({ queueId, testName: 'CBC' })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/lab-orders/${order.body.id}`)
      .set(authHeader(labTechToken))
      .send({ status: 'COMPLETED', result: 'Normal' })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/lab-orders/${order.body.id}`)
      .set(authHeader(labTechToken))
      .send({ status: 'CANCELLED' })
      .expect(400);
  });

  it('rejects ordering labs without a consultation', async () => {
    const { queueId } = await createPatientAndVisit(app, receptionistToken);
    await triageVisit(app, nurseToken, queueId);

    await request(app.getHttpServer())
      .post('/api/lab-orders')
      .set(authHeader(doctorToken))
      .send({ queueId, testName: 'CBC' })
      .expect(400);
  });

  it('requires a valid queueId', async () => {
    await request(app.getHttpServer())
      .post('/api/lab-orders')
      .set(authHeader(doctorToken))
      .send({ queueId: 'not-a-uuid', testName: 'CBC' })
      .expect(400);
  });

  it('requires a testName', async () => {
    const { queueId } = await createPatientAndVisit(app, receptionistToken);
    await triageVisit(app, nurseToken, queueId);
    await recordConsultation(app, doctorToken, queueId);

    await request(app.getHttpServer())
      .post('/api/lab-orders')
      .set(authHeader(doctorToken))
      .send({ queueId })
      .expect(400);
  });

  it('is DOCTOR+LAB_TECH only for listing', async () => {
    await request(app.getHttpServer())
      .get('/api/lab-orders')
      .set(authHeader(nurseToken))
      .expect(403);
  });

  it('is DOCTOR-only for creating', async () => {
    const { queueId } = await createPatientAndVisit(app, receptionistToken);
    await triageVisit(app, nurseToken, queueId);
    await recordConsultation(app, doctorToken, queueId);

    await request(app.getHttpServer())
      .post('/api/lab-orders')
      .set(authHeader(labTechToken))
      .send({ queueId, testName: 'CBC' })
      .expect(403);
  });

  it('is LAB_TECH-only for updating', async () => {
    const { queueId } = await createPatientAndVisit(app, receptionistToken);
    await triageVisit(app, nurseToken, queueId);
    await recordConsultation(app, doctorToken, queueId);

    const order = await request(app.getHttpServer())
      .post('/api/lab-orders')
      .set(authHeader(doctorToken))
      .send({ queueId, testName: 'CBC' })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/lab-orders/${order.body.id}`)
      .set(authHeader(doctorToken))
      .send({ status: 'COMPLETED', result: 'Normal' })
      .expect(403);
  });
});
