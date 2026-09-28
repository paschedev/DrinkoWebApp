# Diagrama entidad-relación

Modelo de datos en PostgreSQL. Se crea con [`ddl.sql`](ddl.sql) y los datos de ejemplo están en [`dml-seed.sql`](dml-seed.sql). Los nombres de tablas y columnas están en inglés.

```mermaid
erDiagram
    organizations ||--o{ users : "emplea"
    organizations ||--o{ categories : "define"
    organizations ||--o{ products : "catálogo maestro"
    organizations ||--o{ events : "organiza"
    categories |o--o{ products : "agrupa"
    users ||--o{ sessions : "abre"
    users ||--o{ invitations : "recibe"
    users ||--o{ staff_assignments : "asignado en"
    events ||--o{ staff_assignments : "tiene"
    events ||--o{ event_products : "ofrece"
    products ||--o{ event_products : "se ofrece como"
    customers ||--o{ orders : "realiza"
    events ||--o{ orders : "recibe"
    orders ||--o{ payments : "se paga con"
    orders ||--|{ tickets : "genera"
    events ||--o{ tickets : "numera"
    tickets ||--|{ ticket_items : "contiene"
    event_products ||--o{ ticket_items : "vendido en"
    users |o--o{ tickets : "canjea"
    event_products ||--o{ change_logs : "audita"
    users ||--o{ change_logs : "realiza"

    organizations {
        uuid id PK
        text name
        timestamptz created_at
    }
    users {
        uuid id PK
        uuid organization_id FK "NULL solo para PLATFORM_ADMIN"
        text email UK
        text password_hash
        text name
        user_role role
        boolean is_active
        timestamptz created_at
    }
    sessions {
        uuid id PK
        uuid user_id FK
        bytea token_hash UK
        timestamptz expires_at
        timestamptz created_at
    }
    invitations {
        uuid id PK
        uuid user_id FK
        bytea token_hash UK
        uuid created_by FK
        timestamptz expires_at
        timestamptz used_at
        timestamptz created_at
    }
    categories {
        uuid id PK
        uuid organization_id FK
        text name
        integer sort_order
    }
    products {
        uuid id PK
        uuid organization_id FK
        uuid category_id FK
        text name
        text description
        text image_url
        boolean requires_preparation
        boolean is_archived
        timestamptz created_at
    }
    events {
        uuid id PK
        uuid organization_id FK
        text name
        text access_code UK
        timestamptz starts_at
        timestamptz ends_at
        integer last_ticket_number
        timestamptz created_at
    }
    staff_assignments {
        uuid event_id PK,FK
        uuid user_id PK,FK
        timestamptz assigned_at
    }
    event_products {
        uuid id PK
        uuid event_id FK
        uuid product_id FK
        integer price_cents
        integer stock "NULL = sin control"
        boolean is_available
        timestamptz updated_at
    }
    customers {
        uuid id PK
        bytea secret_hash UK
        text email
        timestamptz created_at
        timestamptz last_seen_at
    }
    orders {
        uuid id PK
        uuid event_id FK
        uuid customer_id FK
        order_status status
        integer total_cents
        uuid idempotency_key UK
        timestamptz expires_at
        timestamptz created_at
    }
    payments {
        uuid id PK
        uuid order_id FK
        payment_status status
        text provider
        text external_reference
        integer amount_cents
        timestamptz created_at
        timestamptz resolved_at
    }
    tickets {
        uuid id PK
        uuid order_id FK
        uuid event_id FK
        integer number "número visible"
        text token UK "contenido del QR"
        ticket_status status
        timestamptz redeemed_at
        uuid redeemed_by FK
        timestamptz created_at
    }
    ticket_items {
        uuid id PK
        uuid ticket_id FK
        uuid event_product_id FK
        text product_name
        integer unit_price_cents
        smallint quantity
    }
    change_logs {
        bigint id PK
        uuid event_product_id FK
        uuid user_id FK
        text field
        text old_value
        text new_value
        timestamptz created_at
    }
```

## Tipos enumerados

| Tipo | Valores |
|---|---|
| `user_role` | `PLATFORM_ADMIN` (administrador de la plataforma), `ORGANIZER` (organizador), `STAFF` |
| `order_status` | `PENDING_PAYMENT` (pendiente de pago), `PAID` (pagado), `REJECTED` (rechazado), `EXPIRED` (expirado) |
| `payment_status` | `PENDING` (pendiente), `APPROVED` (aprobado), `REJECTED` (rechazado) |
| `ticket_status` | `PENDING` (sin activar, antes del pago), `ACTIVE` (activo), `REDEEMED` (retirado) |

El estado del evento y el vencimiento del ticket no se guardan: los calculan las vistas `events_with_status` y `tickets_with_status` con la hora del servidor.

## Índices principales

Además de los índices de las claves primarias y de las restricciones `UNIQUE`:

| Índice | Para qué |
|---|---|
| `events (organization_id, starts_at)` | Listado de eventos del organizador |
| `event_products (event_id, product_id)` único | Catálogo del evento, sin productos repetidos |
| `orders (customer_id, created_at DESC)` | Mis tickets |
| `orders (expires_at)` parcial, solo pendientes | Liberar las reservas vencidas |
| `orders (customer_id)` único parcial, solo pendientes | Un solo pedido pendiente por cliente |
| `payments (order_id)` único parcial, solo aprobados | Un solo pago aprobado por pedido |
| `tickets (order_id)` | Tickets de cada compra |
| `tickets (token)` único | Canje |
| `tickets (event_id, number)` único | Número visible por evento |
| `tickets (event_id, status)` | Demanda pendiente |
| `ticket_items (event_product_id)` | Demanda pendiente por producto |

## Cómo se crea la base

```bash
psql "$DATABASE_URL" -f database/ddl.sql
psql "$DATABASE_URL" -f database/dml-seed.sql
```
