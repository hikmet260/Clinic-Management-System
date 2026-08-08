import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../app.module';

export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  await app.init();
  return app;
}

export async function login(
  app: INestApplication,
  email: string,
  password = 'password123',
): Promise<string> {
  const response = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email, password })
    .expect(201);
  return response.body.accessToken as string;
}

export function authHeader(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

export async function createPatientAndVisit(
  app: INestApplication,
  receptionistToken: string,
  patientOverrides: Record<string, unknown> = {},
): Promise<{ patientId: string; queueId: string; tokenNumber: number }> {
  const patientResponse = await request(app.getHttpServer())
    .post('/api/patients')
    .set(authHeader(receptionistToken))
    .send({
      fullName: 'Jane Doe',
      dob: '1990-01-01',
      gender: 'FEMALE',
      phone: '555-0100',
      ...patientOverrides,
    })
    .expect(201);

  const visitResponse = await request(app.getHttpServer())
    .post('/api/queue/register')
    .set(authHeader(receptionistToken))
    .send({ patientId: patientResponse.body.id })
    .expect(201);

  return {
    patientId: patientResponse.body.id,
    queueId: visitResponse.body.id,
    tokenNumber: visitResponse.body.tokenNumber,
  };
}
