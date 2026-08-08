import { Module } from '@nestjs/common';
import { VitalsController } from './vitals.controller';
import { VitalsService } from './vitals.service';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [QueueModule],
  controllers: [VitalsController],
  providers: [VitalsService],
})
export class VitalsModule {}
