import { Body, Controller, NotFoundException, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { CustomersService } from '../customers/customers.service';
import { PayOrderDto } from './dto/pay-order.dto';
import { PaymentsService } from './payments.service';

@Controller('orders/:id/payment')
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly customers: CustomersService,
  ) {}

  @Post()
  async pay(@Param('id', ParseUUIDPipe) id: string, @Body() body: PayOrderDto, @Req() req: Request) {
    const customer = await this.customers.findFromRequest(req);
    if (!customer) throw new NotFoundException('El pedido no existe');
    return this.payments.paySimulated(id, customer.id, body.approved);
  }
}
