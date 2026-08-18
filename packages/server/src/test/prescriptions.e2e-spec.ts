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
    })
    .expect(201);
}

describe('Prescriptions', () => {
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

  it('creates a prescription with medications', async () => {
    const { queueId } = await createPatientAndVisit(app, receptionistToken);
    await triageVisit(app, nurseToken, queueId);
    await recordConsultation(app, doctorToken, queueId);

    const prescription = await request(app.getHttpServer())
      .post('/api/prescriptions')
      .set(authHeader(doctorToken))
      .send({
        queueId,
        medications: [{ name: 'Amoxicillin', dosage: '500mg', frequency: 'TID', duration: '7 days' }],
        notes: 'Take with food',
      })
      .expect(201);

    expect(prescription.body.medications).toHaveLength(1);
    expect(prescription.body.medications[0].name).toBe('Amoxicillin');
    expect(prescription.body.medications[0].dosage).toBe('500mg');
    expect(prescription.body.notes).toBe('Take with food');
  });

  it('fetches a prescription for a visit', async () => {
    const { queueId } = await createPatientAndVisit(app, receptionistToken);
    await triageVisit(app, nurseToken, queueId);
    await recordConsultation(app, doctorToken, queueId);

    await request(app.getHttpServer())
      .post('/api/prescriptions')
      .set(authHeader(doctorToken))
      .send({
        queueId,
        medications: [{ name: 'Ibuprofen', dosage: '400mg' }],
      })
      .expect(201);

    const fetched = await request(app.getHttpServer())
      .get(`/api/prescriptions/${queueId}`)
      .set(authHeader(doctorToken))
      .expect(200);

    expect(fetched.body.medications[0].name).toBe('Ibuprofen');
  });

  it('upserts prescription for a visit instead of creating duplicates', async () => {
    const { queueId } = await createPatientAndVisit(app, receptionistToken);
    await triageVisit(app, nurseToken, queueId);
    await recordConsultation(app, doctorToken, queueId);

    await request(app.getHttpServer())
      .post('/api/prescriptions')
      .set(authHeader(doctorToken))
      .send({
        queueId,
        medications: [{ name: 'Amoxicillin' }],
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/prescriptions')
      .set(authHeader(doctorToken))
      .send({
        queueId,
        medications: [{ name: 'Azithromycin' }, { name: 'Paracetamol' }],
      })
      .expect(201);

    const fetched = await request(app.getHttpServer())
      .get(`/api/prescriptions/${queueId}`)
      .set(authHeader(doctorToken))
      .expect(200);

    expect(fetched.body.medications).toHaveLength(2);
    expect(fetched.body.medications[0].name).toBe('Azithromycin');
  });

  it('strips empty optional fields from medications', async () => {
    const { queueId } = await createPatientAndVisit(app, receptionistToken);
    await triageVisit(app, nurseToken, queueId);
    await recordConsultation(app, doctorToken, queueId);

    const prescription = await request(app.getHttpServer())
      .post('/api/prescriptions')
      .set(authHeader(doctorToken))
      .send({
        queueId,
        medications: [{ name: 'Paracetamol', dosage: '', frequency: '', duration: '' }],
      })
      .expect(201);

    expect(prescription.body.medications[0]).toEqual({ name: 'Paracetamol' });
  });

  it('requires at least one medication', async () => {
    const { queueId } = await createPatientAndVisit(app, receptionistToken);
    await triageVisit(app, nurseToken, queueId);
    await recordConsultation(app, doctorToken, queueId);

    await request(app.getHttpServer())
      .post('/api/prescriptions')
      .set(authHeader(doctorToken))
      .send({ queueId, medications: [] })
      .expect(400);
  });

  it('requires a medication name', async () => {
    const { queueId } = await createPatientAndVisit(app, receptionistToken);
    await triageVisit(app, nurseToken, queueId);
    await recordConsultation(app, doctorToken, queueId);

    await request(app.getHttpServer())
      .post('/api/prescriptions')
      .set(authHeader(doctorToken))
      .send({ queueId, medications: [{ dosage: '500mg' }] })
      .expect(400);
  });

  it('rejects prescriptions without a consultation', async () => {
    const { queueId } = await createPatientAndVisit(app, receptionistToken);
    await triageVisit(app, nurseToken, queueId);

    await request(app.getHttpServer())
      .post('/api/prescriptions')
      .set(authHeader(doctorToken))
      .send({ queueId, medications: [{ name: 'Amoxicillin' }] })
      .expect(400);
  });

  it('returns 404 when no prescription exists for a visit', async () => {
    const { queueId } = await createPatientAndVisit(app, receptionistToken);
    await triageVisit(app, nurseToken, queueId);
    await recordConsultation(app, doctorToken, queueId);

    await request(app.getHttpServer())
      .get(`/api/prescriptions/${queueId}`)
      .set(authHeader(doctorToken))
      .expect(404);
  });

  it('rejects prescriptions for a cancelled visit', async () => {
    const { queueId } = await createPatientAndVisit(app, receptionistToken);
    await triageVisit(app, nurseToken, queueId);
    await recordConsultation(app, doctorToken, queueId);

    await request(app.getHttpServer())
      .patch(`/api/queue/${queueId}/cancel`)
      .set(authHeader(receptionistToken))
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/prescriptions')
      .set(authHeader(doctorToken))
      .send({ queueId, medications: [{ name: 'Amoxicillin' }] })
      .expect(400);
  });

  it('is DOCTOR-only', async () => {
    const { queueId } = await createPatientAndVisit(app, receptionistToken);
    await triageVisit(app, nurseToken, queueId);
    await recordConsultation(app, doctorToken, queueId);

    await request(app.getHttpServer())
      .post('/api/prescriptions')
      .set(authHeader(nurseToken))
      .send({ queueId, medications: [{ name: 'Amoxicillin' }] })
      .expect(403);
  });

  it('requires a valid queueId', async () => {
    await request(app.getHttpServer())
      .post('/api/prescriptions')
      .set(authHeader(doctorToken))
      .send({ queueId: 'not-a-uuid', medications: [{ name: 'Amoxicillin' }] })
      .expect(400);
  });

  it('does not change visit status', async () => {
    const { queueId } = await createPatientAndVisit(app, receptionistToken);
    await triageVisit(app, nurseToken, queueId);
    await recordConsultation(app, doctorToken, queueId);

    await request(app.getHttpServer())
      .post('/api/prescriptions')
      .set(authHeader(doctorToken))
      .send({ queueId, medications: [{ name: 'Amoxicillin' }] })
      .expect(201);

    const queue = await request(app.getHttpServer())
      .get('/api/queue')
      .set(authHeader(doctorToken))
      .expect(200);
    expect(queue.body[0].status).toBe('IN_CONSULTATION');
  });
});
