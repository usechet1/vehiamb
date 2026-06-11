# VehiAmb

Aplicacion para gestion de parque automotor.

## Estructura

```text
vehiamb/
  backend/       API Express
  frontend/      Front estatico HTML/CSS/JS
  docker-compose.yml
```

## Ejecucion con Docker

Levanta PostgreSQL, backend y frontend:

```bash
docker compose up --build
```

Servicios:

- Frontend: http://localhost:8080
- Backend: http://localhost:3000
- Health check: http://localhost:3000/api/health
- PostgreSQL: localhost:5432

Credenciales de desarrollo:

```text
database: vehiamb
user: vehiamb
password: vehiamb_dev
```

## Ejecucion local sin Docker

Backend con SQLite:

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
