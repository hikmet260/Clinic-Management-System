import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { CreateLabOrderInput, LabOrdersService, UpdateLabOrderInput } from './lab-orders.service';
import { Roles } from '../../common/decorators/roles.decorator';

interface AuthedRequest extends Request {
  user: { userId: string; email: string; role: string; fullName: string };
}

@Controller('lab-orders')
export class LabOrdersController {
  constructor(private readonly labOrdersService: LabOrdersService) {}

  @Get()
  @Roles('DOCTOR', 'LAB_TECH')
  listToday() {
    return this.labOrdersService.listToday();
  }

  @Get(':queueId')
  @Roles('DOCTOR', 'LAB_TECH')
  findForVisit(@Param('queueId') queueId: string) {
    return this.labOrdersService.findForVisit(queueId);
  }

  @Post()
  @Roles('DOCTOR')
  create(@Body() body: CreateLabOrderInput, @Req() req: AuthedRequest) {
    return this.labOrdersService.createOrder(body, req.user.userId);
  }

  @Patch(':orderId')
  @Roles('LAB_TECH')
  update(@Param('orderId') orderId: string, @Body() body: UpdateLabOrderInput, @Req() req: AuthedRequest) {
    return this.labOrdersService.updateOrder(orderId, body, req.user.userId);
  }
}
