# VehiAmb API

Backend en Node.js + Express para la gestion del parque automotor.

## Estructura

```text
src/
  app.js
  config/
  controllers/
  database/
  errors/
  middlewares/
  repositories/
  routes/
  services/
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

El backend usa PostgreSQL como unica base operativa.

- `DB_CLIENT=postgres`
- `DATABASE_URL=postgres://vehiamb:vehiamb_dev@localhost:5432/vehiamb`

En Docker la API se conecta al servicio `postgres` definido en `docker-compose.yml`.

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

Ver `.env.example`.
