import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { PrescriptionsService, PrescriptionInput } from './prescriptions.service';
import { Roles } from '../../common/decorators/roles.decorator';

interface AuthedRequest extends Request {
  user: { userId: string; email: string; role: string; fullName: string };
}

@Roles('DOCTOR')
@Controller('prescriptions')
export class PrescriptionsController {
  constructor(private readonly prescriptionsService: PrescriptionsService) {}

  @Get(':queueId')
  findForVisit(@Param('queueId') queueId: string) {
    return this.prescriptionsService.findForVisit(queueId);
  }

  @Post()
  save(@Body() body: PrescriptionInput, @Req() req: AuthedRequest) {
    return this.prescriptionsService.save(body, req.user.userId);
  }
}
