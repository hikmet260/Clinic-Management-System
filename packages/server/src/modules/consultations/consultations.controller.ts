import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { ConsultationsService, ConsultationInput } from './consultations.service';
import { Roles } from '../../common/decorators/roles.decorator';

interface AuthedRequest extends Request {
  user: { userId: string; email: string; role: string; fullName: string };
}

@Roles('DOCTOR')
@Controller('consultations')
export class ConsultationsController {
  constructor(private readonly consultationsService: ConsultationsService) {}

  @Get(':queueId')
  findForVisit(@Param('queueId') queueId: string) {
    return this.consultationsService.findForVisit(queueId);
  }

  @Post()
  save(@Body() body: ConsultationInput, @Req() req: AuthedRequest) {
    return this.consultationsService.save(body, req.user.userId);
  }
}
