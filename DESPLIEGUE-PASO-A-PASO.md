# Despliegue de VehiAmb en el servidor SNHC (sin Docker)

Guía paso a paso para dejar VehiAmb corriendo en el servidor Linux otorgado por el
proveedor SNHC, expuesto a internet vía **Cloudflare Tunnel** (mismo mecanismo que
ya usan `gestorti`/`api-gestorti`), sin usar Docker.

Servidor: `190.0.241.60`. Dominio: `ambientesceramicos.com` (ya delegado a los
nameservers de Cloudflare — la administración de DNS se hace en
[dash.cloudflare.com](https://dash.cloudflare.com), no en el panel de SNHC).

---

## Fase 0 — Qué necesitas antes de empezar

- **IP del servidor**: `190.0.241.60`.
- **Usuario y contraseña** (o clave privada `.pem`) que dio el proveedor.
- En tu Windows no necesitas instalar nada nuevo: `ssh` ya viene incluido
  (PowerShell o Git Bash). No hace falta ninguna herramienta gráfica como Visual
  Studio Code en el servidor — todo se hace por terminal. Si quieres editar
  archivos remotos con una interfaz más cómoda, la extensión **"Remote - SSH" de
  VS Code** es opcional; con el editor de terminal `nano` alcanza.

## Fase 1 — Conectarte al servidor

```powershell
ssh tu_usuario@190.0.241.60
```
(o `ssh -i ruta\a\la\clave.pem tu_usuario@190.0.241.60` si te dieron una clave).
Si ves un prompt tipo `tu_usuario@servidor:~$`, ya estás dentro.

## Fase 2 — Preparar el sistema

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl nano
```

**Node.js 20 LTS:**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # v20.x
npm -v
```

**PostgreSQL:**
```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable --now postgresql
```

**nginx:**
```bash
sudo apt install -y nginx
sudo systemctl enable --now nginx
```
Checkpoint: abrir `http://190.0.241.60` en el navegador debe mostrar la página de
bienvenida de nginx.

## Fase 3 — Base de datos

```bash
sudo -u postgres psql
```
Dentro del prompt `postgres=#`:
```sql
CREATE USER vehiamb WITH PASSWORD 'elige-una-password-fuerte';
CREATE DATABASE vehiamb OWNER vehiamb;
\q
```
No hace falta restaurar ningún dump si es la primera vez que corre: el propio
backend crea el esquema al arrancar (`backend/src/database/init.js`). Si se va a
migrar la base de datos real existente, hacerlo aparte con `pg_dump`/`psql`.

## Fase 4 — Traer el código

```bash
cd ~
git clone https://github.com/usechet1/vehiamb.git
cd vehiamb/backend
npm ci --omit=dev
npx playwright install --with-deps chromium
```
El último paso instala Chromium y sus librerías de sistema (lo usa el scraper de
SIMIT). Tarda unos minutos.

## Fase 5 — Archivo `.env`

```bash
nano ~/vehiamb/backend/.env
```
Contenido base (ajustar los valores marcados):
```
NODE_ENV=production
PORT=3001
CORS_ORIGIN=https://vehiamb.ambientesceramicos.com

DB_CLIENT=postgres
DATABASE_URL=postgres://vehiamb:LA-PASSWORD-QUE-PUSISTE@localhost:5432/vehiamb

AUTH_SECRET=GENERAR-CON-openssl-rand-hex-32
AUTH_TOKEN_HOURS=12

SEED_ADMIN_NAME=Administrador
SEED_ADMIN_EMAIL=tu-correo-real@dominio.com
SEED_ADMIN_PASSWORD=una-password-fuerte-real
SEED_ADMIN_ROLE=Administrador

APP_BASE_URL=https://vehiamb.ambientesceramicos.com
```
Para generar `AUTH_SECRET`, salir de nano (`Ctrl+X`) y correr:
```bash
openssl rand -hex 32
```
Copiar el resultado y volver a `nano ~/vehiamb/backend/.env` para pegarlo.
Guardar en nano: `Ctrl+O`, Enter, luego `Ctrl+X` para salir.

⚠️ Dejar `EXCEL_FILE_PATH`, `CONFIG_EXCEL_FILE_PATH` y `STOCK_EXCEL_FILE_PATH`
sin definir por ahora — apuntan a una carpeta compartida de la red interna
(`\\192.168.9.21\...`) a la que este servidor remoto no tiene acceso todavía.
Pendiente decidir cómo se resuelve (montar por CIFS/VPN o sincronizar el
archivo). Sin esas variables la importación automática de Excel queda inactiva;
el resto de la app funciona igual.

## Fase 6 — Probar que arranca (antes de automatizarlo)

```bash
cd ~/vehiamb/backend
node server.js
```
Debe verse un log de "servidor escuchando en el puerto 3001" sin errores.
En otra pestaña SSH:
```bash
curl http://localhost:3001/api/health
```
Si responde `{"status":"ok",...}`, va bien. Detener con `Ctrl+C`.

## Fase 7 — Dejarlo corriendo siempre (systemd)

```bash
sudo nano /etc/systemd/system/vehiamb.service
```
```ini
[Unit]
Description=VehiAmb Backend
After=network.target postgresql.service

[Service]
WorkingDirectory=/home/tu_usuario/vehiamb/backend
ExecStart=/usr/bin/node server.js
Restart=always
User=tu_usuario
EnvironmentFile=/home/tu_usuario/vehiamb/backend/.env

[Install]
WantedBy=multi-user.target
```
(Reemplazar `tu_usuario` por el usuario real del servidor.)
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now vehiamb
sudo systemctl status vehiamb    # "active (running)"
```

## Fase 8 — nginx sirviendo el frontend

```bash
sudo nano /etc/nginx/sites-available/vehiamb
```
```nginx
server {
    listen 80;
    server_name vehiamb.ambientesceramicos.com;

    root /home/tu_usuario/vehiamb/frontend;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
    location ~* \.(?:html|js|css)$ {
        add_header Cache-Control "no-cache";
        try_files $uri =404;
    }
    location /api/ {
        proxy_pass http://localhost:3001/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    location /uploads/ {
        proxy_pass http://localhost:3001/uploads/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
```bash
sudo ln -s /etc/nginx/sites-available/vehiamb /etc/nginx/sites-enabled/
sudo nginx -t          # "syntax is ok"
sudo systemctl reload nginx
```

## Fase 9 — Cloudflare Tunnel

```bash
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb
cloudflared tunnel login
```
Da una URL para abrir en el navegador y autorizar el dominio contra la cuenta de
Cloudflare.
```bash
cloudflared tunnel create vehiamb
cloudflared tunnel route dns vehiamb vehiamb.ambientesceramicos.com
```
Este último comando crea el DNS correcto (un `CNAME` proxiado hacia
`<id>.cfargotunnel.com`) automáticamente. No usar el registro `A` manual creado
antes en el panel de SNHC — ya no aplica una vez el dominio está en Cloudflare;
se puede borrar.

```bash
nano ~/.cloudflared/config.yml
```
```yaml
tunnel: vehiamb
credentials-file: /home/tu_usuario/.cloudflared/<ID-DEL-TUNNEL>.json

ingress:
  - hostname: vehiamb.ambientesceramicos.com
    service: http://localhost:80
  - service: http_status:404
```
(El ID exacto del túnel lo muestra la salida del comando `create`.)
```bash
sudo cloudflared service install
sudo systemctl enable --now cloudflared
sudo systemctl status cloudflared    # "active (running)"
```

## Fase 10 — Verificación final

```bash
curl https://vehiamb.ambientesceramicos.com/api/health
```
Desde el navegador: abrir `https://vehiamb.ambientesceramicos.com`, iniciar
sesión con el admin sembrado en el `.env`.

## Pendiente

- Resolver el acceso a la carpeta compartida de red interna
  (`\\192.168.9.21\...`) para las importaciones de Excel — ver nota en Fase 5.
- Backups periódicos de Postgres (`pg_dump`) y de `backend/uploads/`.
- Guardar el `.env` en un lugar seguro fuera del repo.
