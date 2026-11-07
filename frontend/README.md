# Frontend · Next.js + TypeScript

Una sola aplicación con las tres interfaces del sistema. Cada área es un grupo de rutas; el nombre entre paréntesis no forma parte de la URL.

```
frontend/
├── public/
└── src/
    ├── app/
    │   ├── (customer)/     cliente: /e/[code] (catálogo, carrito y pago), /tickets, /t/[token]
    │   ├── (bar)/          barra: /bar/[eventId] (escáner, productos y demanda pendiente)
    │   ├── (panel)/        Panel del Organizador: /panel (catálogo, eventos, staff e historial)
    │   └── (auth)/         /login e /invite/[token]
    ├── components/         componentes compartidos y de cada área
    ├── hooks/
    ├── lib/                cliente de la API y utilidades
    └── types/
```

## Cómo correrlo

Con el backend levantado, dentro de `frontend/`:

```bash
cp .env.example .env.local
npm install
npm run dev     # http://localhost:3000
```

Las llamadas a `/api/...` las reenvía Next.js al backend indicado en `BACKEND_URL` (ver `next.config.ts`), así el navegador habla siempre con el mismo dominio.

## Recorrido de compra

| Ruta | Pantalla |
| :--- | :--- |
| `/e/[code]` | Catálogo del evento (se abre con el QR de acceso) |
| `/e/[code]/cart` | Carrito dividido en tickets |
| `/e/[code]/payment/[orderId]` | Pago simulado, con el tiempo de reserva |
| `/tickets` | Mis tickets, con el QR de retiro |
| `/t/[token]` | Un ticket suelto |

## Barra

| Ruta | Pantalla |
| :--- | :--- |
| `/login` | Ingreso de organizadores y staff |
| `/bar` | Eventos en los que el usuario puede operar |
| `/bar/[eventId]/scan` | Escáner de QR con la cámara (y carga manual del código). El resultado se muestra grande, en verde o en rojo |
| `/bar/[eventId]/products` | Precio, disponibilidad y ajuste de stock |
| `/bar/[eventId]/demand` | Lo vendido que todavía no se retiró, actualizado cada 15 segundos |

La cámara del navegador solo funciona con HTTPS (o en `localhost`).

## Detalles de uso

- Tema claro, oscuro o el del sistema (selector al pie de cada pantalla, recordado en el navegador). Los pares de colores cumplen el contraste WCAG AA en los dos temas, y el QR se muestra siempre sobre fondo blanco.
- Carrito: duplicar un ticket, dividirlo en dos (con cantidades impares, el primero se lleva la unidad extra) y confirmar antes de quitar uno.
- Pago: se puede cancelar el pedido pendiente, lo que libera la reserva al instante.
- Mis tickets: primero los que se pueden retirar y después el historial; "Repetir compra" copia los productos de un ticket al carrito con los precios actuales y avisa si alguno ya no está disponible.
- Barra: el escáner vuelve solo a la cámara después de cada canje, y cada cambio de productos confirma que se guardó (el de precio pide confirmación antes).

El carrito se guarda en el navegador (`localStorage`). Con mala señal, el pedido se reintenta con la misma clave de idempotencia (no se duplica), y "Mis tickets" muestra la última copia guardada para poder enseñar el QR sin conexión. El cliente se identifica con una cookie httpOnly que crea el backend.

El despliegue en Vercel está explicado en [docs/deploy.md](../docs/deploy.md).
