# VehiAmb API

Backend en Node.js + Express para la gestión del parque automotor.

## Estructura

```text
src/
  app.js            Express app: middlewares y montaje de rutas
  config/
  controllers/
  database/
  errors/
  jobs/             Tareas programadas (node-cron), arrancadas desde server.js
  middlewares/
  repositories/
  routes/
  services/
server.js           Arranque del servidor + jobs + apagado ordenado
```

## Flujo

```text
HTTP route
  -> controller
  -> service
  -> repository
  -> database
```

## Base de datos

El backend usa PostgreSQL como única base operativa.

- `DB_CLIENT=postgres`
- `DATABASE_URL=postgres://vehiamb:vehiamb_dev@localhost:5433/vehiamb`

En Docker (desarrollo) la API se conecta al servicio `postgres` definido en
`docker-compose.yml`. En producción (servidor Windows) apunta al PostgreSQL
instalado localmente — ver `DESPLIEGUE-WINDOWS.md` en la raíz del repo.

Los scripts `migrate:sqlite-postgres` y `export:sqlite-postgres-sql` (ver
`scripts/`) son herramientas de migración del backend antiguo en SQLite; no
son parte del flujo normal de la aplicación.

## Módulos y jobs programados

Además de las rutas REST bajo `/api/*` (vehículos, mantenimientos,
documentos, usuarios, inspecciones, viajes, SIMIT, GPS, repuestos, costos,
importaciones, etc.), `server.js` arranca varios jobs con `node-cron`:

- `preventivo-cambio-aceite`, `documentos-vencimiento`,
  `mantenimientos-proximos`, `stock-alertas`: revisiones que disparan
  notificaciones (email/WhatsApp/in-app). Corren también una vez al arrancar
  el servidor, salvo que se defina `DISABLE_STARTUP_JOBS=true` (útil para no
  reenviar alertas reales al levantar un servidor de pruebas contra la base
  real).
- `import-scheduler` / `gastos-sync`: importación de gastos vehiculares
  desde el Excel `CARGUES BODEGA` compartido en red.
- `stock-import-scheduler` / `config-sync`: sincronización de stock e
  ítems configurados de cambio de aceite desde otro Excel compartido.
- `simit-consulta`: scraping periódico de comparendos SIMIT (Playwright).
- `backup`: `pg_dump` + espejo de `uploads/` a un disco distinto.
- `vehiculo-disponibilidad`, `gps-eventos-sync`: disponibilidad de
  vehículos y sincronización de eventos GPS (Traccar).

## Notificaciones

Un mismo evento (ej. inspección con hallazgos, documento por vencer) puede
salir por tres canales, cada uno independiente y con su propia prioridad
mínima configurable:

- **In-app**: centro de notificaciones (`/api/notificaciones`).
- **Email** (`services/notificaciones-email.channel.js`): requiere
  `SMTP_HOST`; queda inactivo si no está configurado.
- **WhatsApp** (`services/notificaciones-whatsapp.channel.js`): requiere
  `WHATSAPP_ACCESS_TOKEN` y `WHATSAPP_PHONE_NUMBER_ID`; usa plantillas
  aprobadas en Meta.

## Comandos

```bash
npm install
npm run dev
npm start
```

Health check:

```bash
GET /api/health
```

## Variables

Ver `.env.example` (documenta cada variable in-line: SMTP, WhatsApp, GPS/
Traccar, backups, rutas de Excel de red, automatización n8n, etc.).

---

*Nota: la redacción de este README fue asistida con herramientas de IA.*
