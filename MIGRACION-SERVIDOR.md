# Migración de VehiAmb a un servidor

Guía paso a paso para mover VehiAmb de la máquina Windows actual (Task Scheduler) a un servidor propio.

## 0. Decisiones previas

- **Excel de red interna** (`EXCEL_FILE_PATH`, `STOCK_EXCEL_FILE_PATH`, `CONFIG_EXCEL_FILE_PATH`): hoy son rutas UNC de Windows (`\\192.168.9.21\...`). Si el servidor nuevo es Linux, hay que decidir cómo se sigue leyendo esa carpeta compartida (montar por CIFS/SMB, sincronizar con rsync/robocopy desde la máquina Windows, o migrar ese flujo a otra cosa).
- **Exposición a internet**: se eligió **Cloudflare Tunnel**, migrando el dominio `ambientesceramicos.com` completo a Cloudflare como zona DNS.

---

## 1. Servidor

- VPS Linux (Ubuntu 22.04/24.04). Con 2 vCPU / 4 GB RAM alcanza de sobra (el scraper de SIMIT corre un Chromium real vía Playwright).
- Acceso SSH con usuario no-root + `sudo`.
- Actualizar sistema:
  ```bash
  sudo apt update && sudo apt upgrade -y
  ```
- Instalar Docker (el repo ya trae `docker-compose.yml`):
  ```bash
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker $USER
  ```
  (cerrar sesión SSH y volver a entrar para que aplique el grupo)

## 2. Código: git en el servidor

```bash
sudo apt install -y git
git clone https://github.com/usechet1/vehiamb.git
cd vehiamb
```
El repo es **público**, así que `git clone`/`git pull` funcionan sin configurar SSH keys ni tokens.

**No copiar `node_modules`** desde Windows — se reinstala en destino (módulos nativos como `sharp` están compilados para Windows y no sirven en Linux).

## 3. Base de datos Postgres

### Migrar los datos actuales
Ya existe un dump completo (esquema + datos reales) generado con `pg_dump`:
```
backups/vehiamb_dump_2026-07-23.sql
```
⚠️ Contiene datos sensibles reales (hashes de contraseñas, cédulas/nombres de infractores SIMIT). No subir a ningún sitio público; la carpeta `backups/` ya está en `.gitignore`.

### Restaurar en el servidor nuevo
```bash
# 1. Crear base y usuario vacíos
createdb -U postgres vehiamb
psql -U postgres -c "CREATE USER vehiamb WITH PASSWORD 'tu-password-nueva';"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE vehiamb TO vehiamb;"

# 2. Restaurar el dump
psql -U vehiamb -d vehiamb -f vehiamb_dump_2026-07-23.sql
```

### Administrar Postgres sin GUI en el servidor

**Opción A (recomendada) — pgAdmin local por túnel SSH:**
1. En pgAdmin (ya instalado en la máquina Windows con PostgreSQL 18), al crear la conexión ir a la pestaña **"SSH Tunnel"**.
2. Activarlo, poner IP del servidor + usuario/llave SSH.
3. En "Connection": `host: localhost`, `port: 5432`, usuario/contraseña de Postgres.
4. pgAdmin conecta como si la base estuviera local. Requiere que Postgres en el servidor escuche solo en `localhost` (`listen_addresses = 'localhost'` en `postgresql.conf`) — nadie externo puede tocar la base directo, solo vía SSH.

**Opción B — `psql` por SSH:**
```bash
psql -U vehiamb -d vehiamb
```
```
\dt                        -- listar tablas
\d nombre_tabla            -- ver columnas
SELECT * FROM vehiculos LIMIT 10;
UPDATE usuarios SET ... WHERE id = 5;
\q
```

## 4. Variables de entorno (`backend/.env`)

Copiar `backend/.env.example` a `backend/.env` y completar como mínimo:

| Variable | Qué poner |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `3000` (o el que se defina) |
| `DB_CLIENT` | `postgres` |
| `DATABASE_URL` | `postgres://vehiamb:tu-password-nueva@localhost:5432/vehiamb` |
| `AUTH_SECRET` | generar uno nuevo: `openssl rand -hex 32` — nunca reutilizar el de desarrollo |
| `SEED_ADMIN_PASSWORD` | contraseña fuerte real (el arranque falla en producción si detecta el valor de ejemplo) |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_NAME` | datos del admin inicial |
| `EXCEL_FILE_PATH`, `STOCK_EXCEL_FILE_PATH`, `CONFIG_EXCEL_FILE_PATH` | según lo resuelto en la Decisión 0 |
| `SMTP_HOST/PORT/USER/PASS/FROM` | credenciales SMTP reales |
| `APP_BASE_URL` | dominio real, ej. `https://vehiamb.ambientesceramicos.com` |
| `CORS_ORIGIN` | dominio real si frontend/backend quedan en orígenes distintos |

Este archivo **no viaja por git** (está en `.gitignore`) — hay que crearlo a mano en el servidor cada vez que se aprovisiona uno nuevo, y agregar ahí cualquier variable nueva que no exista todavía.

## 5. Playwright (scraper SIMIT)

```bash
cd backend
npx playwright install --with-deps chromium
```
`--with-deps` instala también las librerías del sistema que Chromium necesita en Linux. Si se usa el `Dockerfile` del repo, esto ya está resuelto ahí.

