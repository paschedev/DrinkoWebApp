// Datos de ejemplo, equivalentes a database/dml-seed.sql.
// Borra los datos existentes y vuelve a cargar todo, así se puede correr más de una vez.
import { PrismaClient, UserRole } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

// Contraseña ficticia de todos los usuarios demo.
const DEMO_PASSWORD = 'drinko-demo-2026';

const PRODUCTS = [
  { name: 'Cerveza rubia', category: 'Cervezas', requiresPreparation: false, priceCents: 500000, stock: 200 },
  { name: 'Cerveza negra', category: 'Cervezas', requiresPreparation: false, priceCents: 550000, stock: 120 },
  { name: 'Gin tonic', category: 'Tragos', requiresPreparation: true, priceCents: 800000, stock: null },
  { name: 'Fernet con coca', category: 'Tragos', requiresPreparation: true, priceCents: 700000, stock: 0 },
  { name: 'Mojito', category: 'Tragos', requiresPreparation: true, priceCents: 750000, stock: null },
  { name: 'Vodka con naranja', category: 'Tragos', requiresPreparation: true, priceCents: 700000, stock: null },
  { name: 'Agua mineral', category: 'Sin alcohol', requiresPreparation: false, priceCents: 250000, stock: 150 },
  { name: 'Gaseosa', category: 'Sin alcohol', requiresPreparation: false, priceCents: 300000, stock: 100 },
];

async function clear() {
  await prisma.changeLog.deleteMany();
  await prisma.ticketItem.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.order.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.eventProduct.deleteMany();
  await prisma.staffAssignment.deleteMany();
  await prisma.event.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.invitation.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();
}

async function main() {
  await clear();

  const passwordHash = await argon2.hash(DEMO_PASSWORD, { type: argon2.argon2id });
  const org = await prisma.organization.create({ data: { name: 'Productora Demo' } });

  await prisma.user.create({
    data: { email: 'admin@drinko.test', name: 'Administrador Demo', role: UserRole.PLATFORM_ADMIN, passwordHash },
  });
  await prisma.user.createMany({
    data: [
      { organizationId: org.id, email: 'organizador@drinko.test', name: 'Organizador Demo', role: UserRole.ORGANIZER, passwordHash },
      { organizationId: org.id, email: 'staff1@drinko.test', name: 'Staff Uno', role: UserRole.STAFF, passwordHash },
      { organizationId: org.id, email: 'staff2@drinko.test', name: 'Staff Dos', role: UserRole.STAFF, passwordHash },
    ],
  });

  const categoryNames = ['Cervezas', 'Tragos', 'Sin alcohol'];
  const categories = new Map<string, string>();
  for (const [i, name] of categoryNames.entries()) {
    const category = await prisma.category.create({
      data: { organizationId: org.id, name, sortOrder: i + 1 },
    });
    categories.set(name, category.id);
  }

  // Empezó hace 1 hora y dura 30 días, así la demo desplegada queda en curso
  // durante toda la evaluación.
  const hour = 60 * 60 * 1000;
  const event = await prisma.event.create({
    data: {
      organizationId: org.id,
      name: 'Fiesta Demo',
      accessCode: 'k7f3q9mx',
      startsAt: new Date(Date.now() - hour),
      endsAt: new Date(Date.now() + 30 * 24 * hour),
    },
  });

  const staff = await prisma.user.findMany({ where: { role: UserRole.STAFF } });
  await prisma.staffAssignment.createMany({
    data: staff.map((user) => ({ eventId: event.id, userId: user.id })),
  });

  // Precios en centavos. Stock null = sin control; 0 = agotado.
  for (const p of PRODUCTS) {
    const product = await prisma.product.create({
      data: {
        organizationId: org.id,
        categoryId: categories.get(p.category),
        name: p.name,
        requiresPreparation: p.requiresPreparation,
      },
    });
    await prisma.eventProduct.create({
      data: { eventId: event.id, productId: product.id, priceCents: p.priceCents, stock: p.stock },
    });
  }

  console.log('Seed cargado. Evento demo: /e/k7f3q9mx');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
