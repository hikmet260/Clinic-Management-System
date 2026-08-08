import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { BillingService, CreateInvoiceInput, PaymentMethod } from './billing.service';
import { Roles } from '../../common/decorators/roles.decorator';

interface AuthedRequest extends Request {
  user: { userId: string; email: string; role: string; fullName: string };
}

@Roles('CASHIER')
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('queue')
  listBillable() {
    return this.billingService.listBillable();
  }

  @Get(':queueId')
  findForVisit(@Param('queueId') queueId: string) {
    return this.billingService.findForVisit(queueId);
  }

  @Post()
  create(@Body() body: CreateInvoiceInput, @Req() req: AuthedRequest) {
    return this.billingService.createInvoice(body, req.user.userId);
  }

  @Patch(':invoiceId')
  markPaid(
    @Param('invoiceId') invoiceId: string,
    @Body() body: { paymentMethod?: PaymentMethod } = {},
  ) {
    return this.billingService.markPaid(invoiceId, body.paymentMethod);
  }
}
