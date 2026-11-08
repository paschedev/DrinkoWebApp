import type { EventStatus } from './api';

export type PanelEvent = {
  id: string;
  name: string;
  accessCode: string;
  startsAt: string;
  endsAt: string;
  status: EventStatus;
  productCount: number;
  staffCount: number;
};

export type PanelEventDetail = {
  id: string;
  name: string;
  accessCode: string;
  startsAt: string;
  endsAt: string;
  status: EventStatus;
  hasOrders: boolean;
  staffIds: string[];
  products: {
    eventProductId: string;
    productId: string;
    name: string;
    priceCents: number;
    stock: number | null;
    isAvailable: boolean;
  }[];
};

export type PanelProduct = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  requiresPreparation: boolean;
  isArchived: boolean;
  category: { id: string; name: string } | null;
};

export type Category = { id: string; name: string };
export type StaffMember = { id: string; name: string; email: string };
