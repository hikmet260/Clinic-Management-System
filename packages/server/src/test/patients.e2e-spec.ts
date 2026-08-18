import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetDatabase } from './db-helpers';
import { authHeader, createPatientAndVisit, createTestApp, login } from './test-app';

describe('Patients', () => {
  let app: INestApplication;
  let receptionistToken: string;
  let doctorToken: string;
  let adminToken: string;
  let nurseToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    receptionistToken = await login(app, 'receptionist@clinic.com');
    doctorToken = await login(app, 'doctor@clinic.com');
    adminToken = await login(app, 'admin@clinic.com');
    nurseToken = await login(app, 'nurse@clinic.com');
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  it('creates and searches patients', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/patients')
      .set(authHeader(receptionistToken))
      .send({ fullName: 'John Smith', dob: '1985-05-10', gender: 'MALE', phone: '555-1234' })
      .expect(201);
    expect(created.body.mrn).toMatch(/^MRN-/);

    const search = await request(app.getHttpServer())
      .get('/api/patients/search?q=smith')
      .set(authHeader(receptionistToken))
      .expect(200);
    expect(search.body).toHaveLength(1);
    expect(search.body[0].id).toBe(created.body.id);
  });

  it('lists patients paginated', async () => {
    await createPatientAndVisit(app, receptionistToken);
    const page = await request(app.getHttpServer())
      .get('/api/patients?page=1&pageSize=20')
      .set(authHeader(receptionistToken))
      .expect(200);
    expect(page.body.items).toHaveLength(1);
    expect(page.body.total).toBe(1);
  });

  it('returns full visit history for receptionists, doctors, and admins', async () => {
    const { patientId, queueId } = await createPatientAndVisit(app, receptionistToken);

    for (const token of [receptionistToken, doctorToken, adminToken]) {
      const history = await request(app.getHttpServer())
        .get(`/api/patients/${patientId}/history`)
        .set(authHeader(token))
        .expect(200);
      expect(history.body.visits).toHaveLength(1);
      expect(history.body.visits[0].id).toBe(queueId);
    }

    await request(app.getHttpServer())
      .get(`/api/patients/${patientId}/history`)
      .set(authHeader(nurseToken))
      .expect(403);
  });

  it('updates a patient', async () => {
    const { patientId } = await createPatientAndVisit(app, receptionistToken);
    const updated = await request(app.getHttpServer())
      .patch(`/api/patients/${patientId}`)
      .set(authHeader(receptionistToken))
      .send({ fullName: 'Jane Doe Jr.', phone: '555-9999' })
      .expect(200);
    expect(updated.body.fullName).toBe('Jane Doe Jr.');
    expect(updated.body.phone).toBe('555-9999');
  });

  it('rejects admin edits (receptionist-only)', async () => {
    const { patientId } = await createPatientAndVisit(app, receptionistToken);
    await request(app.getHttpServer())
      .patch(`/api/patients/${patientId}`)
      .set(authHeader(adminToken))
      .send({ fullName: 'Hacked' })
      .expect(403);
  });

  it('deletes a patient without visit history', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/patients')
      .set(authHeader(receptionistToken))
      .send({ fullName: 'Ghost', dob: '2000-01-01', gender: 'OTHER', phone: '555-0000' })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/api/patients/${created.body.id}`)
      .set(authHeader(receptionistToken))
      .expect(200);
  });

  it('rejects deleting a patient with visit history', async () => {
    const { patientId } = await createPatientAndVisit(app, receptionistToken);
    await request(app.getHttpServer())
      .delete(`/api/patients/${patientId}`)
      .set(authHeader(receptionistToken))
      .expect(400);
  });

  it('requires receptionist role to create patients', async () => {
    await request(app.getHttpServer())
      .post('/api/patients')
      .set(authHeader(nurseToken))
      .send({ fullName: 'John Smith', dob: '1985-05-10', gender: 'MALE', phone: '555-1234' })
      .expect(403);
  });
});
