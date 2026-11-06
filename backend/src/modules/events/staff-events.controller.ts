import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { EventAccessService } from '../auth/event-access.service';
import { SessionGuard } from '../auth/session.guard';

// Eventos en los que el usuario de la sesión puede operar la barra.
@Controller('staff/events')
@UseGuards(SessionGuard)
export class StaffEventsController {
  constructor(private readonly eventAccess: EventAccessService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.eventAccess.listOperableEvents(user);
  }
}
