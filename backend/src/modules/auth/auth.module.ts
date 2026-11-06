import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { EventAccessService } from './event-access.service';
import { SessionGuard } from './session.guard';

@Module({
  controllers: [AuthController],
  providers: [AuthService, SessionGuard, EventAccessService],
  exports: [AuthService, SessionGuard, EventAccessService],
})
export class AuthModule {}
