import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetDatabase } from './db-helpers';
import { authHeader, createPatientAndVisit, createTestApp, login } from './test-app';

describe('Vitals', () => {
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

  it('records vitals, computes BMI, and marks the visit TRIAGED', async () => {
    const { queueId } = await createPatientAndVisit(app, receptionistToken);

    const response = await request(app.getHttpServer())
      .post('/api/vitals')
      .set(authHeader(nurseToken))
      .send({
        queueId,
        systolicBp: 120,
        diastolicBp: 80,
        heartRate: 72,
        temperature: 36.6,
        weight: 70,
        height: 175,
        notes: 'Stable',
      })
      .expect(201);

    expect(response.body.bmi).toBe('22.9');
    expect(response.body.systolicBp).toBe(120);

    const queue = await request(app.getHttpServer())
      .get('/api/queue')
      .set(authHeader(nurseToken))
      .expect(200);
    expect(queue.body[0]).toMatchObject({ status: 'TRIAGED', hasVitals: true });
  });

  it('upserts vitals for a visit instead of creating duplicates', async () => {
    const { queueId } = await createPatientAndVisit(app, receptionistToken);

    await request(app.getHttpServer())
      .post('/api/vitals')
      .set(authHeader(nurseToken))
      .send({ queueId, weight: 70, height: 175 })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/vitals')
      .set(authHeader(nurseToken))
      .send({ queueId, weight: 72, height: 175 })
      .expect(201);

    const fetched = await request(app.getHttpServer())
      .get(`/api/vitals/${queueId}`)
      .set(authHeader(nurseToken))
      .expect(200);
    expect(fetched.body.weight).toBe('72.00');
  });

  it('does not regress a visit past WAITING when vitals are re-saved', async () => {
    const { queueId } = await createPatientAndVisit(app, receptionistToken);

    await request(app.getHttpServer())
      .post('/api/vitals')
      .set(authHeader(nurseToken))
      .send({ queueId, weight: 70, height: 175 })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/consultations')
      .set(authHeader(doctorToken))
      .send({ queueId, subjective: 'Cough', objective: 'Clear', assessment: 'URI', plan: 'Rest' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/vitals')
      .set(authHeader(nurseToken))
      .send({ queueId, weight: 71 })
      .expect(201);

    const queue = await request(app.getHttpServer())
      .get('/api/queue')
      .set(authHeader(nurseToken))
      .expect(200);
    expect(queue.body[0]).toMatchObject({ status: 'IN_CONSULTATION' });
  });

  it('rejects out-of-range values', async () => {
    const { queueId } = await createPatientAndVisit(app, receptionistToken);
    await request(app.getHttpServer())
      .post('/api/vitals')
      .set(authHeader(nurseToken))
      .send({ queueId, heartRate: 999 })
      .expect(400);
  });

  it('rejects vitals with no values at all', async () => {
    const { queueId } = await createPatientAndVisit(app, receptionistToken);
    await request(app.getHttpServer())
      .post('/api/vitals')
      .set(authHeader(nurseToken))
      .send({ queueId })
      .expect(400);
  });

  it('rejects vitals for a cancelled visit', async () => {
    const { queueId } = await createPatientAndVisit(app, receptionistToken);
    await request(app.getHttpServer())
      .patch(`/api/queue/${queueId}/cancel`)
      .set(authHeader(receptionistToken))
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/vitals')
      .set(authHeader(nurseToken))
      .send({ queueId, heartRate: 72 })
      .expect(400);
  });

  it('requires a valid queueId', async () => {
    await request(app.getHttpServer())
      .post('/api/vitals')
      .set(authHeader(nurseToken))
      .send({ queueId: 'not-a-uuid', heartRate: 72 })
      .expect(400);
  });
});
