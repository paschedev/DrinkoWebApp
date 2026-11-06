import { randomUUID } from 'crypto';
import { INestApplication } from '@nestjs/common';
import { TicketStatus } from '@prisma/client';
import { OrdersService } from '../../src/modules/orders/orders.service';
import { PaymentsService } from '../../src/modules/payments/payments.service';
import { TicketsService } from '../../src/modules/tickets/tickets.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { createTestApp } from '../helpers/app';
import { clearDatabase, createCustomer, createEventFixture, createStaff } from '../helpers/fixtures';

describe('Concurrencia en el canje', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await clearDatabase(prisma);
  });

  it('50 escaneos simultáneos del mismo QR desde varias barras: exactamente 1 canje', async () => {
    const { org, event, offers } = await createEventFixture(prisma, [
      { name: 'Cerveza', priceCents: 5000, stock: null },
    ]);
    const customer = await createCustomer(prisma);
    const order = await app.get(OrdersService).createOrder(event.accessCode, customer.id, {
      idempotencyKey: randomUUID(),
      tickets: [{ items: [{ eventProductId: offers.Cerveza, quantity: 1 }] }],
    });
    await app.get(PaymentsService).paySimulated(order.id, customer.id, true);
    const ticket = await prisma.ticket.findFirstOrThrow({ where: { orderId: order.id } });

    // Cinco staff asignados, cada uno escaneando 10 veces a la vez.
    const staff = await Promise.all(Array.from({ length: 5 }, () => createStaff(prisma, org.id, event.id)));
    const tickets = app.get(TicketsService);
    const results = await Promise.allSettled(
      Array.from({ length: 50 }, (_, i) => tickets.redeem(event.id, ticket.token!, staff[i % 5])),
    );

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const saved = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(saved.status).toBe(TicketStatus.REDEEMED);
  });
});
