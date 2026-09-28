-- DrinkoWebApp: datos de ejemplo (seed). Se ejecuta una vez, después de ddl.sql.
-- Usuarios de prueba (contraseña de todos: drinko-demo-2026):
--   admin@drinko.test, organizador@drinko.test, staff1@drinko.test, staff2@drinko.test
-- Evento en curso con QR de acceso /e/k7f3q9mx

BEGIN;

INSERT INTO organizations (name) VALUES ('Productora Demo');

INSERT INTO users (organization_id, email, name, role) VALUES
    (NULL,                           'admin@drinko.test',       'Administrador Demo', 'PLATFORM_ADMIN'),
    ((SELECT id FROM organizations), 'organizador@drinko.test', 'Organizador Demo',   'ORGANIZER'),
    ((SELECT id FROM organizations), 'staff1@drinko.test',      'Staff Uno',          'STAFF'),
    ((SELECT id FROM organizations), 'staff2@drinko.test',      'Staff Dos',          'STAFF');

-- Hash Argon2id de la contraseña de prueba.
UPDATE users
   SET password_hash = '$argon2id$v=19$m=19456,t=2,p=1$f6kf4vEophdY1bMBrJuQMw$0oBC2PFJ7FJhhDyfGXMcr+yWGElfUj4uGLzw9H3LWkU';

INSERT INTO categories (organization_id, name, sort_order) VALUES
    ((SELECT id FROM organizations), 'Cervezas',    1),
    ((SELECT id FROM organizations), 'Tragos',      2),
    ((SELECT id FROM organizations), 'Sin alcohol', 3);

INSERT INTO products (organization_id, category_id, name, requires_preparation)
SELECT c.organization_id, c.id, p.name, p.requires_preparation
FROM (VALUES
    ('Cerveza rubia',     'Cervezas',    false),
    ('Cerveza negra',     'Cervezas',    false),
    ('Gin tonic',         'Tragos',      true),
    ('Fernet con coca',   'Tragos',      true),
    ('Mojito',            'Tragos',      true),
    ('Vodka con naranja', 'Tragos',      true),
    ('Agua mineral',      'Sin alcohol', false),
    ('Gaseosa',           'Sin alcohol', false)
) AS p (name, category, requires_preparation)
JOIN categories c ON c.name = p.category;

-- Empezó hace 1 hora y termina en 5, así queda en curso al cargar los datos.
INSERT INTO events (organization_id, name, access_code, starts_at, ends_at) VALUES
    ((SELECT id FROM organizations), 'Fiesta Demo', 'k7f3q9mx', now() - interval '1 hour', now() + interval '5 hours');

INSERT INTO staff_assignments (event_id, user_id)
SELECT e.id, u.id
FROM events e
CROSS JOIN users u
WHERE u.role = 'STAFF';

-- Precios en centavos. Stock NULL = sin control; 0 = agotado.
INSERT INTO event_products (event_id, product_id, price_cents, stock)
SELECT e.id, p.id, o.price_cents, o.stock
FROM (VALUES
    ('Cerveza rubia',     500000, 200),
    ('Cerveza negra',     550000, 120),
    ('Gin tonic',         800000, NULL),
    ('Fernet con coca',   700000, 0),
    ('Mojito',            750000, NULL),
    ('Vodka con naranja', 700000, NULL),
    ('Agua mineral',      250000, 150),
    ('Gaseosa',           300000, 100)
) AS o (product, price_cents, stock)
JOIN products p ON p.name = o.product
CROSS JOIN events e;

COMMIT;
