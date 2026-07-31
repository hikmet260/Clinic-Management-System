import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { json, urlencoded, type Express } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'super-secret-key-change-in-prod') {
      throw new Error('JWT_SECRET must be set to a strong value in production');
    }
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL must be set in production');
    }
  }

  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const expressApp = app.getHttpAdapter().getInstance() as Express;

  app.use(helmet());
  app.use(json({ limit: '16kb' }));
  app.use(urlencoded({ extended: true, limit: '16kb' }));
  expressApp.disable('x-powered-by');

  if (process.env.TRUST_PROXY) {
    expressApp.set('trust proxy', 1);
  }

  const corsOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
    : ['http://localhost:5173'];
  app.enableCors({ origin: corsOrigins });

  app.setGlobalPrefix('api');

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port);
  console.log(`Clinic API running on http://localhost:${port}/api`);
}

void bootstrap();
