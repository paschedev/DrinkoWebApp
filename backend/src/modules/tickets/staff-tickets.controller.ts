import { Body, Controller, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { SessionGuard } from '../auth/session.guard';
import { TicketsService } from './tickets.service';

class RedeemDto {
  // Contenido del QR de retiro.
  @IsString()
  @MinLength(1)
  @MaxLength(200)
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
    return this.tickets.redeem(eventId, body.token.trim(), user);
  }
}
