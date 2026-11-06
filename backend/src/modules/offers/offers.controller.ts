import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, UseGuards } from '@nestjs/common';
import { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { SessionGuard } from '../auth/session.guard';
import { UpdateOfferDto } from './dto/update-offer.dto';
import { OffersService } from './offers.service';

@Controller('staff/events/:eventId')
@UseGuards(SessionGuard)
export class OffersController {
  constructor(private readonly offers: OffersService) {}

  @Get('products')
  list(@Param('eventId', ParseUUIDPipe) eventId: string, @CurrentUser() user: AuthUser) {
    return this.offers.listForEvent(eventId, user);
  }

  @Patch('products/:eventProductId')
  update(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Param('eventProductId', ParseUUIDPipe) eventProductId: string,
    @Body() body: UpdateOfferDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.offers.update(eventId, eventProductId, user, body);
  }

  @Get('demand')
  demand(@Param('eventId', ParseUUIDPipe) eventId: string, @CurrentUser() user: AuthUser) {
    return this.offers.getPendingDemand(eventId, user);
  }
}
