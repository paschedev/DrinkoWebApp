-- DrinkoWebApp: esquema de la base de datos (PostgreSQL).
-- Se ejecuta sobre una base vacía: psql "$DATABASE_URL" -f database/ddl.sql

BEGIN;

-- Tipos enumerados

CREATE TYPE user_role      AS ENUM ('PLATFORM_ADMIN', 'ORGANIZER', 'STAFF');
CREATE TYPE order_status   AS ENUM ('PENDING_PAYMENT', 'PAID', 'REJECTED', 'EXPIRED');
CREATE TYPE payment_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
-- PENDING: el ticket se crea con el pedido y se activa cuando se aprueba el pago.
CREATE TYPE ticket_status  AS ENUM ('PENDING', 'ACTIVE', 'REDEEMED');

-- Productoras y usuarios

CREATE TABLE organizations (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        text        NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
    id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id  uuid        REFERENCES organizations (id),  -- NULL solo para PLATFORM_ADMIN
    email            text        NOT NULL UNIQUE,
    password_hash    text,                                        -- NULL hasta que el staff acepta la invitación
    name             text        NOT NULL,
    role             user_role   NOT NULL,
    is_active        boolean     NOT NULL DEFAULT true,
    created_at       timestamptz NOT NULL DEFAULT now(),
    CHECK (role = 'PLATFORM_ADMIN' OR organization_id IS NOT NULL)
);

