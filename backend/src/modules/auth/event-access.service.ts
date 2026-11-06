import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Event, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { getEventStatus } from '../../common/utils/statuses';
import { AuthUser } from './auth-user';

// Quién puede operar la barra de un evento: el staff asignado a ese evento
// o un organizador de la misma productora.
@Injectable()
export class EventAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async canOperate(user: AuthUser, event: Event) {
    if (user.role === UserRole.ORGANIZER) return event.organizationId === user.organizationId;
    if (user.role !== UserRole.STAFF) return false;
    const assignment = await this.prisma.staffAssignment.findUnique({
      where: { eventId_userId: { eventId: event.id, userId: user.id } },
    });
    return assignment !== null;
  }

  async getOperableEvent(user: AuthUser, eventId: string) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('El evento no existe');
    if (!(await this.canOperate(user, event))) {
      throw new ForbiddenException('No estás asignado a este evento');
    }
    return event;
  }

  async listOperableEvents(user: AuthUser, now = new Date()) {
    let where: Prisma.EventWhereInput;
    if (user.role === UserRole.ORGANIZER && user.organizationId) {
      where = { organizationId: user.organizationId };
    } else if (user.role === UserRole.STAFF) {
      where = { staffAssignments: { some: { userId: user.id } } };
    } else {
      return [];
    }

    const events = await this.prisma.event.findMany({ where, orderBy: { startsAt: 'desc' } });
    return events.map((event) => ({
      id: event.id,
      name: event.name,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      status: getEventStatus(event, now),
    }));
  }
}
