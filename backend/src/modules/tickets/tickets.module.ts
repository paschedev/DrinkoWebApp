import { Module } from '@nestjs/common';
import { CustomersModule } from '../customers/customers.module';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';

@Module({
  imports: [CustomersModule],
  controllers: [TicketsController],
  providers: [TicketsService],
})
export class TicketsModule {}
