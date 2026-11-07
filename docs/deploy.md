# Despliegue

El backend y la base de datos van en Railway, y el frontend en Vercel. El navegador habla solo con Vercel: Next.js reenvía las llamadas a `/api` al backend de Railway, así la cookie del cliente queda en el mismo dominio que la página.

```
Navegador ──► Vercel (Next.js) ──/api──► Railway (NestJS) ──► Railway (PostgreSQL)
```

## 1. Railway: base de datos y backend

1. Crear un proyecto nuevo y agregar una base **PostgreSQL** (New → Database → PostgreSQL).
2. En el mismo proyecto, agregar un servicio desde el repositorio de GitHub (New → GitHub Repo → `DrinkoWebApp`).
3. En la configuración del servicio:
   - **Root Directory**: `/backend`
   - **Config File Path**: `/backend/railway.json`. Railway no busca este archivo dentro del Root Directory, así que hay que indicarlo.
4. En **Variables** del servicio:
   - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`. Es una referencia a la base del mismo proyecto, que usa la red interna.
   - `NODE_ENV` = `production`. Con esto la cookie del cliente se marca como `Secure`.
   - `PORT` = el mismo puerto que se elija al generar el dominio (por ejemplo `9090`). La app escucha en ese puerto; si no coinciden, Railway responde 502 "Application failed to respond".
5. En **Settings → Networking**, generar un dominio público (Generate Domain) con ese puerto. En Railway cada servicio corre aislado, así que el puerto no choca con el de otras apps.

Con `railway.json`, en cada despliegue Railway:

- compila con `npm install --include=dev && npm run build` (con `NODE_ENV=production`, npm omitiría las herramientas de compilación);
- aplica las migraciones con `npx prisma migrate deploy` antes de arrancar;
- arranca con `node dist/main.js`;
- espera a que `/api/health` responda.

Para comprobarlo, abrir `https://<dominio-de-railway>/api/health`. Tiene que devolver `{"status":"ok"}`.

## 2. Datos de ejemplo en la base de Railway

El seed se corre **una sola vez**. Lo más simple es hacerlo desde la consola del servicio backend en Railway (pestaña Console), que ya tiene `DATABASE_URL` apuntando a la base:

```bash
npx prisma migrate deploy   # solo si las tablas no se crearon en el deploy
npx prisma db seed
```

Tiene que terminar con "Seed cargado. Evento demo: /e/k7f3q9mx". Si `/api/health` responde pero el catálogo devuelve 500, las tablas no existen: correr `npx prisma migrate deploy` y revisar que el Config File Path sea `/backend/railway.json`.

También se puede correr desde la computadora local, con la URL **pública** de la base (servicio Postgres → Variables → `DATABASE_PUBLIC_URL`).

En PowerShell, dentro de `backend/`:

```powershell
$env:DATABASE_URL="<DATABASE_PUBLIC_URL>"; npx prisma db seed; Remove-Item Env:DATABASE_URL
```

En bash:

```bash
DATABASE_URL="<DATABASE_PUBLIC_URL>" npx prisma db seed
```

El seed borra todos los datos antes de cargar los de ejemplo. El evento demo dura 30 días desde que se corre el seed.

## 3. Vercel: frontend

1. Importar el repositorio (Add New → Project → `DrinkoWebApp`).
2. **Root Directory**: `frontend`. Vercel detecta Next.js solo.
3. En **Environment Variables**, agregar `BACKEND_URL` = `https://<dominio-de-railway>`, sin barra final.
4. Deploy.

`BACKEND_URL` se lee al compilar. Si se cambia, hay que volver a desplegar.

Para probarlo, abrir `https://<dominio-de-vercel>/e/k7f3q9mx` y recorrer la compra completa.

## Variables de entorno

| Variable | Dónde | Para qué |
| :--- | :--- | :--- |
| `DATABASE_URL` | backend | Conexión a PostgreSQL |
| `PORT` | backend | Puerto HTTP. En Railway, el mismo del dominio (9090 en nuestro deploy); en local, 3001 |
| `NODE_ENV` | backend | En `production`, la cookie del cliente sale con `Secure` |
| `BACKEND_URL` | frontend | URL del backend al que Next.js reenvía `/api` |
| `TEST_DATABASE_URL` | backend (opcional) | Base para los tests; por defecto `drinko_test` en el Docker local |
