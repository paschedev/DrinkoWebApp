import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { OrganizerGuard } from '../auth/organizer.guard';
import { AddOffersDto, AssignStaffDto, CreateEventDto, UpdateEventDto } from './dto/organizer-event.dto';
import { OrganizerEventsService } from './organizer-events.service';

@Controller('organizer')
@UseGuards(OrganizerGuard)
export class OrganizerEventsController {
  constructor(private readonly events: OrganizerEventsService) {}

  @Get('staff')
  staff(@CurrentUser() user: AuthUser) {
    return this.events.listStaff(user);
  }

  @Get('events')
  list(@CurrentUser() user: AuthUser) {
    return this.events.list(user);
  }

  @Post('events')
  create(@CurrentUser() user: AuthUser, @Body() body: CreateEventDto) {
    return this.events.create(user, body);
  }

  @Get('events/:id')
  detail(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.events.detail(user, id);
  }

  @Patch('events/:id')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateEventDto) {
    return this.events.update(user, id, body);
  }

  @Delete('events/:id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.events.remove(user, id);
  }

  @Put('events/:id/staff')
  assignStaff(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: AssignStaffDto) {
    return this.events.assignStaff(user, id, body.staffIds);
  }

  @Post('events/:id/products')
  addProducts(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: AddOffersDto) {
    return this.events.addOffers(user, id, body.products);
  }
}
