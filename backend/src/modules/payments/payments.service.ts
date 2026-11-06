import { randomBytes, randomUUID } from 'crypto';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, PaymentStatus, TicketStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { OrdersService, OrderView, TRANSACTION_OPTIONS } from '../orders/orders.service';

const SIMULATED_PROVIDER = 'SIMULATED';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
  ) {}

  // Resuelve el pago simulado en una sola transacción: pago, pedido y tickets
  // cambian juntos o no cambia nada.
  async paySimulated(
    orderId: string,
    customerId: string,
    approved: boolean,
    now = new Date(),
  ): Promise<OrderView> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.customerId !== customerId) {
      throw new NotFoundException('El pedido no existe');
    }
    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      throw new ConflictException('El pedido ya no está pendiente de pago');
    }
    // Aprobación tardía: la reserva ya venció y esas unidades pueden haberse vendido.
    if (order.expiresAt <= now) {
      await this.orders.expireOrder(orderId, now);
      throw new ConflictException('La reserva venció. Volvé a armar el pedido.');
    }

    await this.prisma.$transaction(async (tx) => {
      // Cierra el pedido solo si sigue pendiente y vigente; protege contra pagos repetidos
      // y contra el proceso de vencimiento corriendo al mismo tiempo.
      const closed = await tx.order.updateMany({
        where: { id: orderId, status: OrderStatus.PENDING_PAYMENT, expiresAt: { gt: now } },
        data: { status: approved ? OrderStatus.PAID : OrderStatus.REJECTED },
      });
      if (closed.count === 0) {
        throw new ConflictException('El pedido ya no está pendiente de pago');
      }

      // El importe sale de los precios guardados en los ítems, no de lo que mande el frontend.
      const items = await tx.ticketItem.findMany({ where: { ticket: { orderId } } });
      const amountCents = items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);
      if (amountCents !== order.totalCents) {
        throw new Error(`El total del pedido ${orderId} no coincide con sus ítems`);
      }

      await tx.payment.create({
        data: {
          orderId,
          status: approved ? PaymentStatus.APPROVED : PaymentStatus.REJECTED,
          provider: SIMULATED_PROVIDER,
          externalReference: `SIM-${randomUUID()}`,
          amountCents,
          resolvedAt: now,
        },
      });

      if (!approved) {
        await this.orders.releaseStock(tx, orderId);
        return;
      }

      // Reserva un bloque de números con un solo UPDATE sobre el evento, así dos pagos
      // simultáneos nunca reciben el mismo número.
      const tickets = await tx.ticket.findMany({ where: { orderId }, orderBy: { createdAt: 'asc' } });
      const event = await tx.event.update({
        where: { id: order.eventId },
        data: { lastTicketNumber: { increment: tickets.length } },
      });
      let number = event.lastTicketNumber - tickets.length;

      for (const ticket of tickets) {
        number++;
        await tx.ticket.update({
          where: { id: ticket.id },
          data: {
            status: TicketStatus.ACTIVE,
            number,
            // 128 bits aleatorios: el contenido del QR de retiro no se puede adivinar.
            token: randomBytes(16).toString('base64url'),
          },
        });
      }
    }, TRANSACTION_OPTIONS);

    return this.orders.findForCustomer(orderId, customerId);
  }
}
