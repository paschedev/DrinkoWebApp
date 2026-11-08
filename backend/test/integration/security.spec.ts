import { randomUUID } from 'crypto';
import { INestApplication } from '@nestjs/common';
import * as argon2 from 'argon2';
import request from 'supertest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { createTestApp } from '../helpers/app';
import { clearDatabase, createEventFixture, createStaff } from '../helpers/fixtures';

describe('Seguridad', () => {
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

  it('manda encabezados de seguridad y no expone la tecnología', async () => {
    const res = await request(app.getHttpServer()).get('/api/health').expect(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('no habilita CORS: un origen ajeno no recibe Access-Control-Allow-Origin', async () => {
    const server = app.getHttpServer();
    const res = await request(server).get('/api/health').set('Origin', 'https://sitio-malicioso.com');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    const preflight = await request(server)
      .options('/api/auth/login')
      .set('Origin', 'https://sitio-malicioso.com')
      .set('Access-Control-Request-Method', 'POST');
    expect(preflight.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('rechaza escrituras que llegan desde otro sitio (CSRF)', async () => {
    const { event, offers } = await createEventFixture(prisma, [{ name: 'Cerveza', priceCents: 5000, stock: 10 }]);
    const body = {
      idempotencyKey: randomUUID(),
      tickets: [{ items: [{ eventProductId: offers.Cerveza, quantity: 1 }] }],
    };

    await request(app.getHttpServer())
      .post(`/api/events/${event.accessCode}/orders`)
      .set('Sec-Fetch-Site', 'cross-site')
      .send(body)
      .expect(403);
    expect(await prisma.order.count()).toBe(0);

    // Desde el mismo origen (nuestro frontend) funciona.
    await request(app.getHttpServer())
      .post(`/api/events/${event.accessCode}/orders`)
      .set('Sec-Fetch-Site', 'same-origin')
      .send(body)
      .expect(201);
  });

  it('bloquea el login después de 5 intentos fallidos', async () => {
    const { org } = await createEventFixture(prisma, []);
    const staff = await createStaff(prisma, org.id);
    await prisma.user.update({ where: { id: staff.id }, data: { passwordHash: await argon2.hash('la-correcta') } });
    const login = (password: string) =>
      request(app.getHttpServer()).post('/api/auth/login').send({ email: staff.email, password });

    for (let i = 0; i < 5; i++) await login('incorrecta').expect(401);
    // Aun con la contraseña correcta, queda bloqueado por un rato.
    const blocked = await login('la-correcta').expect(429);
    expect(blocked.body.message).toMatch(/demasiados intentos/i);
  });

  it('las cookies son httpOnly y SameSite=Lax', async () => {
    const { event, offers } = await createEventFixture(prisma, [{ name: 'Cerveza', priceCents: 5000, stock: null }]);
    const res = await request(app.getHttpServer())
      .post(`/api/events/${event.accessCode}/orders`)
      .send({ idempotencyKey: randomUUID(), tickets: [{ items: [{ eventProductId: offers.Cerveza, quantity: 1 }] }] })
      .expect(201);
    expect(String(res.headers['set-cookie'])).toMatch(/HttpOnly/i);
    expect(String(res.headers['set-cookie'])).toMatch(/SameSite=Lax/i);
  });

  it('un cliente no puede ver, pagar ni cancelar el pedido de otro (IDOR)', async () => {
    const { event, offers } = await createEventFixture(prisma, [{ name: 'Cerveza', priceCents: 5000, stock: null }]);
    const server = app.getHttpServer();
    const owner = await request(server)
      .post(`/api/events/${event.accessCode}/orders`)
      .send({ idempotencyKey: randomUUID(), tickets: [{ items: [{ eventProductId: offers.Cerveza, quantity: 1 }] }] })
      .expect(201);
    const intruder = await request(server)
      .post(`/api/events/${event.accessCode}/orders`)
      .send({ idempotencyKey: randomUUID(), tickets: [{ items: [{ eventProductId: offers.Cerveza, quantity: 1 }] }] })
      .expect(201);
    const intruderCookie = intruder.headers['set-cookie'];
    const orderId = owner.body.id;

    await request(server).get(`/api/orders/${orderId}`).set('Cookie', intruderCookie).expect(404);
    await request(server).post(`/api/orders/${orderId}/payment`).set('Cookie', intruderCookie).send({ approved: true }).expect(404);
    await request(server).post(`/api/orders/${orderId}/cancel`).set('Cookie', intruderCookie).expect(404);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe('PENDING_PAYMENT');
  });

  it('el canje rechaza códigos con un formato que no es el de un QR de Drinko', async () => {
    const { org, event } = await createEventFixture(prisma, []);
    const staff = await createStaff(prisma, org.id, event.id);
    await prisma.user.update({ where: { id: staff.id }, data: { passwordHash: await argon2.hash('clave') } });
    const login = await request(app.getHttpServer()).post('/api/auth/login').send({ email: staff.email, password: 'clave' });

    const res = await request(app.getHttpServer())
      .post(`/api/staff/events/${event.id}/redemptions`)
      .set('Cookie', login.headers['set-cookie'])
      .send({ token: "' OR 1=1 --" })
      .expect(400);
    expect(res.body.message).toEqual(['El código no tiene el formato de un QR de Drinko']);
  });
});
