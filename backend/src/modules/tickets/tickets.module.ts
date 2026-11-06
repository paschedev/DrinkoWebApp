import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CustomersModule } from '../customers/customers.module';
import { StaffTicketsController } from './staff-tickets.controller';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';

@Module({
  imports: [AuthModule, CustomersModule],
  controllers: [TicketsController, StaffTicketsController],
  providers: [TicketsService],
})
export class TicketsModule {}
