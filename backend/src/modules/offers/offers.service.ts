import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TicketStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { REDEEM_WINDOW_MS } from '../../common/utils/statuses';
import { AuthUser } from '../auth/auth-user';
import { EventAccessService } from '../auth/event-access.service';
import { UpdateOfferDto } from './dto/update-offer.dto';

type Change = { field: 'price_cents' | 'stock' | 'is_available'; oldValue: string; newValue: string };

// Oferta del evento para la barra: precio, stock y disponibilidad, y la demanda pendiente.
@Injectable()
export class OffersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventAccess: EventAccessService,
  ) {}

  async listForEvent(eventId: string, user: AuthUser) {
    await this.eventAccess.getOperableEvent(user, eventId);
    const offers = await this.prisma.eventProduct.findMany({
      where: { eventId },
      include: { product: true },
      orderBy: { product: { name: 'asc' } },
    });
    return offers.map((offer) => ({
      eventProductId: offer.id,
      name: offer.product.name,
      priceCents: offer.priceCents,
      stock: offer.stock,
      isAvailable: offer.isAvailable,
    }));
  }

  // Aplica los cambios y deja un registro por cada campo modificado (tabla change_logs).
  async update(eventId: string, eventProductId: string, user: AuthUser, input: UpdateOfferDto) {
    await this.eventAccess.getOperableEvent(user, eventId);
    const offer = await this.prisma.eventProduct.findFirst({ where: { id: eventProductId, eventId } });
    if (!offer) throw new NotFoundException('El producto no es de este evento');
    if (input.stockDelta !== undefined && offer.stock === null) {
      throw new BadRequestException('Este producto no tiene control de stock');
    }

    await this.prisma.$transaction(async (tx) => {
      const changes: Change[] = [];

      if (input.stockDelta !== undefined) {
        const delta = input.stockDelta;
        // Mismo criterio que la reserva: un UPDATE que no deja el stock negativo,
        // aunque haya compras en curso.
        const adjusted = await tx.eventProduct.updateMany({
          where: { id: offer.id, stock: { gte: Math.max(0, -delta) } },
          data: { stock: { increment: delta } },
        });
        if (adjusted.count === 0) throw new ConflictException('El stock no puede quedar negativo');
        const { stock } = await tx.eventProduct.findUniqueOrThrow({ where: { id: offer.id } });
        changes.push({ field: 'stock', oldValue: String(stock! - delta), newValue: String(stock) });
      }
      if (input.priceCents !== undefined && input.priceCents !== offer.priceCents) {
        changes.push({
          field: 'price_cents',
          oldValue: String(offer.priceCents),
          newValue: String(input.priceCents),
        });
      }
      if (input.isAvailable !== undefined && input.isAvailable !== offer.isAvailable) {
        changes.push({
          field: 'is_available',
          oldValue: String(offer.isAvailable),
          newValue: String(input.isAvailable),
        });
      }

      await tx.eventProduct.update({
        where: { id: offer.id },
        data: { priceCents: input.priceCents, isAvailable: input.isAvailable, updatedAt: new Date() },
      });
      await tx.changeLog.createMany({
        data: changes.map((change) => ({ ...change, eventProductId: offer.id, userId: user.id })),
      });
    });

    const offers = await this.listForEvent(eventId, user);
    return offers.find((o) => o.eventProductId === offer.id);
  }

  // Unidades vendidas que todavía no se retiraron, por producto ("Gin tonic: 34 por entregar").
  async getPendingDemand(eventId: string, user: AuthUser, now = new Date()) {
    const event = await this.eventAccess.getOperableEvent(user, eventId);
    if (event.endsAt.getTime() + REDEEM_WINDOW_MS < now.getTime()) return [];

    const rows = await this.prisma.ticketItem.groupBy({
      by: ['productName'],
      where: { ticket: { eventId, status: TicketStatus.ACTIVE } },
      _sum: { quantity: true },
    });
    return rows
      .map((row) => ({ productName: row.productName, quantity: row._sum.quantity ?? 0 }))
      .sort((a, b) => b.quantity - a.quantity || a.productName.localeCompare(b.productName));
  }
}
