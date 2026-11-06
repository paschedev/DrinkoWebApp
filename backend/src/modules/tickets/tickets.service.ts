import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, Prisma, TicketStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  getRedeemDeadline,
  getTicketStatus,
  REDEEM_WINDOW_MS,
} from '../../common/utils/statuses';
import { AuthUser } from '../auth/auth-user';
import { EventAccessService } from '../auth/event-access.service';

const ticketInclude = {
  event: { select: { name: true, endsAt: true } },
  items: { orderBy: { productName: 'asc' } },
} satisfies Prisma.TicketInclude;

type TicketWithDetails = Prisma.TicketGetPayload<{ include: typeof ticketInclude }>;

function toTicketView(ticket: TicketWithDetails, now: Date) {
  const status = getTicketStatus(ticket, ticket.event, now);
  return {
    id: ticket.id,
    number: ticket.number,
    status,
    // Un ticket retirado o vencido deja de mostrar su QR.
    token: status === 'ACTIVE' ? ticket.token : null,
    eventName: ticket.event.name,
    redeemableUntil: getRedeemDeadline(ticket.event),
    redeemedAt: ticket.redeemedAt,
    createdAt: ticket.createdAt,
    items: ticket.items.map((item) => ({
      productName: item.productName,
      unitPriceCents: item.unitPriceCents,
      quantity: item.quantity,
    })),
  };
}

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventAccess: EventAccessService,
  ) {}

  async findByCustomer(customerId: string, now = new Date()) {
    const tickets = await this.prisma.ticket.findMany({
      where: { order: { customerId, status: OrderStatus.PAID } },
      include: ticketInclude,
      orderBy: [{ order: { createdAt: 'desc' } }, { createdAt: 'asc' }],
    });
    return tickets.map((ticket) => toTicketView(ticket, now));
  }

  // El ticket es al portador: quien tiene el token puede verlo.
  async findByToken(token: string, now = new Date()) {
    const ticket = await this.prisma.ticket.findUnique({ where: { token }, include: ticketInclude });
    if (!ticket) throw new NotFoundException('El ticket no existe');
    return toTicketView(ticket, now);
  }

  // Canje: un único UPDATE que solo afecta la fila si el token es válido, el ticket
  // es de este evento, está ACTIVE, no venció y quien escanea puede operar la barra.
  // Si dos barras escanean el mismo QR a la vez, PostgreSQL bloquea la fila: la
  // primera lo marca REDEEMED y la segunda ya no cumple la condición.
  async redeem(eventId: string, token: string, user: AuthUser, now = new Date()) {
    const event = await this.eventAccess.getOperableEvent(user, eventId);
    const organizerOrgId = user.role === 'ORGANIZER' ? user.organizationId : null;
    const windowStart = new Date(now.getTime() - REDEEM_WINDOW_MS);

    const redeemed = await this.prisma.$queryRaw<{ id: string }[]>`
      UPDATE tickets t
         SET status = 'REDEEMED', redeemed_at = ${now}, redeemed_by = ${user.id}::uuid
        FROM events e
       WHERE e.id = t.event_id
         AND t.token = ${token}
         AND t.event_id = ${event.id}::uuid
         AND t.status = 'ACTIVE'
         AND e.ends_at >= ${windowStart}
         AND (
           EXISTS (SELECT 1 FROM staff_assignments sa
                    WHERE sa.event_id = t.event_id AND sa.user_id = ${user.id}::uuid)
           OR e.organization_id = ${organizerOrgId}::uuid
         )
      RETURNING t.id`;

    if (redeemed.length === 1) {
      const ticket = await this.prisma.ticket.findUniqueOrThrow({
        where: { id: redeemed[0].id },
        include: ticketInclude,
      });
      return toTicketView(ticket, now);
    }
    return this.explainRejection(event.id, token, now);
  }

  // El canje no afectó ninguna fila: se busca el motivo para mostrárselo al staff.
  private async explainRejection(eventId: string, token: string, now: Date): Promise<never> {
    const ticket = await this.prisma.ticket.findUnique({ where: { token }, include: ticketInclude });
    if (!ticket) throw new NotFoundException('El QR no es válido');
    if (ticket.eventId !== eventId) throw new ConflictException('Este ticket es de otro evento');

    const status = getTicketStatus(ticket, ticket.event, now);
    if (status === TicketStatus.REDEEMED) {
      const time = ticket.redeemedAt?.toLocaleTimeString('es-AR', {
        timeZone: 'America/Argentina/Buenos_Aires',
        hour: '2-digit',
        minute: '2-digit',
      });
      throw new ConflictException(`El ticket #${ticket.number} ya fue retirado a las ${time}`);
    }
    if (status === 'EXPIRED') throw new ConflictException(`El ticket #${ticket.number} está vencido`);
    if (status === TicketStatus.PENDING) throw new ConflictException('El ticket no está pago');
    throw new ForbiddenException('No estás asignado a este evento');
  }
}
