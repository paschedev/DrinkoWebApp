import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { getEventStatus } from '../../common/utils/statuses';
import { CreateOrderDto } from './dto/create-order.dto';

const RESERVATION_MS = 10 * 60 * 1000;

// Con muchas compras a la vez, las transacciones esperan su turno por la misma fila de stock.
export const TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 10_000 };

const orderInclude = {
  event: { select: { name: true, accessCode: true } },
  tickets: { include: { items: true }, orderBy: { createdAt: 'asc' } },
} satisfies Prisma.OrderInclude;

type OrderWithDetails = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

export function toOrderView(order: OrderWithDetails) {
  return {
    id: order.id,
    status: order.status,
    totalCents: order.totalCents,
    expiresAt: order.expiresAt,
    createdAt: order.createdAt,
    event: order.event,
    tickets: order.tickets.map((ticket) => ({
      id: ticket.id,
      number: ticket.number,
      status: ticket.status,
      items: ticket.items.map((item) => ({
        productName: item.productName,
        unitPriceCents: item.unitPriceCents,
        quantity: item.quantity,
      })),
    })),
  };
}

export type OrderView = ReturnType<typeof toOrderView>;

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
  ) {}

  // Crea el pedido con sus tickets PENDING y reserva el stock de todo el pedido
  // en una sola transacción: si falta stock de un producto, no se reserva nada.
  async createOrder(
    accessCode: string,
    customerId: string,
    input: CreateOrderDto,
    now = new Date(),
  ): Promise<OrderView> {
    const event = await this.events.findByAccessCode(accessCode);
    if (getEventStatus(event, now) !== 'IN_PROGRESS') {
      throw new ConflictException('El evento no está en curso');
    }

    const repeated = await this.findByIdempotencyKey(input.idempotencyKey, customerId);
    if (repeated) return repeated;

    // Un pedido vencido del mismo cliente no debe bloquear uno nuevo.
    await this.expireOrders(now, { customerId, eventId: event.id });

    // El tope de 10 es por ticket, pero el stock se valida con el total del pedido.
    const totals = new Map<string, number>();
    for (const ticket of input.tickets) {
      const seen = new Set<string>();
      for (const item of ticket.items) {
        if (seen.has(item.eventProductId)) {
          throw new BadRequestException('Un producto aparece dos veces en el mismo ticket');
        }
        seen.add(item.eventProductId);
        totals.set(item.eventProductId, (totals.get(item.eventProductId) ?? 0) + item.quantity);
      }
    }

    const offers = await this.prisma.eventProduct.findMany({
      where: { id: { in: [...totals.keys()] }, eventId: event.id },
      include: { product: true },
    });
    if (offers.length !== totals.size) {
      throw new BadRequestException('El pedido tiene productos que no son de este evento');
    }
    const offerById = new Map(offers.map((offer) => [offer.id, offer]));
    for (const offer of offers) {
      if (!offer.isAvailable || offer.product.isArchived) {
        throw new ConflictException(`${offer.product.name} no está disponible`);
      }
    }

    const expiresAt = new Date(Math.min(now.getTime() + RESERVATION_MS, event.endsAt.getTime()));

    try {
      const order = await this.prisma.$transaction(async (tx) => {
        // Se recorre en orden fijo para que dos pedidos no se bloqueen entre sí.
        for (const offer of [...offers].sort((a, b) => a.id.localeCompare(b.id))) {
          if (offer.stock === null) continue;
          const quantity = totals.get(offer.id)!;
          // UPDATE ... WHERE stock >= cantidad: si otra compra se llevó las unidades, no actualiza nada.
          const reserved = await tx.eventProduct.updateMany({
            where: { id: offer.id, stock: { gte: quantity } },
            data: { stock: { decrement: quantity } },
          });
          if (reserved.count === 0) {
            throw new ConflictException(`No hay stock suficiente de ${offer.product.name}`);
          }
        }

        let totalCents = 0;
        const tickets = input.tickets.map((ticket, index) => ({
          eventId: event.id,
          // Todos se crean en la misma transacción; el milisegundo extra conserva
          // el orden en que el cliente armó los tickets.
          createdAt: new Date(now.getTime() + index),
          items: {
            create: ticket.items.map((item) => {
              const offer = offerById.get(item.eventProductId)!;
              totalCents += offer.priceCents * item.quantity;
              return {
                eventProductId: offer.id,
                productName: offer.product.name,
                unitPriceCents: offer.priceCents,
                quantity: item.quantity,
              };
            }),
          },
        }));

        return tx.order.create({
          data: {
            eventId: event.id,
            customerId,
            totalCents,
            idempotencyKey: input.idempotencyKey,
            expiresAt,
            tickets: { create: tickets },
          },
          include: orderInclude,
        });
      }, TRANSACTION_OPTIONS);

      return toOrderView(order);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        // Dos envíos simultáneos con la misma clave: devolver el que se guardó.
        const saved = await this.findByIdempotencyKey(input.idempotencyKey, customerId);
        if (saved) return saved;
        throw new ConflictException('Ya tenés un pedido pendiente de pago en este evento');
      }
      throw error;
    }
  }

  async findForCustomer(orderId: string, customerId: string): Promise<OrderView> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: orderInclude });
    if (!order || order.customerId !== customerId) {
      throw new NotFoundException('El pedido no existe');
    }
    return toOrderView(order);
  }

  async findPendingForCustomer(accessCode: string, customerId: string, now = new Date()) {
    const order = await this.prisma.order.findFirst({
      where: {
        customerId,
        event: { accessCode },
        status: OrderStatus.PENDING_PAYMENT,
        expiresAt: { gt: now },
      },
      include: orderInclude,
    });
    return order ? toOrderView(order) : null;
  }

  // Pasa a EXPIRED los pedidos pendientes vencidos y devuelve su stock.
  // Se puede correr varias veces: cada pedido se libera una sola vez.
  async expireOrders(
    now = new Date(),
    filter: { customerId?: string; eventId?: string } = {},
  ): Promise<number> {
    const candidates = await this.prisma.order.findMany({
      where: { status: OrderStatus.PENDING_PAYMENT, expiresAt: { lte: now }, ...filter },
      select: { id: true },
    });

    let expired = 0;
    for (const { id } of candidates) {
      if (await this.expireOrder(id, now)) expired++;
    }
    if (expired > 0) this.logger.log(`${expired} pedido(s) vencido(s), stock liberado`);
    return expired;
  }

  async expireOrder(orderId: string, now = new Date()): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      // Solo cambia si sigue pendiente; si otro proceso ya lo cerró, no hace nada.
      const changed = await tx.order.updateMany({
        where: { id: orderId, status: OrderStatus.PENDING_PAYMENT, expiresAt: { lte: now } },
        data: { status: OrderStatus.EXPIRED },
      });
      if (changed.count === 0) return false;
      await this.releaseStock(tx, orderId);
      return true;
    }, TRANSACTION_OPTIONS);
  }

  // Devuelve al stock las unidades reservadas por el pedido.
  async releaseStock(tx: Prisma.TransactionClient, orderId: string) {
    const reserved = await tx.ticketItem.groupBy({
      by: ['eventProductId'],
      where: { ticket: { orderId } },
      _sum: { quantity: true },
    });
    for (const row of reserved.sort((a, b) => a.eventProductId.localeCompare(b.eventProductId))) {
      await tx.eventProduct.updateMany({
        where: { id: row.eventProductId, stock: { not: null } },
        data: { stock: { increment: row._sum.quantity ?? 0 } },
      });
    }
  }

  private async findByIdempotencyKey(idempotencyKey: string, customerId: string) {
    const order = await this.prisma.order.findUnique({ where: { idempotencyKey }, include: orderInclude });
    if (!order) return null;
    if (order.customerId !== customerId) throw new ConflictException('Clave de pedido repetida');
    return toOrderView(order);
  }
}
