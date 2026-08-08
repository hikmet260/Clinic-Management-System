import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetDatabase } from './db-helpers';
import { authHeader, createTestApp, login } from './test-app';

describe('Auth', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  it('logs in with valid credentials and returns a token and user', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@clinic.com', password: 'password123' })
      .expect(201);

    expect(response.body.accessToken).toBeDefined();
    expect(response.body.user).toMatchObject({ email: 'admin@clinic.com', role: 'ADMIN' });
  });

  it('rejects a wrong password', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@clinic.com', password: 'wrong-password' })
      .expect(401);
  });

  it('rejects an unknown email', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'nobody@clinic.com', password: 'password123' })
      .expect(401);
  });

  it('rejects missing credentials', async () => {
    await request(app.getHttpServer()).post('/api/auth/login').send({}).expect(400);
  });

  it('rejects requests without a token on protected routes', async () => {
    await request(app.getHttpServer()).get('/api/queue').expect(401);
  });

  it('issues a token that works on a protected route', async () => {
    const token = await login(app, 'nurse@clinic.com');
    await request(app.getHttpServer())
      .get('/api/queue')
      .set(authHeader(token))
      .expect(200);
  });
});
