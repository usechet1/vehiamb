# Despliegue de VehiAmb en el servidor Windows

Esta guía reemplaza a `DESPLIEGUE-PASO-A-PASO.md` (esa era para un servidor
Linux). El servidor real que te dieron es **Windows**, con PostgreSQL ya
instalado, y está en la misma red local/VPN que el recurso compartido
`\\192.168.9.21\...` de donde se leen los Excel — así que las rutas UNC
funcionan directo, sin necesidad de montajes CIFS ni sincronización aparte.

Exposición a internet: **Cloudflare Tunnel** (mismo mecanismo que ya usan
`gestorti`/`api-gestorti`; el dominio `ambientesceramicos.com` ya está delegado
a los nameservers de Cloudflare).

---

## Fase 0 — Conectarte al servidor

Desde tu Windows, abre **Conexión a Escritorio remoto** (`mstsc`) y conéctate
con la IP/usuario/contraseña que te dieron. Todo lo que sigue se hace dentro de
esa sesión RDP, en una consola de **PowerShell como Administrador** (clic
derecho sobre el ícono de PowerShell → "Ejecutar como administrador").

## Fase 1 — Instalar Node.js y Git

Si el servidor tiene salida a internet, lo más simple es con `winget`
(ya viene en Windows 10/11 y Windows Server 2022):

```powershell
winget install OpenJS.NodeJS.LTS
winget install Git.Git
```

Cierra y vuelve a abrir PowerShell para que el `PATH` se actualice, y verifica:
```powershell
node -v   # v20.x o similar
npm -v
git --version
```

