# Backend · NestJS + TypeScript

API REST organizada en módulos por dominio, cada uno con controlador, servicio y acceso a datos. Todas las rutas cuelgan de `/api`.

```
backend/
├── prisma/                 esquema de Prisma, migraciones y seed
├── src/
│   ├── common/             errores, validación y utilidades compartidas
│   └── modules/
│       ├── auth/           login, sesiones, permisos y límite de intentos
│       ├── catalog/        catálogo maestro de productos
│       ├── events/         catálogo del evento y eventos del organizador
│       ├── offers/         oferta del evento, registro de cambios y demanda pendiente
│       ├── customers/      clientes invitados
│       ├── orders/         pedidos, reserva de stock y vencimiento
│       ├── payments/       pago simulado
│       └── tickets/        tickets y canje
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
| `POST /api/orders/:id/cancel` | Cancela el pedido pendiente y libera el stock (pasa a `EXPIRED`) |
| `GET /api/tickets` | Tickets pagados del cliente |
| `GET /api/tickets/:token` | Ticket por su token (el contenido del QR) |

## Endpoints de la barra

Requieren la sesión de un organizador o de un staff (cookie httpOnly `drinko_session`). El staff solo opera en los eventos a los que está asignado; el organizador, en los de su productora.

| Método y ruta | Qué hace |
| :--- | :--- |
| `POST /api/auth/login` | Inicia sesión con email y contraseña |
| `POST /api/auth/logout` | Cierra la sesión (borra la fila de `sessions`) |
| `GET /api/auth/me` | Usuario de la sesión |
| `GET /api/staff/events` | Eventos en los que puede operar |
| `POST /api/staff/events/:id/redemptions` | Canje: `{ "token": "..." }` |
| `GET /api/staff/events/:id/products` | Precio, stock y disponibilidad de cada producto |
| `PATCH /api/staff/events/:id/products/:productId` | Cambia precio o disponibilidad, o ajusta el stock con `stockDelta` (+/- unidades) |
| `GET /api/staff/events/:id/demand` | Unidades vendidas que todavía no se retiraron |

## Endpoints del Panel del Organizador

Requieren la sesión de un usuario con rol `ORGANIZER`. Todas las consultas se filtran por su productora: un evento o producto de otra productora responde 404.

| Método y ruta | Qué hace |
| :--- | :--- |
| `GET /api/organizer/events` | Eventos de la productora |
| `POST /api/organizer/events` | Crea un evento (nombre, inicio, fin y staff); el código de acceso lo genera el servidor |
| `GET /api/organizer/events/:id` | Detalle con oferta y staff |
| `PATCH /api/organizer/events/:id` | Programado: edita todo. En curso: nombre o extender el fin. Finalizado: solo lectura |
| `DELETE /api/organizer/events/:id` | Solo si nunca empezó y no tiene pedidos |
| `PUT /api/organizer/events/:id/staff` | Staff asignado (solo de la productora) |
| `POST /api/organizer/events/:id/products` | Suma productos del catálogo a la oferta, con precio y stock opcional |
| `GET /api/organizer/staff`, `GET /api/organizer/categories` | Staff y categorías de la productora |
| `GET/POST /api/organizer/products`, `PATCH/DELETE /api/organizer/products/:id` | Catálogo maestro. Un producto ya ofrecido en un evento se archiva, no se borra |

## Seguridad

- **IDOR**: cada ruta con un id verifica que el recurso sea del cliente de la cookie (pedidos), del staff asignado o del organizador de la productora (eventos y productos). Hay tests de acceso cruzado.
- **CORS**: no se habilita. El frontend llama a `/api` desde su mismo dominio a través del rewrite de Next.js, así que una página de otro origen no puede leer las respuestas.
- **CSRF**: cookies `SameSite=Lax` y, además, se rechazan las escrituras que el navegador marca con `Sec-Fetch-Site: cross-site`.
- **Login**: contraseñas con Argon2id; después de 5 intentos fallidos con el mismo email e IP, el login queda bloqueado 15 minutos (429).
- **Encabezados**: `helmet` (nosniff, sin iframes de otros sitios, HSTS, sin `X-Powered-By`). Los errores nunca incluyen el stack trace.

El canje es un único `UPDATE` que solo afecta la fila si el token es válido, el ticket es de ese evento, está `ACTIVE`, no venció (fin del evento + 1 hora) y quien escanea puede operar la barra. Si dos barras escanean el mismo QR a la vez, solo una lo canjea. Cada cambio de precio, stock o disponibilidad queda en `change_logs`.

## Tests

```bash
npm test
```

Corren contra una base PostgreSQL real (`drinko_test` en el Docker local, o la de `TEST_DATABASE_URL`), porque las garantías de concurrencia las da la base y no se pueden probar con mocks. Antes de empezar se aplican las migraciones en esa base.

- `test/integration/checkout.spec.ts`: reserva de todo el pedido o nada, el mismo producto en varios tickets, productos no disponibles, vencimiento de la reserva, pago aprobado y rechazado, aprobación tardía, doble cobro.
- `test/concurrency/checkout.concurrency.spec.ts`: 30 compras simultáneas con stock 10 (se concretan exactamente 10), reintentos simultáneos del mismo pedido (se crea uno solo) y pagos simultáneos sin números de ticket repetidos.
- `test/integration/purchase-http.spec.ts`: el recorrido completo por HTTP, con la cookie del cliente.
- `test/integration/redeem.spec.ts`: canje OK, ticket ya retirado, vencido, de otro evento, sin pagar y staff no asignado.
- `test/concurrency/redeem.concurrency.spec.ts`: 50 escaneos simultáneos del mismo QR desde 5 staff: exactamente 1 canje.
- `test/integration/staff-http.spec.ts`: login, logout, eventos asignados, canje por HTTP, demanda pendiente y cambios de precio, stock y disponibilidad con su registro.
- `test/integration/organizer-http.spec.ts`: panel del organizador (productos, eventos, reglas de edición y acceso cruzado entre productoras).
- `test/integration/security.spec.ts`: encabezados, CORS, CSRF, límite de intentos de login, cookies, IDOR de pedidos y formato del código del QR.
- Recursos de productoras distintas: un pedido no puede incluir productos de otro evento, un organizador no opera eventos de otra productora y un producto no se edita desde un evento que no es el suyo.

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
