import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { QueueController } from './queue.controller';
import { QueueService } from './queue.service';
import { QueueGateway } from './queue.gateway';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'super-secret-key-change-in-prod',
      signOptions: { expiresIn: '8h' },
    }),
  ],
  controllers: [QueueController],
  providers: [QueueService, QueueGateway],
  exports: [QueueGateway],
})
export class QueueModule {}
