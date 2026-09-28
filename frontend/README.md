# Frontend · Next.js + TypeScript

Una sola aplicación con las tres interfaces del sistema. Cada área es un grupo de rutas; el nombre entre paréntesis no forma parte de la URL. En esta entrega la carpeta tiene solo la estructura.

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
