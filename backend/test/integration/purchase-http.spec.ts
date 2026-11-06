import { randomUUID } from 'crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { createTestApp } from '../helpers/app';
import { clearDatabase, createEventFixture } from '../helpers/fixtures';

// Recorrido de compra completo a través de la API, con la cookie del cliente.
describe('API de compra', () => {
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

  it('catálogo, pedido, pago simulado y mis tickets', async () => {
    const { event, offers } = await createEventFixture(prisma, [
      { name: 'Cerveza', priceCents: 5000, stock: 5 },
      { name: 'Fernet', priceCents: 7000, stock: 0 },
    ]);
    const server = app.getHttpServer();

    const catalog = await request(server).get(`/api/events/${event.accessCode}`).expect(200);
    expect(catalog.body.status).toBe('IN_PROGRESS');
    const products = catalog.body.categories[0].products;
    expect(products.find((p: { name: string }) => p.name === 'Fernet').soldOut).toBe(true);

    const created = await request(server)
      .post(`/api/events/${event.accessCode}/orders`)
      .send({
        idempotencyKey: randomUUID(),
        tickets: [{ items: [{ eventProductId: offers.Cerveza, quantity: 2 }] }],
      })
      .expect(201);
    const cookie = created.headers['set-cookie'];
    expect(String(cookie)).toMatch(/drinko_customer=.+HttpOnly/i);

    // Sin la cookie, el pedido no es visible.
    await request(server).get(`/api/orders/${created.body.id}`).expect(404);
    await request(server).get(`/api/orders/${created.body.id}`).set('Cookie', cookie).expect(200);

    const paid = await request(server)
      .post(`/api/orders/${created.body.id}/payment`)
      .set('Cookie', cookie)
      .send({ approved: true })
      .expect(201);
    expect(paid.body.status).toBe('PAID');

    const mine = await request(server).get('/api/tickets').set('Cookie', cookie).expect(200);
    expect(mine.body).toHaveLength(1);
    expect(mine.body[0].status).toBe('ACTIVE');
    expect(mine.body[0].number).toBe(1);

    const byToken = await request(server).get(`/api/tickets/${mine.body[0].token}`).expect(200);
    expect(byToken.body.items[0]).toMatchObject({ productName: 'Cerveza', quantity: 2 });
  });

  it('valida el pedido: más de 10 unidades por ticket es un error 400', async () => {
    const { event, offers } = await createEventFixture(prisma, [
      { name: 'Cerveza', priceCents: 5000, stock: null },
    ]);

    const res = await request(app.getHttpServer())
      .post(`/api/events/${event.accessCode}/orders`)
      .send({
        idempotencyKey: randomUUID(),
        tickets: [{ items: [{ eventProductId: offers.Cerveza, quantity: 11 }] }],
      })
      .expect(400);
    expect(res.body.stack).toBeUndefined();
  });

  it('código de evento inexistente: 404', async () => {
    const res = await request(app.getHttpServer()).get('/api/events/noexiste').expect(404);
    expect(res.body.message).toBe('Este evento no existe');
  });
});
