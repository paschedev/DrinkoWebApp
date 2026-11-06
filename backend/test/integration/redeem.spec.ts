import { randomUUID } from 'crypto';
import { INestApplication } from '@nestjs/common';
import { TicketStatus, UserRole } from '@prisma/client';
import { AuthUser } from '../../src/modules/auth/auth-user';
import { OrdersService } from '../../src/modules/orders/orders.service';
import { PaymentsService } from '../../src/modules/payments/payments.service';
import { TicketsService } from '../../src/modules/tickets/tickets.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { createTestApp } from '../helpers/app';
import {
  clearDatabase,
  createCustomer,
  createEventFixture,
  createStaff,
  minutesFromNow,
} from '../helpers/fixtures';

describe('Canje de tickets en la barra', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let orders: OrdersService;
  let payments: PaymentsService;
  let tickets: TicketsService;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    orders = app.get(OrdersService);
    payments = app.get(PaymentsService);
    tickets = app.get(TicketsService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await clearDatabase(prisma);
  });

  const asAuthUser = (user: { id: string; organizationId: string | null; role: UserRole; name: string }): AuthUser => ({
    id: user.id,
    organizationId: user.organizationId,
    role: user.role,
    name: user.name,
  });

  // Evento con un ticket pagado y un staff asignado.
  async function paidTicketScenario(options: { endsAt?: Date } = {}) {
    const { org, event, offers } = await createEventFixture(
      prisma,
      [
        { name: 'Cerveza', priceCents: 5000, stock: null },
        { name: 'Gin', priceCents: 8000, stock: null },
      ],
      options,
    );
    const customer = await createCustomer(prisma);
    const order = await orders.createOrder(event.accessCode, customer.id, {
      idempotencyKey: randomUUID(),
      tickets: [
        {
          items: [
            { eventProductId: offers.Cerveza, quantity: 2 },
            { eventProductId: offers.Gin, quantity: 1 },
          ],
        },
      ],
    });
    await payments.paySimulated(order.id, customer.id, true);
    const ticket = await prisma.ticket.findFirstOrThrow({ where: { orderId: order.id } });
    const staff = await createStaff(prisma, org.id, event.id);
    return { org, event, ticket, staff: asAuthUser(staff) };
  }

  it('canjea un ticket activo y devuelve lo que hay que entregar', async () => {
    const { event, ticket, staff } = await paidTicketScenario();

    const result = await tickets.redeem(event.id, ticket.token!, staff);

    expect(result.number).toBe(1);
    expect(result.items).toEqual([
      expect.objectContaining({ productName: 'Cerveza', quantity: 2 }),
      expect.objectContaining({ productName: 'Gin', quantity: 1 }),
    ]);
    const saved = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(saved.status).toBe(TicketStatus.REDEEMED);
    expect(saved.redeemedBy).toBe(staff.id);
    expect(saved.redeemedAt).not.toBeNull();
  });

  it('un ticket ya retirado no se puede volver a canjear', async () => {
    const { event, ticket, staff } = await paidTicketScenario();
    await tickets.redeem(event.id, ticket.token!, staff);

    await expect(tickets.redeem(event.id, ticket.token!, staff)).rejects.toThrow(/ya fue retirado/i);
  });

  it('rechaza un ticket vencido (más de 1 hora después del fin del evento)', async () => {
    const { event, ticket, staff } = await paidTicketScenario();
    const afterWindow = new Date(event.endsAt.getTime() + 61 * 60 * 1000);

    await expect(tickets.redeem(event.id, ticket.token!, staff, afterWindow)).rejects.toThrow(
      /vencido/i,
    );
    const saved = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(saved.status).toBe(TicketStatus.ACTIVE);
  });

  it('se puede canjear durante la hora posterior al fin del evento', async () => {
    const { event, ticket, staff } = await paidTicketScenario();
    const insideWindow = new Date(event.endsAt.getTime() + 30 * 60 * 1000);

    const result = await tickets.redeem(event.id, ticket.token!, staff, insideWindow);
    expect(result.number).toBe(1);
  });

  it('un staff no asignado al evento no puede canjear', async () => {
    const { org, event, ticket } = await paidTicketScenario();
    const other = asAuthUser(await createStaff(prisma, org.id));

    await expect(tickets.redeem(event.id, ticket.token!, other)).rejects.toThrow(/no estás asignado/i);
    const saved = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(saved.status).toBe(TicketStatus.ACTIVE);
  });

  it('un ticket de otro evento no se canjea en esta barra', async () => {
    const first = await paidTicketScenario();
    const second = await paidTicketScenario();

    await expect(tickets.redeem(second.event.id, first.ticket.token!, second.staff)).rejects.toThrow(
      /otro evento/i,
    );
  });

  it('un ticket sin pagar no se puede canjear', async () => {
    const { org, event, offers } = await createEventFixture(prisma, [
      { name: 'Cerveza', priceCents: 5000, stock: null },
    ]);
    const customer = await createCustomer(prisma);
    await orders.createOrder(event.accessCode, customer.id, {
      idempotencyKey: randomUUID(),
      tickets: [{ items: [{ eventProductId: offers.Cerveza, quantity: 1 }] }],
    });
    const staff = asAuthUser(await createStaff(prisma, org.id, event.id));

    // Un ticket pendiente todavía no tiene token: cualquier QR inventado es inválido.
    await expect(tickets.redeem(event.id, 'token-inventado', staff)).rejects.toThrow(/no es válido/i);
  });

  it('el organizador puede canjear en los eventos de su productora', async () => {
    const { org, event, ticket } = await paidTicketScenario();
    const organizer = await prisma.user.create({
      data: { organizationId: org.id, email: 'org@drinko.test', name: 'Org', role: UserRole.ORGANIZER },
    });

    const result = await tickets.redeem(event.id, ticket.token!, asAuthUser(organizer));
    expect(result.number).toBe(1);
  });

  it('en la vista del cliente, el ticket retirado ya no muestra el QR', async () => {
    const { event, ticket, staff } = await paidTicketScenario({ endsAt: minutesFromNow(120) });
    await tickets.redeem(event.id, ticket.token!, staff);

    const view = await tickets.findByToken(ticket.token!);
    expect(view.status).toBe(TicketStatus.REDEEMED);
    expect(view.token).toBeNull();
  });
});
