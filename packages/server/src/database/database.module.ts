import { Module, Global } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/postgres-js';
import  postgres from 'postgres';
import * as schema from './schema';

export const DRIZZLE = 'DRIZZLE_CONNECTION';

@Global()
@Module({
  providers: [
    {
      provide: DRIZZLE,
      useFactory: () => {
        const connectionString = process.env.DATABASE_URL || 'postgres://clinic_user:clinic_password@localhost:5432/clinic_db';
        const queryClient = postgres(connectionString);
        return drizzle(queryClient, { schema });
      },
    },
  ],
  exports: [DRIZZLE],
})
export class DatabaseModule {}