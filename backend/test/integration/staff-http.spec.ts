import { randomUUID } from 'crypto';
import { INestApplication } from '@nestjs/common';
import * as argon2 from 'argon2';
import request from 'supertest';
import { OrdersService } from '../../src/modules/orders/orders.service';
import { PaymentsService } from '../../src/modules/payments/payments.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { createTestApp } from '../helpers/app';
import {
  clearDatabase,
  createCustomer,
  createEventFixture,
  createStaff,
  getStock,
} from '../helpers/fixtures';

const PASSWORD = 'clave-de-prueba-123';

// Login del staff y operaciones de la barra a través de la API.
describe('API de staff', () => {
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

  async function scenario() {
    const fixture = await createEventFixture(prisma, [
      { name: 'Cerveza', priceCents: 5000, stock: 10 },
      { name: 'Gin', priceCents: 8000, stock: null },
    ]);
    const staff = await createStaff(prisma, fixture.org.id, fixture.event.id);
    await prisma.user.update({
      where: { id: staff.id },
      data: { passwordHash: await argon2.hash(PASSWORD) },
    });
    return { ...fixture, staff };
  }

  function login(email: string, password = PASSWORD) {
    return request(app.getHttpServer()).post('/api/auth/login').send({ email, password });
  }

  describe('login', () => {
    it('con email y contraseña correctos crea la sesión en una cookie httpOnly', async () => {
      const { staff } = await scenario();

      const res = await login(staff.email).expect(200);
      expect(res.body).toMatchObject({ email: staff.email, role: 'STAFF' });
      expect(String(res.headers['set-cookie'])).toMatch(/drinko_session=.+HttpOnly/i);

      const me = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Cookie', res.headers['set-cookie'])
        .expect(200);
      expect(me.body.email).toBe(staff.email);
      // En la base se guarda el hash del token, nunca el token.
      expect(await prisma.session.count({ where: { userId: staff.id } })).toBe(1);
    });

    it('contraseña incorrecta y email inexistente dan el mismo error', async () => {
      const { staff } = await scenario();

      const wrong = await login(staff.email, 'otra-clave').expect(401);
      const unknown = await login('nadie@drinko.test').expect(401);
      expect(wrong.body.message).toBe(unknown.body.message);
    });

    it('un usuario desactivado no puede entrar', async () => {
      const { staff } = await scenario();
      await prisma.user.update({ where: { id: staff.id }, data: { isActive: false } });

      await login(staff.email).expect(401);
    });

    it('cerrar sesión invalida la cookie', async () => {
      const { staff } = await scenario();
      const cookie = (await login(staff.email)).headers['set-cookie'];

      await request(app.getHttpServer()).post('/api/auth/logout').set('Cookie', cookie).expect(204);
      await request(app.getHttpServer()).get('/api/auth/me').set('Cookie', cookie).expect(401);
    });

    it('las rutas de la barra exigen sesión', async () => {
      await request(app.getHttpServer()).get('/api/staff/events').expect(401);
    });
  });

  describe('barra', () => {
    it('lista solo los eventos asignados al staff', async () => {
      const { event, staff } = await scenario();
      await createEventFixture(prisma, [{ name: 'Agua', priceCents: 2000, stock: null }]);
      const cookie = (await login(staff.email)).headers['set-cookie'];

      const res = await request(app.getHttpServer())
        .get('/api/staff/events')
        .set('Cookie', cookie)
        .expect(200);
      expect(res.body.map((e: { id: string }) => e.id)).toEqual([event.id]);
    });

    it('escanea un ticket por HTTP y la demanda pendiente baja', async () => {
      const { event, offers, staff } = await scenario();
      const customer = await createCustomer(prisma);
      const order = await app.get(OrdersService).createOrder(event.accessCode, customer.id, {
        idempotencyKey: randomUUID(),
        tickets: [{ items: [{ eventProductId: offers.Gin, quantity: 3 }] }],
      });
      await app.get(PaymentsService).paySimulated(order.id, customer.id, true);
      const ticket = await prisma.ticket.findFirstOrThrow({ where: { orderId: order.id } });
      const cookie = (await login(staff.email)).headers['set-cookie'];
      const server = app.getHttpServer();

      const before = await request(server).get(`/api/staff/events/${event.id}/demand`).set('Cookie', cookie).expect(200);
      expect(before.body).toEqual([{ productName: 'Gin', quantity: 3 }]);

      const redeemed = await request(server)
        .post(`/api/staff/events/${event.id}/redemptions`)
        .set('Cookie', cookie)
        .send({ token: ticket.token })
        .expect(201);
      expect(redeemed.body.items[0]).toMatchObject({ productName: 'Gin', quantity: 3 });

      const again = await request(server)
        .post(`/api/staff/events/${event.id}/redemptions`)
        .set('Cookie', cookie)
        .send({ token: ticket.token })
        .expect(409);
      expect(again.body.message).toMatch(/ya fue retirado/i);

      const after = await request(server).get(`/api/staff/events/${event.id}/demand`).set('Cookie', cookie).expect(200);
      expect(after.body).toEqual([]);
    });

    it('cambia precio y disponibilidad, ajusta stock y deja registro de cada cambio', async () => {
      const { event, offers, staff } = await scenario();
      const cookie = (await login(staff.email)).headers['set-cookie'];
      const url = `/api/staff/events/${event.id}/products/${offers.Cerveza}`;

      await request(app.getHttpServer())
        .patch(url)
        .set('Cookie', cookie)
        .send({ priceCents: 6000, isAvailable: false, stockDelta: 5 })
        .expect(200);

      const offer = await prisma.eventProduct.findUniqueOrThrow({ where: { id: offers.Cerveza } });
      expect(offer).toMatchObject({ priceCents: 6000, isAvailable: false, stock: 15 });
      const logs = await prisma.changeLog.findMany({ where: { eventProductId: offers.Cerveza } });
      expect(logs.map((l) => [l.field, l.oldValue, l.newValue]).sort()).toEqual([
        ['is_available', 'true', 'false'],
        ['price_cents', '5000', '6000'],
        ['stock', '10', '15'],
      ]);
    });

    it('el stock se ajusta sumando o restando, sin quedar negativo', async () => {
      const { event, offers, staff } = await scenario();
      const cookie = (await login(staff.email)).headers['set-cookie'];
      const url = `/api/staff/events/${event.id}/products/${offers.Cerveza}`;

      await request(app.getHttpServer()).patch(url).set('Cookie', cookie).send({ stockDelta: -11 }).expect(409);
      expect(await getStock(prisma, offers.Cerveza)).toBe(10);

      await request(app.getHttpServer()).patch(url).set('Cookie', cookie).send({ stockDelta: -4 }).expect(200);
      expect(await getStock(prisma, offers.Cerveza)).toBe(6);
    });

    it('no se puede editar desde un evento un producto de otro evento', async () => {
      const { event, staff } = await scenario();
      const other = await createEventFixture(prisma, [{ name: 'Agua', priceCents: 2000, stock: null }]);
      const cookie = (await login(staff.email)).headers['set-cookie'];

      // El staff opera su evento, pero el producto pertenece a otra productora.
      await request(app.getHttpServer())
        .patch(`/api/staff/events/${event.id}/products/${other.offers.Agua}`)
        .set('Cookie', cookie)
        .send({ priceCents: 1 })
        .expect(404);
      const offer = await prisma.eventProduct.findUniqueOrThrow({ where: { id: other.offers.Agua } });
      expect(offer.priceCents).toBe(2000);
    });

    it('un organizador de otra productora recibe 403 en los eventos ajenos', async () => {
      const { event } = await scenario();
      const otherOrg = await prisma.organization.create({ data: { name: 'Otra Productora' } });
      const outsider = await prisma.user.create({
        data: {
          organizationId: otherOrg.id,
          email: 'otro-organizador@drinko.test',
          name: 'Otro',
          role: 'ORGANIZER',
          passwordHash: await argon2.hash(PASSWORD),
        },
      });
      const cookie = (await login(outsider.email)).headers['set-cookie'];
      const server = app.getHttpServer();

      await request(server).get(`/api/staff/events/${event.id}/products`).set('Cookie', cookie).expect(403);
      await request(server).get(`/api/staff/events/${event.id}/demand`).set('Cookie', cookie).expect(403);
      const events = await request(server).get('/api/staff/events').set('Cookie', cookie).expect(200);
      expect(events.body).toEqual([]);
    });

    it('un staff no asignado recibe 403 y no cambia nada', async () => {
      const { org, event, offers } = await scenario();
      const other = await createStaff(prisma, org.id);
      await prisma.user.update({ where: { id: other.id }, data: { passwordHash: await argon2.hash(PASSWORD) } });
      const cookie = (await login(other.email)).headers['set-cookie'];

      await request(app.getHttpServer())
        .patch(`/api/staff/events/${event.id}/products/${offers.Cerveza}`)
        .set('Cookie', cookie)
        .send({ priceCents: 1 })
        .expect(403);
      const offer = await prisma.eventProduct.findUniqueOrThrow({ where: { id: offers.Cerveza } });
      expect(offer.priceCents).toBe(5000);
    });
  });
});