## 6. Carpeta de archivos subidos

Copiar toda `backend/uploads/` (documentos, fotos, inspecciones, etc.) preservando su estructura de subcarpetas. Con Docker Compose vive en el volumen `uploads_data` — hay que migrar ese volumen, no solo el filesystem.

## 7. Arrancar la aplicación

**Con Docker Compose:**
```bash
docker compose up -d --build
```

**Sin Docker (Node directo + systemd):**
```bash
cd backend
npm ci --omit=dev
```
Crear `/etc/systemd/system/vehiamb.service`:
```ini
[Unit]
Description=VehiAmb Backend
After=network.target

[Service]
WorkingDirectory=/ruta/al/proyecto/backend
ExecStart=/usr/bin/node server.js
Restart=always
User=tu_usuario
EnvironmentFile=/ruta/al/proyecto/backend/.env

[Install]
WantedBy=multi-user.target
```
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now vehiamb
```

## 8. Exponer a internet: Cloudflare Tunnel

### 8.1 Migrar el dominio a Cloudflare
1. Crear/entrar a [dash.cloudflare.com](https://dash.cloudflare.com) → "Add a site" → `ambientesceramicos.com` → plan Free.
2. Cloudflare escanea los registros DNS actuales. **Verificar que quedó todo** (comparar contra cPanel):

   | Nombre | Tipo | Valor |
   |---|---|---|
   | `ambientesceramicos.com` | A | `161.97.173.37` |
   | `www` | A | `161.97.173.37` |
   | `ftp` | A | `161.97.173.37` |
   | `mail` | A | `161.97.173.37` |
   | `pop` | A | `161.97.173.37` |
   | `smtp` | A | `161.97.173.37` |
   | `gestorti` | A | `190.0.241.60` |
   | `api-gestorti` | A | `190.0.241.60` |
   | `ambientesceramicos.com` | MX | `10 mail.ambientesceramicos.com` |
   | `ambientesceramicos.com` | TXT | `v=spf1 a mx ip4:161.97.173.37 ~all` |

3. **⚠️ Crítico** — dejar en "DNS only" (nube gris, sin proxy) los registros: `mail`, `smtp`, `pop`, `ftp`, MX, y probablemente `gestorti`/`api-gestorti`. Proxiar (naranja) solo `www`, el dominio raíz, y el subdominio nuevo `vehiamb`. Cloudflare proxy rompe protocolos que no sean HTTP/HTTPS (correo, FTP).
4. Copiar los 2 nameservers que asigna Cloudflare.
5. En el panel de cliente del proveedor de hosting (mismo lugar donde está el cPanel), cambiar los nameservers del dominio a los de Cloudflare.
6. Esperar a que Cloudflare confirme la zona como "Active" (minutos a 24h).

### 8.2 Crear el túnel (en el servidor, una vez la zona esté activa)
```bash
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb

cloudflared tunnel login
cloudflared tunnel create vehiamb
cloudflared tunnel route dns vehiamb vehiamb.ambientesceramicos.com
```

`~/.cloudflared/config.yml`:
```yaml
tunnel: vehiamb
credentials-file: /home/tu_usuario/.cloudflared/<ID-DEL-TUNNEL>.json

ingress:
  - hostname: vehiamb.ambientesceramicos.com
    service: http://localhost:3000
  - service: http_status:404
```

Correr como servicio:
```bash
sudo cloudflared service install
sudo systemctl enable --now cloudflared
```

## 9. Verificación post-migración

- `curl https://vehiamb.ambientesceramicos.com/api/health` → debe responder `{"status":"ok",...}`.
- Iniciar sesión con el admin sembrado.
- Probar: subir una foto/documento, generar un PDF, disparar una consulta SIMIT manual (confirma que Playwright encontró Chromium), guardar una inspección con hallazgos (confirma el correo).
- Confirmar que los crons internos (importaciones de Excel, notificaciones, SIMIT masivo) corren solos — se auto-programan dentro del propio proceso Node, no dependen de Task Scheduler.

## 10. Backups

- `pg_dump` diario:
  ```bash
  pg_dump -U vehiamb -d vehiamb > backup-$(date +%F).sql
  ```
- Backup periódico de `backend/uploads/` (rsync a otro disco/servidor).
- Guardar `.env` en un lugar seguro fuera del repo.

## 11. Corte final

- Bajar el servicio en la máquina Windows actual (Task Scheduler) solo **después** de confirmar que el servidor nuevo funciona con datos reales migrados.
- Dejar la máquina Windows como respaldo unos días por si hay que hacer rollback.

---

## Flujo normal para futuros cambios de código

```bash
# En tu máquina local
git add .
git commit -m "descripción del cambio"
git push

# En el servidor, por SSH
cd /ruta/al/proyecto
git pull
cd backend && npm ci --omit=dev   # solo si cambiaron dependencias

# Reiniciar
sudo systemctl restart vehiamb    # o: docker compose up -d --build
```

Las migraciones de base de datos son automáticas: `backend/src/database/init.js` revisa y agrega columnas/tablas nuevas cada vez que el proceso arranca, así que no hay un paso manual de "correr migración" aparte del reinicio.

**Lo que NO viaja por git** (vive solo en el servidor):
- `backend/.env`
- `backend/uploads/`
- `backups/`
