# Despliegue de n8n en el servidor Windows (automatización SOAT/RTM)

Instala n8n en el mismo servidor que ya corre VehiAmb (`C:\vehiamb`), como
pieza de la automatización de cargue de documentos vía WhatsApp. A
diferencia del backend de VehiAmb (que usa Tarea Programada por su
dependencia de la sesión RDP para leer `\\192.168.9.21\...`), n8n **no**
necesita esos recursos de red — solo salida a internet (WhatsApp Cloud API,
la propia API de VehiAmb en `localhost`) — así que corre como **servicio
NSSM**, igual que ya corren `VehiAmbNginx` y `Cloudflared-VehiAmb` en este
mismo servidor: más robusto, no depende de que la sesión RDP de `user2`
siga iniciada.

Expone `n8n.ambientesceramicos.com` agregando una regla de ingreso nueva al
**túnel de Cloudflare que ya existe** (`vehiamb`), apuntando directo al
puerto de n8n — sin pasar por nginx, que no cumple ningún rol para esta
pieza (nginx solo sirve el frontend estático de VehiAmb y hace proxy de
`/api`/`/uploads`).

Todo lo que sigue se hace dentro de la sesión RDP del servidor, en
PowerShell. No hace falta "Ejecutar como administrador" salvo donde se
indique explícitamente (instalar el servicio NSSM sí lo requiere).

---

## Fase 1 — Instalar n8n

Node.js y npm ya están instalados (los usa el backend). Instala n8n como
paquete global:

```powershell
npm.cmd install -g n8n
```

(Usa `npm.cmd`, no `npm`, por la misma razón de siempre en este servidor:
la política de ejecución de PowerShell bloquea el wrapper `npm.ps1`.)

Verifica dónde quedó instalado — lo vas a necesitar en la Fase 3:

```powershell
npm.cmd root -g
```

Esto imprime algo como `C:\Users\user2\AppData\Roaming\npm\node_modules`.
Guarda esa ruta — abajo aparece como `<NPM_ROOT_GLOBAL>`.n8n

Prueba rápida (sin servicio todavía, para confirmar que arranca):

```powershell
n8n
```

Debe mostrar el log de arranque de n8n y terminar con algo como
`Editor is now accessible via: http://localhost:5678/`. Abre esa URL en el
navegador del servidor — debe pedirte crear la cuenta de owner (nombre,
correo, contraseña). Créala con un correo/contraseña reales tuyos, no lo
dejes con datos de prueba. Detén con `Ctrl+C` una vez confirmado.

## Fase 2 — Carpeta de datos y variables de entorno

Crea una carpeta propia para los datos de n8n (workflows, credenciales
cifradas, ejecuciones) — así queda junto al resto de la app, fácil de
ubicar para backups futuros:

```powershell
mkdir C:\vehiamb\n8n-data
```

Genera una clave de cifrado propia (n8n la usa para cifrar las credenciales
guardadas — si cambia después de tener credenciales guardadas, esas
credenciales quedan ilegibles, así que se genera **una sola vez** y no se
vuelve a tocar):

```powershell
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

Copia el resultado — abajo aparece como `<N8N_ENCRYPTION_KEY>`.

## Fase 3 — Registrar el servicio NSSM

Abre PowerShell **como Administrador** para esta parte.

```powershell
nssm install VehiAmbN8n "C:\Program Files\nodejs\node.exe"
nssm set VehiAmbN8n AppParameters "<NPM_ROOT_GLOBAL>\n8n\bin\n8n"
nssm set VehiAmbN8n AppDirectory "<NPM_ROOT_GLOBAL>\n8n"
```

Reemplaza `<NPM_ROOT_GLOBAL>` por la ruta real que sacaste en la Fase 1
(ej. `C:\Users\user2\AppData\Roaming\npm\node_modules`).

Variables de entorno del servicio (una llamada por variable):

```powershell
nssm set VehiAmbN8n AppEnvironmentExtra `
  N8N_PORT=5678 `
  N8N_LISTEN_ADDRESS=127.0.0.1 `
  N8N_PROTOCOL=https `
  N8N_HOST=n8n.ambientesceramicos.com `
  WEBHOOK_URL=https://n8n.ambientesceramicos.com/ `
  N8N_USER_FOLDER=C:\vehiamb\n8n-data `
  N8N_ENCRYPTION_KEY=<N8N_ENCRYPTION_KEY> `
  GENERIC_TIMEZONE=America/Bogota
