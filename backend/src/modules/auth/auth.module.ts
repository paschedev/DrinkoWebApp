import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { EventAccessService } from './event-access.service';
import { OrganizerGuard } from './organizer.guard';
import { SessionGuard } from './session.guard';

@Module({
  controllers: [AuthController],
  providers: [AuthService, SessionGuard, OrganizerGuard, EventAccessService],
  exports: [AuthService, SessionGuard, OrganizerGuard, EventAccessService],
})
export class AuthModule {}
