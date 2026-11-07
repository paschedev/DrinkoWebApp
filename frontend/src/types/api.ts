// Respuestas de la API del backend.

export type EventStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'FINISHED';

export type CatalogProduct = {
  eventProductId: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  priceCents: number;
  stock: number | null;
  soldOut: boolean;
};

export type Catalog = {
  name: string;
  status: EventStatus;
  startsAt: string;
  endsAt: string;
  categories: { name: string; products: CatalogProduct[] }[];
};

export type TicketItem = { productName: string; unitPriceCents: number; quantity: number };

export type Order = {
  id: string;
  status: 'PENDING_PAYMENT' | 'PAID' | 'REJECTED' | 'EXPIRED';
  totalCents: number;
  expiresAt: string;
  event: { name: string; accessCode: string };
  tickets: { id: string; number: number | null; status: string; items: TicketItem[] }[];
};

export type Ticket = {
  id: string;
  number: number | null;
  status: 'PENDING' | 'ACTIVE' | 'REDEEMED' | 'EXPIRED';
  token: string | null;
  eventName: string;
  eventCode: string;
  redeemableUntil: string;
  redeemedAt: string | null;
  items: TicketItem[];
};
