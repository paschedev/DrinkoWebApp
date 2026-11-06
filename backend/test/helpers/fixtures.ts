import { createHash, randomBytes, randomUUID } from 'crypto';
import { PrismaClient, UserRole } from '@prisma/client';

const MINUTE = 60 * 1000;

export async function clearDatabase(prisma: PrismaClient) {
  await prisma.$executeRawUnsafe(`
    TRUNCATE change_logs, ticket_items, tickets, payments, orders, customers,
             event_products, staff_assignments, events, products, categories,
             invitations, sessions, users, organizations
    CASCADE`);
}

type ProductInput = { name: string; priceCents: number; stock: number | null; isAvailable?: boolean };

// Crea una productora con un evento en curso y la oferta indicada.
export async function createEventFixture(
  prisma: PrismaClient,
  products: ProductInput[],
  options: { startsAt?: Date; endsAt?: Date } = {},
) {
  const org = await prisma.organization.create({ data: { name: 'Productora Test' } });
  const event = await prisma.event.create({
    data: {
      organizationId: org.id,
      name: 'Evento Test',
      accessCode: randomUUID().slice(0, 8),
      startsAt: options.startsAt ?? new Date(Date.now() - 60 * MINUTE),
      endsAt: options.endsAt ?? new Date(Date.now() + 300 * MINUTE),
    },
  });

  const offers: Record<string, string> = {};
  for (const p of products) {
    const product = await prisma.product.create({
      data: { organizationId: org.id, name: p.name },
    });
    const offer = await prisma.eventProduct.create({
      data: {
        eventId: event.id,
        productId: product.id,
        priceCents: p.priceCents,
        stock: p.stock,
        isAvailable: p.isAvailable ?? true,
      },
    });
    offers[p.name] = offer.id;
  }

  return { org, event, offers };
}

export async function createCustomer(prisma: PrismaClient) {
  const secretHash = createHash('sha256').update(randomBytes(32)).digest();
  return prisma.customer.create({ data: { secretHash } });
}

export async function createStaff(prisma: PrismaClient, organizationId: string, eventId?: string) {
  const user = await prisma.user.create({
    data: {
      organizationId,
      email: `${randomUUID()}@drinko.test`,
      name: 'Staff Test',
      role: UserRole.STAFF,
    },
  });
  if (eventId) {
    await prisma.staffAssignment.create({ data: { eventId, userId: user.id } });
  }
  return user;
}

export async function getStock(prisma: PrismaClient, eventProductId: string) {
  const offer = await prisma.eventProduct.findUniqueOrThrow({ where: { id: eventProductId } });
  return offer.stock;
}

export function minutesFromNow(minutes: number) {
  return new Date(Date.now() + minutes * MINUTE);
}
