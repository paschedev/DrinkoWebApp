import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { OrganizerEventsController } from './organizer-events.controller';
import { OrganizerEventsService } from './organizer-events.service';
import { StaffEventsController } from './staff-events.controller';

@Module({
  imports: [AuthModule],
  controllers: [EventsController, StaffEventsController, OrganizerEventsController],
  providers: [EventsService, OrganizerEventsService],
  exports: [EventsService],
})
export class EventsModule {}
