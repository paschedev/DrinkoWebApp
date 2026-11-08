import { randomInt } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { getEventStatus } from '../../common/utils/statuses';
import { AuthUser } from '../auth/auth-user';
import { AddOfferDto, CreateEventDto, UpdateEventDto } from './dto/organizer-event.dto';

const ACCESS_CODE_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';
const ACCESS_CODE_LENGTH = 8;
const MAX_EVENT_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

// Código del QR de acceso: aleatorio (crypto) para que no se pueda adivinar el de otro
// evento. Sin letras ni números que se confundan (l, 1, o, 0).
function newAccessCode() {
  let code = '';
  for (let i = 0; i < ACCESS_CODE_LENGTH; i++) code += ACCESS_CODE_ALPHABET[randomInt(ACCESS_CODE_ALPHABET.length)];
  return code;
}

// Panel del Organizador: eventos de su productora. Cada consulta filtra por la
// organización del usuario, así no se puede ver ni tocar el evento de otra.
@Injectable()
export class OrganizerEventsService {
  private readonly logger = new Logger(OrganizerEventsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async list(user: AuthUser, now = new Date()) {
    const events = await this.prisma.event.findMany({
      where: { organizationId: user.organizationId! },
      orderBy: { startsAt: 'desc' },
      include: { _count: { select: { eventProducts: true, staffAssignments: true } } },
    });
    return events.map((event) => ({
      id: event.id,
      name: event.name,
      accessCode: event.accessCode,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      status: getEventStatus(event, now),
      productCount: event._count.eventProducts,
      staffCount: event._count.staffAssignments,
    }));
  }

  async detail(user: AuthUser, eventId: string, now = new Date()) {
    const event = await this.findOwnEvent(user, eventId);
    const [offers, assignments, orders] = await Promise.all([
      this.prisma.eventProduct.findMany({
        where: { eventId },
        include: { product: true },
        orderBy: { product: { name: 'asc' } },
      }),
      this.prisma.staffAssignment.findMany({ where: { eventId }, select: { userId: true } }),
      this.prisma.order.count({ where: { eventId } }),
    ]);
    return {
      id: event.id,
      name: event.name,
      accessCode: event.accessCode,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      status: getEventStatus(event, now),
      hasOrders: orders > 0,
      staffIds: assignments.map((a) => a.userId),
      products: offers.map((offer) => ({
        eventProductId: offer.id,
        productId: offer.productId,
        name: offer.product.name,
        priceCents: offer.priceCents,
        stock: offer.stock,
        isAvailable: offer.isAvailable,
      })),
    };
  }

  async create(user: AuthUser, input: CreateEventDto, now = new Date()) {
    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);
    this.validateDates(startsAt, endsAt, now);
    const staffIds = await this.validateStaff(user, input.staffIds ?? []);

    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const event = await this.prisma.event.create({
          data: {
            organizationId: user.organizationId!,
            name: input.name,
            accessCode: newAccessCode(),
            startsAt,
            endsAt,
            staffAssignments: { create: staffIds.map((userId) => ({ userId })) },
          },
        });
        return { id: event.id, accessCode: event.accessCode };
      } catch (error) {
        // Choque de código de acceso (muy improbable): se genera otro.
        if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
      }
    }
    throw new ConflictException('No se pudo generar un código de acceso. Probá de nuevo.');
  }

  // Reglas: un evento programado se edita libremente; uno en curso solo puede
  // cambiar el nombre o extender el fin; uno finalizado es de solo lectura.
  async update(user: AuthUser, eventId: string, input: UpdateEventDto, now = new Date()) {
    const event = await this.findOwnEvent(user, eventId);
    const status = getEventStatus(event, now);
    if (status === 'FINISHED') throw new ConflictException('El evento ya terminó: es de solo lectura');

    const startsAt = input.startsAt ? new Date(input.startsAt) : event.startsAt;
    const endsAt = input.endsAt ? new Date(input.endsAt) : event.endsAt;
    if (status === 'IN_PROGRESS') {
      if (startsAt.getTime() !== event.startsAt.getTime()) {
        throw new ConflictException('El evento ya empezó: no se puede cambiar el inicio');
      }
      if (endsAt < event.endsAt) {
        throw new ConflictException('El evento ya empezó: el fin solo se puede extender');
      }
    }
    this.validateDates(startsAt, endsAt, now);

    await this.prisma.event.update({ where: { id: eventId }, data: { name: input.name, startsAt, endsAt } });
    if (endsAt.getTime() !== event.endsAt.getTime()) {
      this.logger.log(`Evento ${eventId}: fin cambiado de ${event.endsAt.toISOString()} a ${endsAt.toISOString()} por ${user.id}`);
    }
    return this.detail(user, eventId, now);
  }

  // Solo se elimina un evento que nunca empezó y no tiene pedidos.
  async remove(user: AuthUser, eventId: string, now = new Date()) {
    const event = await this.findOwnEvent(user, eventId);
    if (getEventStatus(event, now) !== 'SCHEDULED') {
      throw new ConflictException('Solo se puede eliminar un evento que todavía no empezó');
    }
    const orders = await this.prisma.order.count({ where: { eventId } });
    if (orders > 0) throw new ConflictException('El evento tiene pedidos: no se puede eliminar');
    // La oferta y las asignaciones de staff se borran en cascada.
    await this.prisma.event.delete({ where: { id: eventId } });
  }

  async assignStaff(user: AuthUser, eventId: string, staffIds: string[], now = new Date()) {
    const event = await this.findOwnEvent(user, eventId);
    if (getEventStatus(event, now) === 'FINISHED') throw new ConflictException('El evento ya terminó');
    const valid = await this.validateStaff(user, staffIds);
    await this.prisma.$transaction([
      this.prisma.staffAssignment.deleteMany({ where: { eventId, userId: { notIn: valid } } }),
      this.prisma.staffAssignment.createMany({
        data: valid.map((userId) => ({ eventId, userId })),
        skipDuplicates: true,
      }),
    ]);
    return this.detail(user, eventId, now);
  }

  // Suma productos del catálogo de la productora a la oferta del evento.
  async addOffers(user: AuthUser, eventId: string, offers: AddOfferDto[], now = new Date()) {
    const event = await this.findOwnEvent(user, eventId);
    if (getEventStatus(event, now) === 'FINISHED') throw new ConflictException('El evento ya terminó');
    const ids = offers.map((o) => o.productId);
    if (new Set(ids).size !== ids.length) throw new BadRequestException('Hay productos repetidos');

    const products = await this.prisma.product.findMany({
      where: { id: { in: ids }, organizationId: user.organizationId!, isArchived: false },
    });
    if (products.length !== ids.length) {
      throw new BadRequestException('Algún producto no existe o está archivado');
    }
    try {
      await this.prisma.eventProduct.createMany({
        data: offers.map((offer) => ({
          eventId,
          productId: offer.productId,
          priceCents: offer.priceCents,
          stock: offer.stock ?? null,
        })),
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Algún producto ya está en la oferta del evento');
      }
      throw error;
    }
    return this.detail(user, eventId, now);
  }

  listStaff(user: AuthUser) {
    return this.prisma.user.findMany({
      where: { organizationId: user.organizationId!, role: UserRole.STAFF, isActive: true },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    });
  }

  private async findOwnEvent(user: AuthUser, eventId: string) {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, organizationId: user.organizationId! },
    });
    if (!event) throw new NotFoundException('El evento no existe');
    return event;
  }

  private validateDates(startsAt: Date, endsAt: Date, now: Date) {
    if (endsAt <= startsAt) throw new BadRequestException('El fin tiene que ser posterior al inicio');
    if (endsAt <= now) throw new BadRequestException('El evento no puede terminar en el pasado');
    if (endsAt.getTime() - startsAt.getTime() > MAX_EVENT_DAYS * DAY_MS) {
      throw new BadRequestException(`Un evento puede durar como máximo ${MAX_EVENT_DAYS} días`);
    }
  }

  // Solo staff activo de la misma productora.
  private async validateStaff(user: AuthUser, staffIds: string[]) {
    const unique = [...new Set(staffIds)];
    if (unique.length === 0) return [];
    const found = await this.prisma.user.count({
      where: { id: { in: unique }, organizationId: user.organizationId!, role: UserRole.STAFF, isActive: true },
    });
    if (found !== unique.length) throw new BadRequestException('Algún miembro del staff no es de tu productora');
    return unique;
  }
}
