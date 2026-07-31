import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { PatientsModule } from './modules/patients/patients.module';
import { QueueModule } from './modules/queue/queue.module';
import { VitalsModule } from './modules/vitals/vitals.module';
import { ConsultationsModule } from './modules/consultations/consultations.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

const RATE_LIMIT_TTL_MS = Number(process.env.RATE_LIMIT_TTL_MS) || 60_000;
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX) || 100;

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    PatientsModule,
    QueueModule,
    VitalsModule,
    ConsultationsModule,
    ThrottlerModule.forRoot([{ ttl: RATE_LIMIT_TTL_MS, limit: RATE_LIMIT_MAX }]),
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule {}
