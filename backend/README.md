# Backend · NestJS + TypeScript

API REST organizada en módulos por dominio, cada uno con controlador, servicio y acceso a datos. En esta entrega la carpeta tiene solo la estructura.

```
backend/
├── prisma/                 esquema de Prisma y migraciones
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
