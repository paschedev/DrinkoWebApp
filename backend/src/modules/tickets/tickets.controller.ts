import { Controller, Get, Param, Req } from '@nestjs/common';
import { Request } from 'express';
import { CustomersService } from '../customers/customers.service';
import { TicketsService } from './tickets.service';

@Controller('tickets')
export class TicketsController {
  constructor(
    private readonly tickets: TicketsService,
    private readonly customers: CustomersService,
  ) {}

  // Tickets comprados desde este navegador.
  @Get()
  async findMine(@Req() req: Request) {
    const customer = await this.customers.findFromRequest(req);
    return customer ? this.tickets.findByCustomer(customer.id) : [];
  }

  @Get(':token')
  findByToken(@Param('token') token: string) {
    return this.tickets.findByToken(token);
  }
}
