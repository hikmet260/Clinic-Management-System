import { Body, Controller, Get, Post } from '@nestjs/common';
import { QueueService } from './queue.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';

@Roles('RECEPTIONIST')
@Controller('queue')
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  @Get()
  @Roles('NURSE', 'RECEPTIONIST', 'DOCTOR')
  listToday() {
    return this.queueService.listToday();
  }

  @Get('monitor')
  @Public()
  monitor() {
    return this.queueService.listMonitor();
  }

  @Post('register')
  register(@Body() body: { patientId?: string }) {
    return this.queueService.registerVisit(body.patientId ?? '');
  }
}
