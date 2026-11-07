import { Body, Controller, Get, NotFoundException, Param, ParseUUIDPipe, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { CustomersService } from '../customers/customers.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrdersService } from './orders.service';

@Controller()
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly customers: CustomersService,
  ) {}

  @Post('events/:code/orders')
  async create(
    @Param('code') code: string,
    @Body() body: CreateOrderDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const customer = await this.customers.findOrCreate(req, res);
    return this.orders.createOrder(code, customer.id, body);
  }

  // Pedido pendiente del cliente en este evento, para retomar el pago.
  @Get('events/:code/orders/pending')
  async findPending(@Param('code') code: string, @Req() req: Request) {
    const customer = await this.customers.findFromRequest(req);
    const order = customer ? await this.orders.findPendingForCustomer(code, customer.id) : null;
    if (!order) throw new NotFoundException('No hay un pedido pendiente');
    return order;
  }

  @Post('orders/:id/cancel')
  async cancel(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    const customer = await this.customers.findFromRequest(req);
    if (!customer) throw new NotFoundException('El pedido no existe');
    return this.orders.cancelOrder(id, customer.id);
  }

  @Get('orders/:id')
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    const customer = await this.customers.findFromRequest(req);
    if (!customer) throw new NotFoundException('El pedido no existe');
    return this.orders.findForCustomer(id, customer.id);
  }
}