```

- `N8N_LISTEN_ADDRESS=127.0.0.1`: n8n solo escucha en localhost, no queda
  expuesto en la red local (`192.168.9.x`) — solo se llega a él por el
  túnel de Cloudflare (Fase 5) o localmente en el propio servidor.
- `N8N_PROTOCOL`/`N8N_HOST`/`WEBHOOK_URL`: para que n8n arme las URLs de
  sus webhooks (las que copiarás en el panel de WhatsApp más adelante) con
  el dominio público real, no con `localhost`.
- Reemplaza `<N8N_ENCRYPTION_KEY>` por el valor generado en la Fase 2.

Logs a archivo (mismo motivo que `run_backend.bat` del backend: sin esto,
un fallo de arranque no deja rastro en ningún lado):

```powershell
mkdir C:\vehiamb\n8n-data\logs
nssm set VehiAmbN8n AppStdout "C:\vehiamb\n8n-data\logs\n8n.log"
nssm set VehiAmbN8n AppStderr "C:\vehiamb\n8n-data\logs\n8n.log"
nssm set VehiAmbN8n AppRotateFiles 1
nssm set VehiAmbN8n AppRotateBytes 10485760
```

Arrancar:

```powershell
nssm start VehiAmbN8n
Get-Service VehiAmbN8n
```

## Fase 4 — Verificar que responde localmente (antes de exponerlo)

```powershell
curl http://localhost:5678/healthz
```

Debe responder `{"status":"ok"}`. Si no, revisa el log:

```powershell
Get-Content C:\vehiamb\n8n-data\logs\n8n.log -Tail 40
```

Abre `http://localhost:5678` en el navegador del servidor e inicia sesión
con la cuenta de owner que creaste en la Fase 1 — debe ser la misma
instalación (mismos workflows/credenciales), solo que ahora corriendo como
servicio en vez de en la consola.

## Fase 5 — Exponerlo con el túnel de Cloudflare ya existente

Esto reutiliza el túnel `vehiamb` creado en `DESPLIEGUE-WINDOWS.md` (Fase
8) — no se crea un túnel nuevo.

Agrega la ruta DNS para el subdominio nuevo:

```powershell
& "C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel route dns vehiamb n8n.ambientesceramicos.com
```

Edita `C:\cloudflared-vehiamb\config.yml` y agrega una entrada de
`ingress` **antes** de la línea `- service: http_status:404` (el orden
importa: `cloudflared` evalúa las reglas de arriba hacia abajo y usa la
primera que haga match):

```yaml
tunnel: <ID-DEL-TUNEL>
credentials-file: C:\Users\<tu_usuario>\.cloudflared\<ID-DEL-TUNEL>.json

ingress:
  - hostname: vehiamb.ambientesceramicos.com
    service: http://localhost:8080
  - hostname: n8n.ambientesceramicos.com
    service: http://localhost:5678
  - service: http_status:404
```

Reinicia el servicio del túnel para que tome la config nueva:

```powershell
nssm restart Cloudflared-VehiAmb
Get-Service Cloudflared-VehiAmb
```

## Fase 6 — Verificación final

```powershell
curl https://n8n.ambientesceramicos.com/healthz
```

Desde cualquier navegador: abrir `https://n8n.ambientesceramicos.com` e
iniciar sesión con la cuenta de owner. Debe verse el editor de n8n normal,
servido con HTTPS real (Cloudflare termina el TLS, igual que ya hace para
`vehiamb.ambientesceramicos.com`).

## Para reiniciar tras un cambio de configuración

```powershell
nssm restart VehiAmbN8n
Get-Service VehiAmbN8n
```

## Pendiente (fases futuras del proyecto de automatización)

- Configurar el webhook entrante de WhatsApp Business Cloud API apuntando
  a `https://n8n.ambientesceramicos.com/webhook/...` (se genera la URL
  exacta al crear el nodo "WhatsApp Trigger" — o un Webhook genérico — en
  el workflow de n8n).
- Diseñar el workflow de n8n: WhatsApp Trigger → descargar media → llamar
  `POST /api/automation/extraer/soat` o `/extraer/tecnomecanica` (ya
  desplegados, ver Fases 1-2 del proyecto de automatización) → llamar
  `POST /api/automation/documentos` con los campos resultantes → responder
  confirmación por WhatsApp. Las credenciales HTTP para llamar a la API de
  VehiAmb desde n8n van en el header `X-Automation-Key` con el valor de
  `AUTOMATION_API_KEY` del `.env` del backend.
