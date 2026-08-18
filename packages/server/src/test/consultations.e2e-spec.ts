import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetDatabase } from './db-helpers';
import { authHeader, createPatientAndVisit, createTestApp, login } from './test-app';

async function triageVisit(
  app: INestApplication,
  nurseToken: string,
  queueId: string,
): Promise<void> {
  await request(app.getHttpServer())
    .post('/api/vitals')
    .set(authHeader(nurseToken))
    .send({ queueId, systolicBp: 120, diastolicBp: 80, heartRate: 72 })
    .expect(201);
}

describe('Consultations', () => {
  let app: INestApplication;
  let receptionistToken: string;
  let nurseToken: string;
  let doctorToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    receptionistToken = await login(app, 'receptionist@clinic.com');
    nurseToken = await login(app, 'nurse@clinic.com');
    doctorToken = await login(app, 'doctor@clinic.com');
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  it('records SOAP notes and marks the visit IN_CONSULTATION', async () => {
    const { queueId } = await createPatientAndVisit(app, receptionistToken);
    await triageVisit(app, nurseToken, queueId);

    const response = await request(app.getHttpServer())
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

    expect(response.body.icd10Code).toBe('J06.9');

    const queue = await request(app.getHttpServer())
      .get('/api/queue')
      .set(authHeader(doctorToken))
      .expect(200);
    expect(queue.body[0]).toMatchObject({ status: 'IN_CONSULTATION', hasConsultation: true });
  });

  it('upserts consultation notes for a visit instead of creating duplicates', async () => {
    const { queueId } = await createPatientAndVisit(app, receptionistToken);
    await triageVisit(app, nurseToken, queueId);

    await request(app.getHttpServer())
      .post('/api/consultations')
      .set(authHeader(doctorToken))
      .send({
        queueId,
        subjective: 'Cough',
        objective: 'Clear',
        assessment: 'URI',
        plan: 'Rest',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/consultations')
      .set(authHeader(doctorToken))
      .send({
        queueId,
        subjective: 'Cough worse',
        objective: 'Wheezing',
        assessment: 'URI',
        plan: 'Inhaler',
      })
      .expect(201);

    const fetched = await request(app.getHttpServer())
      .get(`/api/consultations/${queueId}`)
      .set(authHeader(doctorToken))
      .expect(200);
    expect(fetched.body.subjective).toBe('Cough worse');
  });

  it('requires all SOAP sections', async () => {
    const { queueId } = await createPatientAndVisit(app, receptionistToken);
    await triageVisit(app, nurseToken, queueId);

    await request(app.getHttpServer())
      .post('/api/consultations')
      .set(authHeader(doctorToken))
      .send({ queueId, subjective: 'Cough', objective: 'Clear', assessment: 'URI' })
      .expect(400);
  });

  it('returns 404 when no consultation exists for a visit', async () => {
    const { queueId } = await createPatientAndVisit(app, receptionistToken);
    await triageVisit(app, nurseToken, queueId);

    await request(app.getHttpServer())
      .get(`/api/consultations/${queueId}`)
      .set(authHeader(doctorToken))
      .expect(404);
  });

  it('rejects consultations on a non-triaged (WAITING) visit', async () => {
    const { queueId } = await createPatientAndVisit(app, receptionistToken);

    await request(app.getHttpServer())
      .post('/api/consultations')
      .set(authHeader(doctorToken))
      .send({
        queueId,
        subjective: 'Cough',
        objective: 'Clear',
        assessment: 'URI',
        plan: 'Rest',
      })
      .expect(400);
  });

  it('rejects consultations for a cancelled visit', async () => {
    const { queueId } = await createPatientAndVisit(app, receptionistToken);
    await triageVisit(app, nurseToken, queueId);
    await request(app.getHttpServer())
      .patch(`/api/queue/${queueId}/cancel`)
      .set(authHeader(receptionistToken))
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/consultations')
      .set(authHeader(doctorToken))
      .send({
        queueId,
        subjective: 'Cough',
        objective: 'Clear',
        assessment: 'URI',
        plan: 'Rest',
      })
      .expect(400);
  });

  it('is DOCTOR-only', async () => {
    const { queueId } = await createPatientAndVisit(app, receptionistToken);
    await triageVisit(app, nurseToken, queueId);

    await request(app.getHttpServer())
      .post('/api/consultations')
      .set(authHeader(nurseToken))
      .send({
        queueId,
        subjective: 'Cough',
        objective: 'Clear',
        assessment: 'URI',
        plan: 'Rest',
      })
      .expect(403);
  });

  it('requires a valid queueId', async () => {
    await request(app.getHttpServer())
      .post('/api/consultations')
      .set(authHeader(doctorToken))
      .send({
        queueId: 'not-a-uuid',
        subjective: 'Cough',
        objective: 'Clear',
        assessment: 'URI',
        plan: 'Rest',
      })
      .expect(400);
  });
});
