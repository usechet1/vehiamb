# VehiAmb

Plataforma para centralizar el control del parque automotor: mantener la
flota al día en documentos y mantenimientos, hacer seguimiento en tiempo real
de viajes e inspecciones, y alertar automáticamente a los responsables por
email y WhatsApp.

## Estructura

```text
vehiamb/
  backend/                  API Node.js + Express, PostgreSQL
  frontend/                 Front estático HTML/CSS/JS (multi-página)
  docker-compose.yml        Stack de DESARROLLO (Postgres + backend + frontend)
  DESPLIEGUE-WINDOWS.md     Guía vigente para el servidor de producción (Windows, sin Docker)
```

## Módulos principales

- **Vehículos, mantenimientos y documentos**: hoja de vida, vencimientos de
  SOAT/RTM (con automatización vía n8n + WhatsApp), historial de costos.
- **Inspecciones y viajes**: preoperacional del conductor al iniciar un
  viaje, con alertas cuando queda con ítems en mal estado.
- **SIMIT**: consulta periódica de comparendos por placa (scraping con
  Playwright) y notificación de novedades.
- **Rastreo GPS**: integración con trackers Suntech vía Traccar
  auto-hospedado.
- **Repuestos e inventario**: importación de stock y configuración de
  cambios de aceite desde Excel compartido en red.
- **Notificaciones**: centro in-app, correo (SMTP) y WhatsApp Business API,
  con prioridad mínima configurable por canal.
- **Backups**: `pg_dump` + espejo de `uploads/` a un disco/recurso distinto,
  programado por cron.

Ver `backend/README.md` para el detalle técnico del backend.

## Producción

El ambiente real corre en un **servidor Windows sin Docker** (Node nativo vía
Tarea Programada, Nginx sirviendo el frontend y haciendo proxy de `/api`, y
Cloudflare Tunnel para la exposición a internet). La guía vigente y completa
está en [`DESPLIEGUE-WINDOWS.md`](DESPLIEGUE-WINDOWS.md).

`docker-compose.yml` en este repo es **solo para desarrollo local**.

## Desarrollo local con Docker

Levanta PostgreSQL, backend y frontend:

```bash
docker compose up --build
```

Servicios:

- Frontend: http://localhost:8080
- Backend: http://localhost:3001
- Health check: http://localhost:3001/api/health
- PostgreSQL: localhost:5433

Credenciales de desarrollo (definidas en `docker-compose.yml`):

```text
database: vehiamb
user: vehiamb
password: vehiamb_dev
```

Variables obligatorias adicionales (ver `.env` en la raíz): `AUTH_SECRET`,
`SEED_ADMIN_PASSWORD`, `DESPACHOS_HOST_PATH` (carpeta de red con el Excel de
cargues, ya montada en el host).

## Desarrollo local sin Docker

Requiere PostgreSQL propio (ver `backend/.env.example` para la cadena de
conexión y el resto de variables: SMTP, WhatsApp, GPS/Traccar, backups,
rutas de Excel, etc.).

```bash
cd backend
npm install
npm run dev
```

Frontend:

```bash
cd frontend
python -m http.server 5500 --bind 127.0.0.1
```

Luego abrir http://127.0.0.1:5500.

---

*Nota: la redacción de este README fue asistida con herramientas de IA.*
