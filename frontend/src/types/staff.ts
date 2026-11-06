import type { EventStatus, Ticket } from './api';

export type StaffUser = { id: string; name: string; email: string; role: 'PLATFORM_ADMIN' | 'ORGANIZER' | 'STAFF' };

export type StaffEvent = { id: string; name: string; startsAt: string; endsAt: string; status: EventStatus };

export type Offer = {
  eventProductId: string;
  name: string;
  priceCents: number;
  stock: number | null;
  isAvailable: boolean;
};

export type DemandRow = { productName: string; quantity: number };

export type RedeemedTicket = Ticket;
