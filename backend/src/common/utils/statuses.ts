import { TicketStatus } from '@prisma/client';

// Los estados de evento y el vencimiento del ticket se calculan con la hora
// del servidor, igual que las vistas events_with_status y tickets_with_status.

export type EventStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'FINISHED';
export type EffectiveTicketStatus = TicketStatus | 'EXPIRED';

// Los tickets se pueden retirar hasta 1 hora después del fin del evento.
export const REDEEM_WINDOW_MS = 60 * 60 * 1000;

export function getEventStatus(event: { startsAt: Date; endsAt: Date }, now = new Date()): EventStatus {
  if (now < event.startsAt) return 'SCHEDULED';
  if (now < event.endsAt) return 'IN_PROGRESS';
  return 'FINISHED';
}

export function getRedeemDeadline(event: { endsAt: Date }) {
  return new Date(event.endsAt.getTime() + REDEEM_WINDOW_MS);
}

export function getTicketStatus(
  ticket: { status: TicketStatus },
  event: { endsAt: Date },
  now = new Date(),
): EffectiveTicketStatus {
  if (ticket.status === TicketStatus.ACTIVE && now > getRedeemDeadline(event)) return 'EXPIRED';
  return ticket.status;
}
