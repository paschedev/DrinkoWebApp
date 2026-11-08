import { Body, Controller, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { Matches } from 'class-validator';
import { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { SessionGuard } from '../auth/session.guard';
import { TicketsService } from './tickets.service';

class RedeemDto {
  // Contenido del QR de retiro: 128 bits en base64url = 22 caracteres.
  @Matches(/^[A-Za-z0-9_-]{22}$/, { message: 'El código no tiene el formato de un QR de Drinko' })
  token: string;
}

@Controller('staff/events/:eventId/redemptions')
@UseGuards(SessionGuard)
export class StaffTicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Post()
  redeem(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() body: RedeemDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tickets.redeem(eventId, body.token, user);
  }
}
