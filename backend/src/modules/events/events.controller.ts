import { Controller, Get, Param } from '@nestjs/common';
import { EventsService } from './events.service';

@Controller('events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Get(':code')
  getCatalog(@Param('code') code: string) {
    return this.events.getCatalog(code);
  }
}
