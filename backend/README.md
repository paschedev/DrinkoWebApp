# Backend · NestJS + TypeScript

API REST organizada en módulos por dominio, cada uno con controlador, servicio y acceso a datos. Todas las rutas cuelgan de `/api`.

```
backend/
├── prisma/                 esquema de Prisma, migraciones y seed
├── src/
│   ├── common/             errores, validación y utilidades compartidas
│   └── modules/
│       ├── auth/           login, sesiones, permisos e invitaciones
│       ├── organizations/  productoras
│       ├── users/          organizadores, staff y asignaciones a eventos
│       ├── catalog/        productos y categorías
│       ├── events/         eventos y QR de acceso
│       ├── offers/         oferta del evento y demanda pendiente
│       ├── customers/      clientes invitados
│       ├── orders/         pedidos y reserva de stock
│       ├── payments/       pagos (providers/: simulado y Mercado Pago)
│       ├── tickets/        tickets y canje
│       ├── audit/          registro de cambios
│       └── reports/        reportes
└── test/                   tests de integración y de concurrencia
```

## Cómo correrlo

Requiere Node.js 22 o superior y PostgreSQL. Desde la raíz del repositorio se puede levantar la base con Docker (queda en el puerto 5433):

```bash
docker compose up -d
```

Después, dentro de `backend/`:

```bash
cp .env.example .env
npm install
npx prisma migrate dev     # crea las tablas
npx prisma db seed         # carga los datos de ejemplo
npm run start:dev          # API en http://localhost:3001/api
```

- `GET /api/health` responde `{ "status": "ok" }`.
- El seed borra todo y vuelve a cargar los datos, así que se puede repetir.

El despliegue en Railway está explicado en [docs/deploy.md](../docs/deploy.md).

## Endpoints de la compra

| Método y ruta | Qué hace |
| :--- | :--- |
| `GET /api/events/:code` | Catálogo del evento (solo si está en curso) |
| `POST /api/events/:code/orders` | Crea el pedido con sus tickets y reserva el stock. La primera vez crea la cookie del cliente |
| `GET /api/events/:code/orders/pending` | Pedido pendiente del cliente en ese evento |
| `GET /api/orders/:id` | Detalle de un pedido del cliente |
| `POST /api/orders/:id/payment` | Pago simulado: `{ "approved": true }` o `false` |
| `GET /api/tickets` | Tickets pagados del cliente |
| `GET /api/tickets/:token` | Ticket por su token (el contenido del QR) |

## Tests

```bash
npm test
```

Corren contra una base PostgreSQL real (`drinko_test` en el Docker local, o la de `TEST_DATABASE_URL`), porque las garantías de concurrencia las da la base y no se pueden probar con mocks. Antes de empezar se aplican las migraciones en esa base.

- `test/integration/checkout.spec.ts`: reserva de todo el pedido o nada, el mismo producto en varios tickets, productos no disponibles, vencimiento de la reserva, pago aprobado y rechazado, aprobación tardía, doble cobro.
- `test/concurrency/checkout.concurrency.spec.ts`: 30 compras simultáneas con stock 10 (se concretan exactamente 10) y pagos simultáneos sin números de ticket repetidos.
- `test/integration/purchase-http.spec.ts`: el recorrido completo por HTTP, con la cookie del cliente.

La migración inicial (`prisma/migrations/`) es equivalente a `database/ddl.sql`. Los CHECK, los índices parciales y las vistas no se pueden declarar en `schema.prisma`, por eso están escritos a mano al final de esa migración.

## Usuarios de prueba

Los carga el seed. Son datos ficticios, solo para desarrollo.

| Email | Rol |
| :--- | :--- |
| admin@drinko.test | PLATFORM_ADMIN |
| organizador@drinko.test | ORGANIZER |
| staff1@drinko.test | STAFF |
| staff2@drinko.test | STAFF |

Contraseña de todos: `drinko-demo-2026`. El evento de prueba dura 30 días desde que se carga el seed y su QR de acceso apunta a `/e/k7f3q9mx`.
