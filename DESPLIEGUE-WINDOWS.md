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

## Fase 6 — Dejarlo corriendo siempre

⚠️ **Decisión real tomada en este servidor:** se intentó primero un servicio de
Windows con [NSSM](https://nssm.cc/) (`nssm install VehiAmbBackend`, con
"Log on" apuntando a una cuenta con permiso sobre `\\192.168.9.21\...`). No
funcionó: un servicio de Windows corre en una sesión aislada sin credenciales
de red, aunque la misma cuenta sí tenga acceso interactivo por RDP/Explorador
(Windows autentica la red por sesión, no por cuenta). Sincronizar la
contraseña de una cuenta local (`Administrador`) entre este servidor y
`192.168.9.21` para que el servicio pudiera loguearse fue engorroso y frágil.

**Se optó por Task Scheduler en modo "solo si el usuario ha iniciado sesión"**
— igual que la máquina de producción vieja — porque así el proceso hereda el
acceso de red de la sesión RDP ya autenticada, sin sincronizar contraseñas.
Contrapartida: el proceso se detiene si la sesión RDP se cierra del todo (no
si solo se minimiza/desconecta visualmente).

Crea el script que arranca el backend:
```powershell
notepad C:\vehiamb\backend\run_backend.bat
```
```bat
@echo off
cd /d C:\vehiamb\backend
if not exist logs mkdir logs
if exist logs\backend.prev.log del logs\backend.prev.log
if exist logs\backend.log move /y logs\backend.log logs\backend.prev.log >nul
node server.js >> logs\backend.log 2>&1
```

`>> logs\backend.log 2>&1` guarda salida y errores en un archivo. Sin esto, la
consola del backend no existe en ningún lado y sus errores se pierden — que es
exactamente cómo un fallo de migración en el arranque pasó desapercibido
(la app respondía normal, pero un permiso recién agregado nunca se creó).

Las tres líneas de rotación conservan el log del arranque anterior en
`backend.prev.log` antes de empezar uno nuevo, para que reiniciar no borre la
evidencia de por qué se cayó. Solo rota entre arranques: si el proceso corre
meses sin reiniciarse, `backend.log` crece sin límite y conviene vaciarlo a
mano de vez en cuando.

Crea la tarea programada (ajusta `user2` a tu usuario real de RDP):
```powershell
schtasks /create /tn "VehiAmbBackend" /tr "C:\vehiamb\backend\run_backend.bat" /sc onlogon /ru user2 /it /rl highest
schtasks /run /tn "VehiAmbBackend"
```
`/it` es la clave — hace que la tarea use el token interactivo de la sesión
(hereda su red) en vez de credenciales guardadas.

Verifica:
```powershell
Get-Process node -ErrorAction SilentlyContinue
curl http://localhost:3001/api/health
```

Para reiniciar tras un cambio de código (reemplaza al `nssm restart` de antes),
usa el script `scripts/restart-backend.ps1` en vez de los comandos sueltos:
```powershell
cd C:\vehiamb\backend
powershell -ExecutionPolicy Bypass -File .\scripts\restart-backend.ps1
```
Hace las tres cosas que hay que hacer en orden — parar la tarea, matar el
`node.exe` que quede colgado del puerto (identificándolo por su línea de
comandos, sin tocar otros procesos Node de la máquina), volver a arrancar — y
al final confirma con `/api/health` que sí quedó respondiendo, en vez de
asumirlo.

Si preferís los comandos sueltos, el equivalente manual es:
```powershell
schtasks /end /tn "VehiAmbBackend"
schtasks /run /tn "VehiAmbBackend"
```

⚠️ **El `/end` es obligatorio, y hay que verificar que surtió efecto.**
`schtasks /run` sobre una tarea que ya está corriendo no la reinicia, y
`/end` no siempre alcanza a matar el `node.exe` hijo. El síntoma es
desconcertante: la carpeta ya tiene el código nuevo (`git log` lo confirma)
pero el proceso en memoria sigue ejecutando el viejo, así que los cambios
"no se aplican" sin ningún error a la vista. Verifica que el puerto quedó
libre antes de arrancar de nuevo:
```powershell
schtasks /end /tn "VehiAmbBackend"
Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue | Select-Object OwningProcess
# si todavía devuelve un PID:  Stop-Process -Id <PID> -Force
schtasks /run /tn "VehiAmbBackend"
```

