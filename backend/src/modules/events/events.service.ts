import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { getEventStatus } from '../../common/utils/statuses';

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  async findByAccessCode(accessCode: string) {
    const event = await this.prisma.event.findUnique({ where: { accessCode } });
    if (!event) throw new NotFoundException('Este evento no existe');
    return event;
  }

  // Catálogo del evento agrupado por categoría. Solo se muestra mientras el evento está en curso.
  async getCatalog(accessCode: string, now = new Date()) {
    const event = await this.findByAccessCode(accessCode);
    const status = getEventStatus(event, now);
    const summary = { name: event.name, status, startsAt: event.startsAt, endsAt: event.endsAt };
    if (status !== 'IN_PROGRESS') return { ...summary, categories: [] };

    const offers = await this.prisma.eventProduct.findMany({
      where: { eventId: event.id, isAvailable: true, product: { isArchived: false } },
      include: { product: { include: { category: true } } },
    });

    const categories = new Map<string, { name: string; sortOrder: number; products: unknown[] }>();
    const sorted = offers.sort((a, b) => a.product.name.localeCompare(b.product.name));
    for (const offer of sorted) {
      const category = offer.product.category;
      const key = category?.id ?? 'none';
      if (!categories.has(key)) {
        categories.set(key, {
          name: category?.name ?? 'Otros',
          sortOrder: category?.sortOrder ?? Number.MAX_SAFE_INTEGER,
          products: [],
        });
      }
      categories.get(key)!.products.push({
        eventProductId: offer.id,
        name: offer.product.name,
        description: offer.product.description,
        imageUrl: offer.product.imageUrl,
        priceCents: offer.priceCents,
        stock: offer.stock,
        soldOut: offer.stock === 0,
      });
    }

    return {
      ...summary,
      categories: [...categories.values()]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(({ name, products }) => ({ name, products })),
    };
  }
}