-- Sesiones de organizadores y staff. Se guarda el hash del token, nunca el token.
CREATE TABLE sessions (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid        NOT NULL REFERENCES users (id),
    token_hash  bytea       NOT NULL UNIQUE,
    expires_at  timestamptz NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- Enlaces de invitación de un solo uso para el alta de staff.
CREATE TABLE invitations (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid        NOT NULL REFERENCES users (id),
    token_hash  bytea       NOT NULL UNIQUE,
    created_by  uuid        NOT NULL REFERENCES users (id),
    expires_at  timestamptz NOT NULL,
    used_at     timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- Catálogo maestro

CREATE TABLE categories (
    id               uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id  uuid    NOT NULL REFERENCES organizations (id),
    name             text    NOT NULL,
    sort_order       integer NOT NULL DEFAULT 0,
    UNIQUE (organization_id, name)
);

CREATE TABLE products (
    id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id       uuid        NOT NULL REFERENCES organizations (id),
    category_id           uuid        REFERENCES categories (id),
    name                  text        NOT NULL,
    description           text,
    image_url             text,
    requires_preparation  boolean     NOT NULL DEFAULT false,
    is_archived           boolean     NOT NULL DEFAULT false,  -- un producto con ventas se archiva, no se borra
    created_at            timestamptz NOT NULL DEFAULT now(),
    UNIQUE (organization_id, name)
);

-- Eventos

CREATE TABLE events (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     uuid        NOT NULL REFERENCES organizations (id),
    name                text        NOT NULL,
    access_code         text        NOT NULL UNIQUE,     -- código aleatorio del QR de acceso: /e/{access_code}
    starts_at           timestamptz NOT NULL,
    ends_at             timestamptz NOT NULL,
    last_ticket_number  integer     NOT NULL DEFAULT 0,  -- para numerar los tickets del evento
    created_at          timestamptz NOT NULL DEFAULT now(),
    CHECK (ends_at > starts_at)
);

CREATE INDEX events_organization_starts_at_idx ON events (organization_id, starts_at);

CREATE TABLE staff_assignments (
    event_id     uuid        NOT NULL REFERENCES events (id) ON DELETE CASCADE,
    user_id      uuid        NOT NULL REFERENCES users (id),
    assigned_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (event_id, user_id)
);

-- Oferta del evento: precio, stock y disponibilidad de cada producto en ese evento.
CREATE TABLE event_products (
    id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id      uuid        NOT NULL REFERENCES events (id) ON DELETE CASCADE,
    product_id    uuid        NOT NULL REFERENCES products (id),
    price_cents   integer     NOT NULL CHECK (price_cents > 0),
    stock         integer     CHECK (stock >= 0),  -- NULL = sin control de stock
    is_available  boolean     NOT NULL DEFAULT true,
    updated_at    timestamptz NOT NULL DEFAULT now(),
    UNIQUE (event_id, product_id)
);

-- Compras

-- Cliente invitado: se guarda el hash del secreto de su cookie.
CREATE TABLE customers (
    id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    secret_hash   bytea       NOT NULL UNIQUE,
    email         text,
    created_at    timestamptz NOT NULL DEFAULT now(),
    last_seen_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE orders (
    id               uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id         uuid         NOT NULL REFERENCES events (id),
    customer_id      uuid         NOT NULL REFERENCES customers (id),
    status           order_status NOT NULL DEFAULT 'PENDING_PAYMENT',
    total_cents      integer      NOT NULL CHECK (total_cents > 0),
    idempotency_key  uuid         NOT NULL UNIQUE,  -- evita pedidos duplicados por reintentos
    expires_at       timestamptz  NOT NULL,         -- vencimiento de la reserva de stock (10 min)
    created_at       timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX orders_customer_created_at_idx ON orders (customer_id, created_at DESC);
CREATE INDEX orders_pending_expires_at_idx ON orders (expires_at) WHERE status = 'PENDING_PAYMENT';
-- Un cliente no puede tener dos pedidos pendientes a la vez.
CREATE UNIQUE INDEX orders_one_pending_per_customer_uk ON orders (customer_id) WHERE status = 'PENDING_PAYMENT';

CREATE TABLE payments (
    id                  uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id            uuid           NOT NULL REFERENCES orders (id),
    status              payment_status NOT NULL DEFAULT 'PENDING',
    provider            text           NOT NULL DEFAULT 'SIMULATED',
    external_reference  text,
    amount_cents        integer        NOT NULL CHECK (amount_cents > 0),
    created_at          timestamptz    NOT NULL DEFAULT now(),
    resolved_at         timestamptz
);

-- Un pedido no puede cobrarse dos veces.
CREATE UNIQUE INDEX payments_one_approved_per_order_uk ON payments (order_id) WHERE status = 'APPROVED';

-- Número y token se asignan cuando se aprueba el pago.
CREATE TABLE tickets (
    id           uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id     uuid          NOT NULL REFERENCES orders (id),
    event_id     uuid          NOT NULL REFERENCES events (id),
    number       integer,                -- número visible, correlativo por evento
    token        text          UNIQUE,   -- contenido secreto del QR de retiro
    status       ticket_status NOT NULL DEFAULT 'PENDING',
    redeemed_at  timestamptz,
    redeemed_by  uuid          REFERENCES users (id),
    created_at   timestamptz   NOT NULL DEFAULT now(),
    UNIQUE (event_id, number)
);

CREATE INDEX tickets_order_id_idx ON tickets (order_id);
CREATE INDEX tickets_event_status_idx ON tickets (event_id, status);

-- Nombre y precio se copian al comprar: un cambio de precio no altera lo ya vendido.
CREATE TABLE ticket_items (
    id                uuid     PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id         uuid     NOT NULL REFERENCES tickets (id),
    event_product_id  uuid     NOT NULL REFERENCES event_products (id),
    product_name      text     NOT NULL,
    unit_price_cents  integer  NOT NULL CHECK (unit_price_cents > 0),
    quantity          smallint NOT NULL CHECK (quantity BETWEEN 1 AND 10),
    UNIQUE (ticket_id, event_product_id)
);

CREATE INDEX ticket_items_event_product_id_idx ON ticket_items (event_product_id);

-- Registro de cambios de precio, stock y disponibilidad.
CREATE TABLE change_logs (
    id                bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_product_id  uuid        NOT NULL REFERENCES event_products (id) ON DELETE CASCADE,
    user_id           uuid        NOT NULL REFERENCES users (id),
    field             text        NOT NULL CHECK (field IN ('price_cents', 'stock', 'is_available')),
    old_value         text,
    new_value         text,
    created_at        timestamptz NOT NULL DEFAULT now()
);

-- Estados calculados con la hora del servidor, no se guardan.

CREATE VIEW events_with_status AS
SELECT e.*,
       CASE
           WHEN now() < e.starts_at THEN 'SCHEDULED'
           WHEN now() < e.ends_at   THEN 'IN_PROGRESS'
           ELSE 'FINISHED'
       END AS status
FROM events e;

-- Un ticket activo vence 1 hora después del fin del evento.
CREATE VIEW tickets_with_status AS
SELECT t.*,
       CASE
           WHEN t.status = 'ACTIVE' AND now() > e.ends_at + interval '1 hour' THEN 'EXPIRED'
           ELSE t.status::text
       END AS effective_status
FROM tickets t
JOIN events e ON e.id = t.event_id;

COMMIT;
