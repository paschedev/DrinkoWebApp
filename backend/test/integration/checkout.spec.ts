import { randomUUID } from 'crypto';
import { INestApplication } from '@nestjs/common';
import { OrderStatus, PaymentStatus, TicketStatus } from '@prisma/client';
import { OrdersService } from '../../src/modules/orders/orders.service';
import { PaymentsService } from '../../src/modules/payments/payments.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { createTestApp } from '../helpers/app';
import {
  clearDatabase,
  createCustomer,
  createEventFixture,
  getStock,
  minutesFromNow,
} from '../helpers/fixtures';

describe('Compra: reserva de stock, vencimiento y pago simulado', () => {
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

  const item = (eventProductId: string, quantity: number) => ({ eventProductId, quantity });
  const order = (...tickets: { eventProductId: string; quantity: number }[][]) => ({
    idempotencyKey: randomUUID(),
    tickets: tickets.map((items) => ({ items })),
  });

  describe('reserva', () => {
    it('reserva el stock de todo el pedido y calcula el total en el servidor', async () => {
      const { event, offers } = await createEventFixture(prisma, [
        { name: 'Cerveza', priceCents: 5000, stock: 10 },
        { name: 'Gin', priceCents: 8000, stock: null },
      ]);
      const customer = await createCustomer(prisma);

      const result = await orders.createOrder(
        event.accessCode,
        customer.id,
        order([item(offers.Cerveza, 2), item(offers.Gin, 1)], [item(offers.Cerveza, 1)]),
      );

      expect(result.status).toBe(OrderStatus.PENDING_PAYMENT);
      expect(result.totalCents).toBe(3 * 5000 + 8000);
      expect(result.tickets).toHaveLength(2);
      expect(await getStock(prisma, offers.Cerveza)).toBe(7);
      expect(await getStock(prisma, offers.Gin)).toBeNull();
    });

    it('suma el mismo producto de varios tickets para validar el stock', async () => {
      const { event, offers } = await createEventFixture(prisma, [
        { name: 'Cerveza', priceCents: 5000, stock: 3 },
      ]);
      const customer = await createCustomer(prisma);

      await expect(
        orders.createOrder(
          event.accessCode,
          customer.id,
          order([item(offers.Cerveza, 2)], [item(offers.Cerveza, 2)]),
        ),
      ).rejects.toThrow(/stock/i);
      expect(await getStock(prisma, offers.Cerveza)).toBe(3);
    });

    it('no reserva nada si falta stock de un solo producto', async () => {
      const { event, offers } = await createEventFixture(prisma, [
        { name: 'Cerveza', priceCents: 5000, stock: 10 },
        { name: 'Agua', priceCents: 2000, stock: 1 },
      ]);
      const customer = await createCustomer(prisma);

      await expect(
        orders.createOrder(
          event.accessCode,
          customer.id,
          order([item(offers.Cerveza, 2)], [item(offers.Agua, 2)]),
        ),
      ).rejects.toThrow(/stock/i);
      expect(await getStock(prisma, offers.Cerveza)).toBe(10);
      expect(await getStock(prisma, offers.Agua)).toBe(1);
      expect(await prisma.order.count()).toBe(0);
    });

    it('rechaza productos de otro evento (por ejemplo, de otra productora)', async () => {
      const { event, offers } = await createEventFixture(prisma, [
        { name: 'Cerveza', priceCents: 5000, stock: 10 },
      ]);
      const other = await createEventFixture(prisma, [{ name: 'Agua', priceCents: 2000, stock: 5 }]);
      const customer = await createCustomer(prisma);

      await expect(
        orders.createOrder(
          event.accessCode,
          customer.id,
          order([item(offers.Cerveza, 1), item(other.offers.Agua, 1)]),
        ),
      ).rejects.toThrow(/no son de este evento/i);
      expect(await getStock(prisma, offers.Cerveza)).toBe(10);
      expect(await getStock(prisma, other.offers.Agua)).toBe(5);
    });

    it('rechaza productos no disponibles', async () => {
      const { event, offers } = await createEventFixture(prisma, [
        { name: 'Mojito', priceCents: 7000, stock: null, isAvailable: false },
      ]);
      const customer = await createCustomer(prisma);

      await expect(
        orders.createOrder(event.accessCode, customer.id, order([item(offers.Mojito, 1)])),
      ).rejects.toThrow(/disponible/i);
    });

    it('rechaza compras si el evento no está en curso', async () => {
      const { event, offers } = await createEventFixture(
        prisma,
        [{ name: 'Cerveza', priceCents: 5000, stock: null }],
        { startsAt: minutesFromNow(60), endsAt: minutesFromNow(300) },
      );
      const customer = await createCustomer(prisma);

      await expect(
        orders.createOrder(event.accessCode, customer.id, order([item(offers.Cerveza, 1)])),
      ).rejects.toThrow(/en curso/i);
    });

    it('la reserva vence a los 10 minutos o al fin del evento, lo que ocurra antes', async () => {
      const { event, offers } = await createEventFixture(
        prisma,
        [{ name: 'Cerveza', priceCents: 5000, stock: null }],
        { endsAt: minutesFromNow(3) },
      );
      const customer = await createCustomer(prisma);

      const result = await orders.createOrder(
        event.accessCode,
        customer.id,
        order([item(offers.Cerveza, 1)]),
      );

      expect(new Date(result.expiresAt).getTime()).toBe(event.endsAt.getTime());
    });

    it('repetir el pedido con la misma clave no reserva dos veces', async () => {
      const { event, offers } = await createEventFixture(prisma, [
        { name: 'Cerveza', priceCents: 5000, stock: 10 },
      ]);
      const customer = await createCustomer(prisma);
      const input = order([item(offers.Cerveza, 2)]);

      const first = await orders.createOrder(event.accessCode, customer.id, input);
      const second = await orders.createOrder(event.accessCode, customer.id, input);

      expect(second.id).toBe(first.id);
      expect(await getStock(prisma, offers.Cerveza)).toBe(8);
    });

    it('un cliente no puede tener dos pedidos pendientes en el mismo evento', async () => {
      const { event, offers } = await createEventFixture(prisma, [
        { name: 'Cerveza', priceCents: 5000, stock: 10 },
      ]);
      const customer = await createCustomer(prisma);

      await orders.createOrder(event.accessCode, customer.id, order([item(offers.Cerveza, 1)]));
      await expect(
        orders.createOrder(event.accessCode, customer.id, order([item(offers.Cerveza, 1)])),
      ).rejects.toThrow(/pendiente/i);
      expect(await getStock(prisma, offers.Cerveza)).toBe(9);
    });
  });

  describe('vencimiento de la reserva', () => {
    it('libera el stock una sola vez aunque el proceso corra varias veces', async () => {
      const { event, offers } = await createEventFixture(prisma, [
        { name: 'Cerveza', priceCents: 5000, stock: 10 },
      ]);
      const customer = await createCustomer(prisma);
      const created = await orders.createOrder(
        event.accessCode,
        customer.id,
        order([item(offers.Cerveza, 2)], [item(offers.Cerveza, 1)]),
      );
      expect(await getStock(prisma, offers.Cerveza)).toBe(7);

      const later = minutesFromNow(11);
      expect(await orders.expireOrders(later)).toBe(1);
      expect(await orders.expireOrders(later)).toBe(0);

      const saved = await prisma.order.findUniqueOrThrow({ where: { id: created.id } });
      expect(saved.status).toBe(OrderStatus.EXPIRED);
      expect(await getStock(prisma, offers.Cerveza)).toBe(10);
    });

    it('no toca pedidos que todavía no vencieron', async () => {
      const { event, offers } = await createEventFixture(prisma, [
        { name: 'Cerveza', priceCents: 5000, stock: 10 },
      ]);
      const customer = await createCustomer(prisma);
      await orders.createOrder(event.accessCode, customer.id, order([item(offers.Cerveza, 2)]));

      expect(await orders.expireOrders(minutesFromNow(5))).toBe(0);
      expect(await getStock(prisma, offers.Cerveza)).toBe(8);
    });
  });

  describe('cancelar el pedido pendiente', () => {
    it('libera el stock una sola vez y permite armar un pedido nuevo', async () => {
      const { event, offers } = await createEventFixture(prisma, [
        { name: 'Cerveza', priceCents: 5000, stock: 10 },
      ]);
      const customer = await createCustomer(prisma);
      const created = await orders.createOrder(event.accessCode, customer.id, order([item(offers.Cerveza, 3)]));

      const cancelled = await orders.cancelOrder(created.id, customer.id);
      await orders.cancelOrder(created.id, customer.id);

      expect(cancelled.status).toBe(OrderStatus.EXPIRED);
      expect(await getStock(prisma, offers.Cerveza)).toBe(10);
      // El pedido pendiente ya no bloquea uno nuevo en el mismo evento.
      await orders.createOrder(event.accessCode, customer.id, order([item(offers.Cerveza, 1)]));
      expect(await getStock(prisma, offers.Cerveza)).toBe(9);
    });

    it('un pedido pagado no se puede cancelar', async () => {
      const { event, offers } = await createEventFixture(prisma, [
        { name: 'Cerveza', priceCents: 5000, stock: 10 },
      ]);
      const customer = await createCustomer(prisma);
      const created = await orders.createOrder(event.accessCode, customer.id, order([item(offers.Cerveza, 2)]));
      await payments.paySimulated(created.id, customer.id, true);

      await expect(orders.cancelOrder(created.id, customer.id)).rejects.toThrow(/pagado/i);
      expect(await getStock(prisma, offers.Cerveza)).toBe(8);
    });

    it('solo el dueño puede cancelar su pedido', async () => {
      const { event, offers } = await createEventFixture(prisma, [
        { name: 'Cerveza', priceCents: 5000, stock: 10 },
      ]);
      const owner = await createCustomer(prisma);
      const other = await createCustomer(prisma);
      const created = await orders.createOrder(event.accessCode, owner.id, order([item(offers.Cerveza, 2)]));

      await expect(orders.cancelOrder(created.id, other.id)).rejects.toThrow(/no existe/i);
      expect(await getStock(prisma, offers.Cerveza)).toBe(8);
    });
  });

  describe('pago simulado', () => {
    it('al aprobar, marca pago y pedido y activa los tickets con número y token', async () => {
      const { event, offers } = await createEventFixture(prisma, [
        { name: 'Cerveza', priceCents: 5000, stock: 10 },
        { name: 'Agua', priceCents: 2000, stock: 10 },
      ]);
      const customer = await createCustomer(prisma);
      const created = await orders.createOrder(
        event.accessCode,
        customer.id,
        order([item(offers.Cerveza, 2)], [item(offers.Agua, 1)]),
      );

      const paid = await payments.paySimulated(created.id, customer.id, true);

      expect(paid.status).toBe(OrderStatus.PAID);
      const payment = await prisma.payment.findFirstOrThrow({ where: { orderId: created.id } });
      expect(payment.status).toBe(PaymentStatus.APPROVED);
      expect(payment.amountCents).toBe(12000);

      const tickets = await prisma.ticket.findMany({
        where: { orderId: created.id },
        orderBy: { number: 'asc' },
      });
      expect(tickets.map((t) => t.status)).toEqual([TicketStatus.ACTIVE, TicketStatus.ACTIVE]);
      expect(tickets.map((t) => t.number)).toEqual([1, 2]);
      // Los números respetan el orden en que el cliente armó los tickets.
      expect(paid.tickets.map((t) => t.items[0].productName)).toEqual(['Cerveza', 'Agua']);
      expect(paid.tickets.map((t) => t.number)).toEqual([1, 2]);
      expect(tickets.every((t) => t.token && t.token.length >= 22)).toBe(true);
      expect(await getStock(prisma, offers.Cerveza)).toBe(8);
    });

    it('al rechazar, libera el stock y los tickets no se activan', async () => {
      const { event, offers } = await createEventFixture(prisma, [
        { name: 'Cerveza', priceCents: 5000, stock: 10 },
      ]);
      const customer = await createCustomer(prisma);
      const created = await orders.createOrder(
        event.accessCode,
        customer.id,
        order([item(offers.Cerveza, 3)]),
      );

      const result = await payments.paySimulated(created.id, customer.id, false);

      expect(result.status).toBe(OrderStatus.REJECTED);
      expect(await getStock(prisma, offers.Cerveza)).toBe(10);
      const ticket = await prisma.ticket.findFirstOrThrow({ where: { orderId: created.id } });
      expect(ticket.status).toBe(TicketStatus.PENDING);
      expect(ticket.token).toBeNull();
    });

    it('rechaza una aprobación tardía y libera la reserva', async () => {
      const { event, offers } = await createEventFixture(prisma, [
        { name: 'Cerveza', priceCents: 5000, stock: 10 },
      ]);
      const customer = await createCustomer(prisma);
      const created = await orders.createOrder(
        event.accessCode,
        customer.id,
        order([item(offers.Cerveza, 2)]),
      );

      await expect(
        payments.paySimulated(created.id, customer.id, true, minutesFromNow(11)),
      ).rejects.toThrow(/venci/i);

      const saved = await prisma.order.findUniqueOrThrow({ where: { id: created.id } });
      expect(saved.status).toBe(OrderStatus.EXPIRED);
      expect(await prisma.payment.count({ where: { status: PaymentStatus.APPROVED } })).toBe(0);
      expect(await getStock(prisma, offers.Cerveza)).toBe(10);
    });

    it('un pedido pagado no se puede volver a cobrar', async () => {
      const { event, offers } = await createEventFixture(prisma, [
        { name: 'Cerveza', priceCents: 5000, stock: null },
      ]);
      const customer = await createCustomer(prisma);
      const created = await orders.createOrder(
        event.accessCode,
        customer.id,
        order([item(offers.Cerveza, 1)]),
      );

      await payments.paySimulated(created.id, customer.id, true);
      await expect(payments.paySimulated(created.id, customer.id, true)).rejects.toThrow(
        /pendiente/i,
      );
      expect(await prisma.payment.count()).toBe(1);
    });

    it('un cliente no puede pagar el pedido de otro', async () => {
      const { event, offers } = await createEventFixture(prisma, [
        { name: 'Cerveza', priceCents: 5000, stock: null },
      ]);
      const owner = await createCustomer(prisma);
      const other = await createCustomer(prisma);
      const created = await orders.createOrder(
        event.accessCode,
        owner.id,
        order([item(offers.Cerveza, 1)]),
      );

      await expect(payments.paySimulated(created.id, other.id, true)).rejects.toThrow(
        /no existe/i,
      );
    });
  });
});
