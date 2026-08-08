import { Module } from '@nestjs/common';
import { LabOrdersController } from './lab-orders.controller';
import { LabOrdersService } from './lab-orders.service';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [QueueModule],
  controllers: [LabOrdersController],
  providers: [LabOrdersService],
})
export class LabOrdersModule {}
