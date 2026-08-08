import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetDatabase } from './db-helpers';
import { authHeader, createPatientAndVisit, createTestApp, login } from './test-app';

describe('Queue', () => {
  let app: INestApplication;
  let receptionistToken: string;
  let cashierToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    receptionistToken = await login(app, 'receptionist@clinic.com');
    cashierToken = await login(app, 'cashier@clinic.com');
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  it('registers a patient, lists today\u2019s queue, and issues sequential tokens', async () => {
    const patientResponse = await request(app.getHttpServer())
      .post('/api/patients')
      .set(authHeader(receptionistToken))
      .send({
        fullName: 'Jane Doe',
        dob: '1990-01-01',
        gender: 'FEMALE',
        phone: '555-0100',
      })
      .expect(201);
    const patientId = patientResponse.body.id;

    const visit1 = await request(app.getHttpServer())
      .post('/api/queue/register')
      .set(authHeader(receptionistToken))
      .send({ patientId })
      .expect(201);
    expect(visit1.body.tokenNumber).toBe(1);
    expect(visit1.body.status).toBe('WAITING');

    const list = await request(app.getHttpServer())
      .get('/api/queue')
      .set(authHeader(receptionistToken))
      .expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).toMatchObject({ patientName: 'Jane Doe', tokenNumber: 1 });

    await request(app.getHttpServer())
      .post('/api/queue/register')
      .set(authHeader(receptionistToken))
      .send({ patientId })
      .expect(400);

    const cancelled = await request(app.getHttpServer())
      .patch(`/api/queue/${visit1.body.id}/cancel`)
      .set(authHeader(receptionistToken))
      .expect(200);
    expect(cancelled.body.status).toBe('CANCELLED');

    await request(app.getHttpServer())
      .patch(`/api/queue/${visit1.body.id}/cancel`)
      .set(authHeader(receptionistToken))
      .expect(400);

    const visit2 = await request(app.getHttpServer())
      .post('/api/queue/register')
      .set(authHeader(receptionistToken))
      .send({ patientId })
      .expect(201);
    expect(visit2.body.tokenNumber).toBe(2);
  });

  it('requires BILLED status before completing a visit', async () => {
    const { queueId } = await createPatientAndVisit(app, receptionistToken);
    await request(app.getHttpServer())
      .patch(`/api/queue/${queueId}/complete`)
      .set(authHeader(cashierToken))
      .expect(400);
  });

  it('allows only receptionists to register visits', async () => {
    const doctorToken = await login(app, 'doctor@clinic.com');
    const { patientId } = await createPatientAndVisit(app, receptionistToken);
    await request(app.getHttpServer())
      .post('/api/queue/register')
      .set(authHeader(doctorToken))
      .send({ patientId })
      .expect(403);
  });

  it('validates the patientId format and existence', async () => {
    await request(app.getHttpServer())
      .post('/api/queue/register')
      .set(authHeader(receptionistToken))
      .send({ patientId: 'not-a-uuid' })
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/queue/register')
      .set(authHeader(receptionistToken))
      .send({ patientId: '00000000-0000-4000-8000-000000000000' })
      .expect(404);
  });

  it('exposes the public monitor feed with masked names', async () => {
    const { patientId } = await createPatientAndVisit(app, receptionistToken);
    const monitor = await request(app.getHttpServer()).get('/api/queue/monitor').expect(200);
    expect(monitor.body).toHaveLength(1);
    expect(monitor.body[0].patientName).toBeUndefined();
    expect(monitor.body[0].displayName).toBe('Jane D.');
    expect(monitor.body[0].id).toBeUndefined();
  });
});
