import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { StaffEventsController } from './staff-events.controller';

@Module({
  imports: [AuthModule],
  controllers: [EventsController, StaffEventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
