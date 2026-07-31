import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { VitalsService, VitalsInput } from './vitals.service';
import { Roles } from '../../common/decorators/roles.decorator';

interface AuthedRequest extends Request {
  user: { userId: string; email: string; role: string; fullName: string };
}

@Roles('NURSE')
@Controller('vitals')
export class VitalsController {
  constructor(private readonly vitalsService: VitalsService) {}

  @Get(':queueId')
  @Roles('NURSE', 'DOCTOR')
  findForVisit(@Param('queueId') queueId: string) {
    return this.vitalsService.findForVisit(queueId);
  }

  @Post()
  save(@Body() body: VitalsInput, @Req() req: AuthedRequest) {
    return this.vitalsService.save(body, req.user.userId);
  }
}
