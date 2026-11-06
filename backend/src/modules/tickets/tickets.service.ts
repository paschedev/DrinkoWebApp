import { Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { getRedeemDeadline, getTicketStatus } from '../../common/utils/statuses';

const ticketInclude = {
  event: { select: { name: true, endsAt: true } },
  items: true,
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
  constructor(private readonly prisma: PrismaService) {}

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
}