Si `winget` no está disponible en ese servidor, descarga los instaladores
manualmente desde [nodejs.org](https://nodejs.org) (versión LTS) y
[git-scm.com](https://git-scm.com) y corre el `.msi`/`.exe` normal.

## Fase 2 — Base de datos (Postgres compartido, ya instalado)

Este Postgres (versión 18) ya sirve a otras apps (`gestor_tareas_ti_ambientes`,
`rouc_creditos`, etc.) — usamos un usuario y base propios, aislados:

Con pgAdmin, conectado como `postgres` (superusuario), Query Tool:
```sql
CREATE USER admin_vehiamb WITH PASSWORD 'elige-una-password-fuerte';
CREATE DATABASE vehiamb OWNER admin_vehiamb;
REVOKE CONNECT ON DATABASE vehiamb FROM PUBLIC;
GRANT CONNECT ON DATABASE vehiamb TO admin_vehiamb;
```
El `REVOKE`/`GRANT` es porque por defecto Postgres le da `CONNECT` a `PUBLIC`
sobre cualquier base nueva — sin esto, cualquier otro usuario del servidor
(el de `gestorti`, `rouc_creditos`, etc.) también podría conectarse a `vehiamb`.

⚠️ Pendiente (decidido dejar para después): lo inverso también aplica — por
defecto `admin_vehiamb` puede conectarse a las otras bases existentes
(`cargues_db`, `gestor_tareas_ti_ambientes`, `gestor_tareas_ti_ambientes_prueba_solicitudes`,
`rouc_creditos`, `rouc_creditos_dev`), aunque no necesariamente pueda leer sus
tablas. Para cerrar eso del todo, conectado como `postgres`:
```sql
REVOKE CONNECT ON DATABASE cargues_db FROM PUBLIC;
REVOKE CONNECT ON DATABASE gestor_tareas_ti_ambientes FROM PUBLIC;
REVOKE CONNECT ON DATABASE gestor_tareas_ti_ambientes_prueba_solicitudes FROM PUBLIC;
REVOKE CONNECT ON DATABASE rouc_creditos FROM PUBLIC;
REVOKE CONNECT ON DATABASE rouc_creditos_dev FROM PUBLIC;
```
No rompe nada de esas apps (el dueño de cada base conserva acceso completo).

No hace falta restaurar ningún dump si es la primera vez que corre: el propio
backend crea el esquema al arrancar (`backend/src/database/init.js`). Para
migrar datos reales desde otro Postgres (ej. tu entorno local), ver
"Migración de datos" más abajo.

## Fase 3 — Traer el código

```powershell
cd C:\
git clone https://github.com/usechet1/vehiamb.git
cd vehiamb\backend
npm ci --omit=dev
npx playwright install --with-deps chromium
```
El último paso instala Chromium para el scraper de SIMIT (tarda unos minutos).

## Fase 4 — Archivo `.env`

Copia `backend\.env.example` a `backend\.env` y ábrelo con notepad:
```powershell
copy backend\.env.example backend\.env
notepad backend\.env
```
Ajusta:
```
NODE_ENV=production
PORT=3001
CORS_ORIGIN=https://vehiamb.ambientesceramicos.com

DB_CLIENT=postgres
DATABASE_URL=postgres://admin_vehiamb:LA-PASSWORD-QUE-PUSISTE@localhost:5432/vehiamb

AUTH_SECRET=GENERAR-UN-VALOR-ALEATORIO
AUTH_TOKEN_HOURS=12

SEED_ADMIN_NAME=Administrador
SEED_ADMIN_EMAIL=tu-correo-real@dominio.com
SEED_ADMIN_PASSWORD=una-password-fuerte-real
SEED_ADMIN_ROLE=Administrador

APP_BASE_URL=https://vehiamb.ambientesceramicos.com
```
Para generar `AUTH_SECRET`, en PowerShell:
```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Copia el resultado dentro del `.env`.

Como este servidor sí está en la red interna, deja las rutas de Excel tal cual
vienen en el `.env.example` (UNC directo):
```
EXCEL_FILE_PATH=\\192.168.9.21\DESPACHOS\CARGUES BODEGA.xlsm
CONFIG_EXCEL_FILE_PATH=\\192.168.9.21\automotores\CAMBIO DE ACEITE VEHICULOS (1).xlsx
STOCK_EXCEL_FILE_PATH=\\192.168.9.21\automotores\CAMBIO DE ACEITE VEHICULOS (1).xlsx
```
(Ajusta las rutas exactas si difieren de las que ya usas hoy en la máquina
actual con Task Scheduler.) La cuenta que corra el proceso Node necesita
permiso de lectura sobre ese recurso compartido — revisa la Fase 6 sobre qué
usuario ejecuta el servicio.

## Fase 5 — Probar que arranca (antes de automatizarlo)

```powershell
cd C:\vehiamb\backend
node server.js
```
Debe verse el log de arranque sin errores. En otra ventana de PowerShell:
```powershell
curl http://localhost:3001/api/health
```
Si responde `{"status":"ok",...}`, va bien. Detén con `Ctrl+C`.

## Fase 6 — Dejarlo corriendo siempre (servicio de Windows con NSSM)

Windows no tiene un equivalente directo a `systemd`; la forma estándar es
[NSSM](https://nssm.cc/) (Non-Sucking Service Manager), que envuelve cualquier
`.exe` como servicio de Windows con reinicio automático.

```powershell
winget install NSSM.NSSM
```
(o descarga el zip desde nssm.cc y copia `nssm.exe` a una carpeta del `PATH`).

```powershell
nssm install VehiAmbBackend
```
Se abre una ventana gráfica:
- **Path**: `C:\Program Files\nodejs\node.exe`
- **Startup directory**: `C:\vehiamb\backend`
- **Arguments**: `server.js`
- Pestaña **Environment**: no hace falta si usas `dotenv` (el backend ya carga
  `backend\.env` automáticamente vía `dotenv`).
- Pestaña **Log on**: si el proceso necesita leer el recurso de red
  `\\192.168.9.21\...`, configura aquí una cuenta de dominio/usuario que tenga
  permiso sobre ese share (no "Local System", que no tiene credenciales de red).

Guardar, y luego:
```powershell
nssm start VehiAmbBackend
sc query VehiAmbBackend    # debe decir RUNNING
```

## Fase 7 — nginx para Windows sirviendo el frontend

Descarga la versión Windows de nginx desde [nginx.org/en/download.html](http://nginx.org/en/download.html),
descomprime en `C:\nginx`.

Edita `C:\nginx\conf\vehiamb.conf` (e inclúyelo desde `nginx.conf` con
`include vehiamb.conf;` dentro del bloque `http {}`, o reemplaza directamente el
`server {}` por defecto):
```nginx
server {
    listen 80;
    server_name vehiamb.ambientesceramicos.com;

    root C:/vehiamb/frontend;
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
Prueba la config y corre nginx a mano primero:
```powershell
cd C:\nginx
.\nginx.exe -t
.\nginx.exe
```
Checkpoint: `http://localhost` en el navegador del servidor debe mostrar el
frontend de VehiAmb.

Para que arranque siempre con el servidor, envuélvelo también con NSSM:
```powershell
nssm install VehiAmbNginx "C:\nginx\nginx.exe"
nssm set VehiAmbNginx AppDirectory C:\nginx
nssm start VehiAmbNginx
```

⚠️ **Nota real de este servidor:** ya hay un `Caddy` corriendo en el puerto 80
(servicio `GestorTI-Caddy`, para `gestorti`/`api-gestorti`) — por eso nginx de
VehiAmb usa el puerto **8080**, no el 80, para no chocar ni tocar esa config
compartida.

## Fase 8 — Cloudflare Tunnel (versión Windows, túnel propio e independiente)

Este servidor ya tenía `cloudflared` instalado (servicio `Cloudflared`, para el
túnel de `gestorti`) en `C:\Program Files (x86)\cloudflared\cloudflared.exe`.
No lo tocamos ni compartimos su configuración — creamos un **túnel nuevo y un
servicio de Windows nuevo**, completamente aislados.

```powershell
& "C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel login
```
Abre la URL que muestra, autoriza la zona `ambientesceramicos.com` (necesitas
acceso a esa cuenta de Cloudflare — pídelo a quien administra `gestorti` si no
lo tienes).

```powershell
& "C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel create vehiamb
& "C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel route dns vehiamb vehiamb.ambientesceramicos.com
```
El primero muestra el `ID` del túnel y escribe el archivo de credenciales en
`%USERPROFILE%\.cloudflared\<ID>.json` — cópialo. El segundo crea el DNS
correcto automáticamente (un `CNAME` proxiado hacia `<id>.cfargotunnel.com`) —
no hace falta ni conviene el registro `A` manual creado antes en el panel de
SNHC (se puede borrar).

Crea `C:\cloudflared-vehiamb\config.yml` (carpeta propia, separada de la de
`gestorti`):
```yaml
tunnel: <ID-DEL-TUNEL>
credentials-file: C:\Users\<tu_usuario>\.cloudflared\<ID-DEL-TUNEL>.json

ingress:
  - hostname: vehiamb.ambientesceramicos.com
    service: http://localhost:8080
  - service: http_status:404
```
Verifica el `%USERPROFILE%` exacto con `Get-ChildItem "$env:USERPROFILE\.cloudflared\"`
antes de escribirlo — un nombre de usuario incorrecto aquí es el error más
común en este paso.

Instalar como **servicio nuevo** con NSSM (no usar `cloudflared.exe service
install`, porque esa registra el servicio genérico `Cloudflared` que ya está
tomado por el túnel de `gestorti`):
```powershell
nssm install Cloudflared-VehiAmb "C:\Program Files (x86)\cloudflared\cloudflared.exe"
nssm set Cloudflared-VehiAmb AppParameters "tunnel --config C:\cloudflared-vehiamb\config.yml run"
nssm set Cloudflared-VehiAmb AppDirectory "C:\cloudflared-vehiamb"
nssm start Cloudflared-VehiAmb
Get-Service Cloudflared-VehiAmb
```

## Fase 9 — Verificación final

```powershell
curl https://vehiamb.ambientesceramicos.com/api/health
```
Desde cualquier navegador: abrir `https://vehiamb.ambientesceramicos.com` e
iniciar sesión con el admin sembrado en el `.env`.

## Migración de datos (desde un Postgres local/otro origen)

Para llevar una base existente (ej. tu Postgres local de desarrollo) hacia
`vehiamb` en el servidor:

**1. Exportar en el origen** (ajusta usuario/base/puerto/versión reales):
```powershell
& "C:\Program Files\PostgreSQL\<version>\bin\pg_dump.exe" -U <usuario> -d <base> -h <host> -p <puerto> --no-owner --no-privileges -f "vehiamb_dump.sql"
```
`--no-owner --no-privileges` es clave: evita que el dump traiga referencias a
un rol que no existe en el servidor destino (ahí el dueño es `admin_vehiamb`).

**2. Llevar el archivo al servidor** — por el portapapeles de RDP (copiar en
el explorador local, pegar dentro de la sesión remota) si no tienes la unidad
de red configurada todavía.

**3. Restaurar en el servidor:**
```powershell
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U admin_vehiamb -d vehiamb -h localhost -f "C:\ruta\al\vehiamb_dump.sql"
```
Salen muchas líneas `CREATE TABLE`/`ALTER TABLE`/`COPY` — es normal. Solo
preocuparse por líneas que empiecen con `ERROR:` (no `NOTICE:`).

**4. Verificar** en pgAdmin como `admin_vehiamb`: `vehiamb → Schemas → public
→ Tables`, confirmar filas reales con "View/Edit Data → All Rows".

⚠️ El dump contiene datos reales sensibles — nunca subirlo a git ni a ningún
sitio público (dejarlo dentro de `backups/`, que ya está en `.gitignore`, o
borrarlo del servidor una vez confirmada la migración).

## Flujo normal para futuros cambios de código

**En tu PC local:**
```powershell
git add .
git commit -m "descripción del cambio"
git push
```

**En el servidor (RDP, PowerShell):**
```powershell
cd C:\vehiamb
git pull
cd backend
npm.cmd ci --omit=dev   # SOLO si cambiaron package.json/package-lock.json
nssm restart VehiAmbBackend
```

- Cambios solo en `frontend\` (html/js/css): no hace falta reiniciar nada —
  nginx sirve los archivos directo del disco, y ya tiene `Cache-Control:
  no-cache` puesto, así que un simple refresh del navegador basta.
- Cambios de esquema de base de datos: tampoco hay paso manual —
  `backend/src/database/init.js` revisa y agrega columnas/tablas nuevas cada
  vez que el proceso arranca, así que el `nssm restart VehiAmbBackend` ya lo
  cubre.
- Verificar después de cada despliegue:
  ```powershell
  curl https://vehiamb.ambientesceramicos.com/api/health
  ```

## Pendiente

- Revocar `CONNECT` de `PUBLIC` en las otras bases compartidas de Postgres
  (`cargues_db`, `gestor_tareas_ti_ambientes*`, `rouc_creditos*`) — ver nota en
  Fase 2, se dejó pausado a propósito.
- Backups periódicos de Postgres (`pg_dump`) y de `backend\uploads\`.
- Guardar el `.env` en un lugar seguro fuera del repo.
- Confirmar que el usuario con el que corre el servicio `VehiAmbBackend` (Fase
  6, pestaña "Log on") tiene permiso de lectura sobre
  `\\192.168.9.21\DESPACHOS` y `\\192.168.9.21\automotores`.
- Borrar el registro `A` manual viejo (`vehiamb` → IP directa) en el panel de
  SNHC — ya no aplica, el DNS real vive en Cloudflare como `CNAME` del túnel.
