-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('PLATFORM_ADMIN', 'ORGANIZER', 'STAFF');

-- CreateEnum
CREATE TYPE "order_status" AS ENUM ('PENDING_PAYMENT', 'PAID', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ticket_status" AS ENUM ('PENDING', 'ACTIVE', 'REDEEMED');

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "name" TEXT NOT NULL,
    "role" "user_role" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" BYTEA NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" BYTEA NOT NULL,
    "created_by" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "category_id" UUID,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "image_url" TEXT,
    "requires_preparation" BOOLEAN NOT NULL DEFAULT false,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "access_code" TEXT NOT NULL,
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6) NOT NULL,
    "last_ticket_number" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_assignments" (
    "event_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_assignments_pkey" PRIMARY KEY ("event_id","user_id")
);

-- CreateTable
CREATE TABLE "event_products" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "event_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "price_cents" INTEGER NOT NULL,
    "stock" INTEGER,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "secret_hash" BYTEA NOT NULL,
    "email" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "event_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "status" "order_status" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "total_cents" INTEGER NOT NULL,
    "idempotency_key" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "status" "payment_status" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT NOT NULL DEFAULT 'SIMULATED',
    "external_reference" TEXT,
    "amount_cents" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ(6),

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "number" INTEGER,
    "token" TEXT,
    "status" "ticket_status" NOT NULL DEFAULT 'PENDING',
    "redeemed_at" TIMESTAMPTZ(6),
    "redeemed_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ticket_id" UUID NOT NULL,
    "event_product_id" UUID NOT NULL,
    "product_name" TEXT NOT NULL,
    "unit_price_cents" INTEGER NOT NULL,
    "quantity" SMALLINT NOT NULL,

    CONSTRAINT "ticket_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "change_logs" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY,
    "event_product_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "field" TEXT NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "change_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_token_hash_key" ON "invitations"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "categories_organization_id_name_key" ON "categories"("organization_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "products_organization_id_name_key" ON "products"("organization_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "events_access_code_key" ON "events"("access_code");

-- CreateIndex
CREATE INDEX "events_organization_starts_at_idx" ON "events"("organization_id", "starts_at");

-- CreateIndex
CREATE UNIQUE INDEX "event_products_event_id_product_id_key" ON "event_products"("event_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "customers_secret_hash_key" ON "customers"("secret_hash");

-- CreateIndex
CREATE UNIQUE INDEX "orders_idempotency_key_key" ON "orders"("idempotency_key");

-- CreateIndex
CREATE INDEX "orders_customer_created_at_idx" ON "orders"("customer_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "tickets_token_key" ON "tickets"("token");

-- CreateIndex
CREATE INDEX "tickets_order_id_idx" ON "tickets"("order_id");

-- CreateIndex
CREATE INDEX "tickets_event_status_idx" ON "tickets"("event_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_event_id_number_key" ON "tickets"("event_id", "number");

-- CreateIndex
CREATE INDEX "ticket_items_event_product_id_idx" ON "ticket_items"("event_product_id");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_items_ticket_id_event_product_id_key" ON "ticket_items"("ticket_id", "event_product_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "staff_assignments" ADD CONSTRAINT "staff_assignments_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "staff_assignments" ADD CONSTRAINT "staff_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "event_products" ADD CONSTRAINT "event_products_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "event_products" ADD CONSTRAINT "event_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_redeemed_by_fkey" FOREIGN KEY ("redeemed_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ticket_items" ADD CONSTRAINT "ticket_items_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ticket_items" ADD CONSTRAINT "ticket_items_event_product_id_fkey" FOREIGN KEY ("event_product_id") REFERENCES "event_products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "change_logs" ADD CONSTRAINT "change_logs_event_product_id_fkey" FOREIGN KEY ("event_product_id") REFERENCES "event_products"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "change_logs" ADD CONSTRAINT "change_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Agregado a mano: reglas de database/ddl.sql que Prisma no puede expresar en el schema.

-- CHECK
ALTER TABLE "users" ADD CONSTRAINT "users_check" CHECK (role = 'PLATFORM_ADMIN' OR organization_id IS NOT NULL);
ALTER TABLE "events" ADD CONSTRAINT "events_check" CHECK (ends_at > starts_at);
ALTER TABLE "event_products" ADD CONSTRAINT "event_products_price_cents_check" CHECK (price_cents > 0);
ALTER TABLE "event_products" ADD CONSTRAINT "event_products_stock_check" CHECK (stock >= 0);
ALTER TABLE "orders" ADD CONSTRAINT "orders_total_cents_check" CHECK (total_cents > 0);
ALTER TABLE "payments" ADD CONSTRAINT "payments_amount_cents_check" CHECK (amount_cents > 0);
ALTER TABLE "ticket_items" ADD CONSTRAINT "ticket_items_unit_price_cents_check" CHECK (unit_price_cents > 0);
ALTER TABLE "ticket_items" ADD CONSTRAINT "ticket_items_quantity_check" CHECK (quantity BETWEEN 1 AND 10);
ALTER TABLE "change_logs" ADD CONSTRAINT "change_logs_field_check" CHECK (field IN ('price_cents', 'stock', 'is_available'));

-- Índices parciales
CREATE INDEX "orders_pending_expires_at_idx" ON "orders" ("expires_at") WHERE status = 'PENDING_PAYMENT';
-- Un cliente no puede tener dos pedidos pendientes en el mismo evento.
CREATE UNIQUE INDEX "orders_one_pending_per_customer_event_uk" ON "orders" ("customer_id", "event_id") WHERE status = 'PENDING_PAYMENT';
-- Un pedido no puede cobrarse dos veces.
CREATE UNIQUE INDEX "payments_one_approved_per_order_uk" ON "payments" ("order_id") WHERE status = 'APPROVED';

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
