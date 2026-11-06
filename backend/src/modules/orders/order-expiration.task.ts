import { Injectable } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { OrdersService } from './orders.service';

// Cada 30 segundos libera las reservas de los pedidos que vencieron sin pagarse.
@Injectable()
export class OrderExpirationTask {
  constructor(private readonly orders: OrdersService) {}

  @Interval(30_000)
  async run() {
    await this.orders.expireOrders();
  }
}
