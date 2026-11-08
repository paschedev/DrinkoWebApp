import { randomUUID } from 'crypto';
import { INestApplication } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import * as argon2 from 'argon2';
import request from 'supertest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { createTestApp } from '../helpers/app';
import { clearDatabase, createEventFixture, createStaff, minutesFromNow } from '../helpers/fixtures';

const PASSWORD = 'clave-de-prueba-123';

// Panel del Organizador: eventos y productos, y que cada productora solo toque lo suyo.
describe('API del organizador', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let passwordHash: string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    passwordHash = await argon2.hash(PASSWORD);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await clearDatabase(prisma);
  });

  async function userCookie(organizationId: string, role: UserRole) {
    const email = `${randomUUID()}@drinko.test`;
    await prisma.user.create({ data: { organizationId, email, name: 'Usuario', role, passwordHash } });
    const res = await request(app.getHttpServer()).post('/api/auth/login').send({ email, password: PASSWORD });
    return res.headers['set-cookie'];
  }

  // Una productora con su catálogo, su organizador y un staff.
  async function organization() {
    const { org, event, offers } = await createEventFixture(prisma, [
      { name: 'Cerveza', priceCents: 5000, stock: 10 },
    ]);
    const category = await prisma.category.create({ data: { organizationId: org.id, name: 'Tragos' } });
    const cookie = await userCookie(org.id, UserRole.ORGANIZER);
    const staff = await createStaff(prisma, org.id);
    return { org, event, offers, category, cookie, staff };
  }

  const http = () => request(app.getHttpServer());

  describe('productos', () => {
    it('crea, edita, archiva y lista productos de su productora', async () => {
      const { category, cookie } = await organization();

      const created = await http()
        .post('/api/organizer/products')
        .set('Cookie', cookie)
        .send({ name: '  Gin tonic  ', categoryId: category.id, requiresPreparation: true })
        .expect(201);
      await http()
        .patch(`/api/organizer/products/${created.body.id}`)
        .set('Cookie', cookie)
        .send({ imageUrl: 'https://example.com/gin.png', isArchived: true })
        .expect(200);

      const list = await http().get('/api/organizer/products').set('Cookie', cookie).expect(200);
      const gin = list.body.find((p: { name: string }) => p.name === 'Gin tonic');
      expect(gin).toMatchObject({ requiresPreparation: true, isArchived: true, category: { name: 'Tragos' } });
    });

    it('no permite nombres repetidos ni categorías de otra productora', async () => {
      const mine = await organization();
      const other = await organization();

      await http().post('/api/organizer/products').set('Cookie', mine.cookie).send({ name: 'Cerveza' }).expect(409);
      await http()
        .post('/api/organizer/products')
        .set('Cookie', mine.cookie)
        .send({ name: 'Fernet', categoryId: other.category.id })
        .expect(400);
    });

    it('un producto ya ofrecido en un evento se archiva, no se borra', async () => {
      const { cookie, offers } = await organization();
      const offer = await prisma.eventProduct.findUniqueOrThrow({ where: { id: offers.Cerveza } });

      const res = await http().delete(`/api/organizer/products/${offer.productId}`).set('Cookie', cookie).expect(409);
      expect(res.body.message).toMatch(/archivalo/i);

      const fresh = await http().post('/api/organizer/products').set('Cookie', cookie).send({ name: 'Agua' }).expect(201);
      await http().delete(`/api/organizer/products/${fresh.body.id}`).set('Cookie', cookie).expect(204);
    });
  });

  describe('eventos', () => {
    it('crea un evento con staff y productos, y queda a la venta con su código de acceso', async () => {
      const { cookie, staff, org } = await organization();
      const product = await prisma.product.create({ data: { organizationId: org.id, name: 'Mojito' } });

      const created = await http()
        .post('/api/organizer/events')
        .set('Cookie', cookie)
        .send({
          name: 'Fiesta de prueba',
          startsAt: minutesFromNow(-10).toISOString(),
          endsAt: minutesFromNow(240).toISOString(),
          staffIds: [staff.id],
        })
        .expect(201);
      expect(created.body.accessCode).toMatch(/^[a-z2-9]{8}$/);

      await http()
        .post(`/api/organizer/events/${created.body.id}/products`)
        .set('Cookie', cookie)
        .send({ products: [{ productId: product.id, priceCents: 7500, stock: 20 }] })
        .expect(201);

      const detail = await http().get(`/api/organizer/events/${created.body.id}`).set('Cookie', cookie).expect(200);
      expect(detail.body).toMatchObject({ status: 'IN_PROGRESS', staffIds: [staff.id] });
      expect(detail.body.products).toEqual([expect.objectContaining({ name: 'Mojito', priceCents: 7500, stock: 20 })]);

      // El cliente ya lo ve con el código generado.
      const catalog = await http().get(`/api/events/${created.body.accessCode}`).expect(200);
      expect(catalog.body.categories[0].products[0]).toMatchObject({ name: 'Mojito', priceCents: 7500 });
    });

    it('valida las fechas', async () => {
      const { cookie } = await organization();
      const send = (startsAt: Date, endsAt: Date) =>
        http()
          .post('/api/organizer/events')
          .set('Cookie', cookie)
          .send({ name: 'Mal', startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() });

      await send(minutesFromNow(120), minutesFromNow(60)).expect(400);
      await send(minutesFromNow(-300), minutesFromNow(-60)).expect(400);
      await send(minutesFromNow(60), minutesFromNow(60 * 24 * 10)).expect(400);
    });

    it('un evento programado se edita y se elimina; uno en curso solo extiende el fin', async () => {
      const { cookie, event } = await organization();
      const scheduled = await http()
        .post('/api/organizer/events')
        .set('Cookie', cookie)
        .send({ name: 'Mañana', startsAt: minutesFromNow(600).toISOString(), endsAt: minutesFromNow(900).toISOString() })
        .expect(201);

      await http()
        .patch(`/api/organizer/events/${scheduled.body.id}`)
        .set('Cookie', cookie)
        .send({ name: 'Mañana a la noche' })
        .expect(200);
      await http().delete(`/api/organizer/events/${scheduled.body.id}`).set('Cookie', cookie).expect(204);

      // El evento del fixture está en curso.
      await http()
        .patch(`/api/organizer/events/${event.id}`)
        .set('Cookie', cookie)
        .send({ endsAt: minutesFromNow(10).toISOString() })
        .expect(409);
      await http()
        .patch(`/api/organizer/events/${event.id}`)
        .set('Cookie', cookie)
        .send({ endsAt: minutesFromNow(600).toISOString() })
        .expect(200);
      await http().delete(`/api/organizer/events/${event.id}`).set('Cookie', cookie).expect(409);
    });
  });

  describe('permisos y acceso cruzado', () => {
    it('el staff no puede usar el panel del organizador', async () => {
      const { org } = await organization();
      const staffCookie = await userCookie(org.id, UserRole.STAFF);

      await http().get('/api/organizer/events').set('Cookie', staffCookie).expect(403);
      await http().post('/api/organizer/products').set('Cookie', staffCookie).send({ name: 'X' }).expect(403);
      await http().get('/api/organizer/events').expect(401);
    });

    it('otra productora recibe 404 en eventos y productos ajenos', async () => {
      const mine = await organization();
      const other = await organization();
      const otherProduct = await prisma.eventProduct.findUniqueOrThrow({ where: { id: other.offers.Cerveza } });
      const server = app.getHttpServer();

      await request(server).get(`/api/organizer/events/${other.event.id}`).set('Cookie', mine.cookie).expect(404);
      await request(server)
        .patch(`/api/organizer/events/${other.event.id}`)
        .set('Cookie', mine.cookie)
        .send({ name: 'Robado' })
        .expect(404);
      await request(server).delete(`/api/organizer/events/${other.event.id}`).set('Cookie', mine.cookie).expect(404);
      await request(server)
        .patch(`/api/organizer/products/${otherProduct.productId}`)
        .set('Cookie', mine.cookie)
        .send({ name: 'Robado' })
        .expect(404);

      // Tampoco puede sumar a su evento un producto ni un staff de otra productora.
      await request(server)
        .post(`/api/organizer/events/${mine.event.id}/products`)
        .set('Cookie', mine.cookie)
        .send({ products: [{ productId: otherProduct.productId, priceCents: 100 }] })
        .expect(400);
      await request(server)
        .put(`/api/organizer/events/${mine.event.id}/staff`)
        .set('Cookie', mine.cookie)
        .send({ staffIds: [other.staff.id] })
        .expect(400);

      const list = await request(server).get('/api/organizer/events').set('Cookie', mine.cookie).expect(200);
      expect(list.body.map((e: { id: string }) => e.id)).toEqual([mine.event.id]);
      const event = await prisma.event.findUniqueOrThrow({ where: { id: other.event.id } });
      expect(event.name).toBe('Evento Test');
    });
  });
});
