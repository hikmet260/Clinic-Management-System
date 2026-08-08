import { Module } from '@nestjs/common';
import { ConsultationsController } from './consultations.controller';
import { ConsultationsService } from './consultations.service';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [QueueModule],
  controllers: [ConsultationsController],
  providers: [ConsultationsService],
})
export class ConsultationsModule {}