**No mates procesos `node` a ciegas.** En este servidor conviven otras
herramientas Node (CLIs, etc.) y todas se ven igual en `Get-Process node`
—mismo nombre, mismo `Path`—. Lo que las distingue es la línea de comandos:
```powershell
$p3001 = (Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue).OwningProcess
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Select-Object `
  @{N='PID';E={$_.ProcessId}}, @{N='Arranco';E={$_.CreationDate}}, `
  @{N='Puerto3001';E={if ($p3001 -contains $_.ProcessId) {'SI'} else {'no'}}}, `
  @{N='Comando';E={$_.CommandLine}} | Format-List
```
El backend es el que muestra `server.js` y `Puerto3001 : SI`.

Para revisar los logs después de un arranque:
```powershell
Get-Content C:\vehiamb\backend\logs\backend.log -Tail 40
Get-Content C:\vehiamb\backend\logs\backend.log -Wait   # en vivo
```
Un arranque sano termina con `Columnas PostgreSQL verificadas`. Si en cambio
aparece `[init] Fallo una migracion de Postgres`, el stack indica el paso
exacto; el arranque continúa igual y siembra permisos y usuarios, y la
migración pendiente se reintenta sola en el siguiente arranque.

Para auditar quién recibe cada alerta (y detectar permisos sin sembrar):
```powershell
cd C:\vehiamb\backend
node scripts/destinatarios-notificaciones.js
```

Si en el futuro se resuelve el acceso de red con una cuenta dedicada de bajo
privilegio (en vez de depender de la sesión RDP), se puede volver a NSSM sin
problema — el service ya quedó creado, solo deshabilitado
(`sc.exe config VehiAmbBackend start= disabled`).

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
schtasks /end /tn "VehiAmbBackend"
schtasks /run /tn "VehiAmbBackend"
```

- Cambios solo en `frontend\` (html/js/css): no hace falta reiniciar nada —
  nginx sirve los archivos directo del disco, y ya tiene `Cache-Control:
  no-cache` puesto, así que un simple refresh del navegador basta.
- Cambios de esquema de base de datos: tampoco hay paso manual —
  `backend/src/database/init.js` revisa y agrega columnas/tablas nuevas cada
  vez que el proceso arranca, así que el reinicio de la tarea ya lo cubre.
- Verificar después de cada despliegue:
  ```powershell
  curl https://vehiamb.ambientesceramicos.com/api/health
  ```

## Pendiente

- Revocar `CONNECT` de `PUBLIC` en las otras bases compartidas de Postgres
  (`cargues_db`, `gestor_tareas_ti_ambientes*`, `rouc_creditos*`) — ver nota en
  Fase 2, se dejó pausado a propósito.
- ~~Backups periódicos de Postgres (`pg_dump`) y de `backend\uploads\`~~ —
  automatizado (`backend/src/jobs/backup.job.js`, corre solo mientras el
  backend esté vivo). Falta definir `BACKUP_DIR` en el `.env` del servidor
  apuntando a un disco/recurso de red distinto al de la base de datos — sin
  eso, cae en una carpeta local que no protege contra una falla de disco.
- Guardar el `.env` en un lugar seguro fuera del repo.
- El backend depende de que la sesión RDP de `user2` se mantenga iniciada
  (Fase 6, Task Scheduler) para conservar el acceso a
  `\\192.168.9.21\DESPACHOS` y `\\192.168.9.21\automotores`. Si se cierra esa
  sesión por completo, el backend se detiene — considerar en el futuro una
  cuenta de servicio dedicada de bajo privilegio para volver a un servicio
  NSSM real (más robusto para un servidor 24/7).
- Borrar el registro `A` manual viejo (`vehiamb` → IP directa) en el panel de
  SNHC — ya no aplica, el DNS real vive en Cloudflare como `CNAME` del túnel.
