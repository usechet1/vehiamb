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

El backend soporta dos modos:

- `DB_CLIENT=sqlite`: usa `src/database/parque_automotor.db`.
- `DB_CLIENT=postgres`: usa `DATABASE_URL`.

En Docker se usa PostgreSQL por defecto. En local, si no defines variables de entorno, usa SQLite para que el desarrollo sea simple.

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
