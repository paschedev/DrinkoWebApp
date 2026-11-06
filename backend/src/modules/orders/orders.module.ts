import { Module } from '@nestjs/common';
import { CustomersModule } from '../customers/customers.module';
import { EventsModule } from '../events/events.module';
import { OrderExpirationTask } from './order-expiration.task';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [CustomersModule, EventsModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrderExpirationTask],
  exports: [OrdersService],
})
export class OrdersModule {}
