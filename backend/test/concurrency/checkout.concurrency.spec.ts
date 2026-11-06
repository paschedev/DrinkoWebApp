import { randomUUID } from 'crypto';
import { INestApplication } from '@nestjs/common';
import { OrdersService } from '../../src/modules/orders/orders.service';
import { PaymentsService } from '../../src/modules/payments/payments.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { createTestApp } from '../helpers/app';
import { clearDatabase, createCustomer, createEventFixture, getStock } from '../helpers/fixtures';

describe('Concurrencia en la compra', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let orders: OrdersService;
  let payments: PaymentsService;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    orders = app.get(OrdersService);
    payments = app.get(PaymentsService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await clearDatabase(prisma);
  });

  it('30 compras simultáneas con stock 10: exactamente 10 se concretan', async () => {
    const { event, offers } = await createEventFixture(prisma, [
      { name: 'Cerveza', priceCents: 5000, stock: 10 },
    ]);
    const customers = await Promise.all(Array.from({ length: 30 }, () => createCustomer(prisma)));

    const results = await Promise.allSettled(
      customers.map((c) =>
        orders.createOrder(event.accessCode, c.id, {
          idempotencyKey: randomUUID(),
          tickets: [{ items: [{ eventProductId: offers.Cerveza, quantity: 1 }] }],
        }),
      ),
    );

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(10);
    expect(await getStock(prisma, offers.Cerveza)).toBe(0);
    expect(await prisma.order.count()).toBe(10);
  });

  it('pagos simultáneos no repiten números de ticket', async () => {
    const { event, offers } = await createEventFixture(prisma, [
      { name: 'Cerveza', priceCents: 5000, stock: null },
    ]);
    const customers = await Promise.all(Array.from({ length: 15 }, () => createCustomer(prisma)));
    const created = await Promise.all(
      customers.map((c) =>
        orders.createOrder(event.accessCode, c.id, {
          idempotencyKey: randomUUID(),
          tickets: [
            { items: [{ eventProductId: offers.Cerveza, quantity: 1 }] },
            { items: [{ eventProductId: offers.Cerveza, quantity: 2 }] },
          ],
        }),
      ),
    );

    await Promise.all(created.map((o, i) => payments.paySimulated(o.id, customers[i].id, true)));

    const numbers = (await prisma.ticket.findMany({ select: { number: true } }))
      .map((t) => t.number)
      .sort((a, b) => a! - b!);
    expect(numbers).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
  });
});
