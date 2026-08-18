import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetDatabase } from './db-helpers';
import { authHeader, createTestApp, login } from './test-app';

const ADMIN_ID = '11111111-1111-4111-8111-111111111111';

describe('Users', () => {
  let app: INestApplication;
  let adminToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = await login(app, 'admin@clinic.com');
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  it('lists users without exposing password hashes', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/users')
      .set(authHeader(adminToken))
      .expect(200);
    expect(response.body).toHaveLength(6);
    expect(response.body[0]).not.toHaveProperty('passwordHash');
  });

  it('creates, updates, and deletes a user', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/users')
      .set(authHeader(adminToken))
      .send({ email: 'newdoc@clinic.com', password: 'password123', fullName: 'New Doc', role: 'DOCTOR' })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/users/${created.body.id}`)
      .set(authHeader(adminToken))
      .send({ fullName: 'Renamed Doc' })
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/api/users/${created.body.id}`)
      .set(authHeader(adminToken))
      .expect(200);
  });

  it('rejects duplicate emails', async () => {
    const payload = { email: 'dupe@clinic.com', password: 'password123', fullName: 'D', role: 'DOCTOR' };
    await request(app.getHttpServer())
      .post('/api/users')
      .set(authHeader(adminToken))
      .send(payload)
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/users')
      .set(authHeader(adminToken))
      .send({ ...payload, fullName: 'D2' })
      .expect(409);
  });

  it('prevents an admin from deleting their own account', async () => {
    await request(app.getHttpServer())
      .delete(`/api/users/${ADMIN_ID}`)
      .set(authHeader(adminToken))
      .expect(400);
  });

  it('prevents an admin from changing their own role', async () => {
    await request(app.getHttpServer())
      .patch(`/api/users/${ADMIN_ID}`)
      .set(authHeader(adminToken))
      .send({ role: 'NURSE' })
      .expect(400);
  });

  it('allows an admin to update their own profile without changing role', async () => {
    const updated = await request(app.getHttpServer())
      .patch(`/api/users/${ADMIN_ID}`)
      .set(authHeader(adminToken))
      .send({ fullName: 'Renamed Admin' })
      .expect(200);
    expect(updated.body.fullName).toBe('Renamed Admin');
  });
});
