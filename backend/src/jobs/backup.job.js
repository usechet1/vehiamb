const cron = require("node-cron");
const path = require("path");
const fs = require("fs/promises");
const { spawn } = require("child_process");
const env = require("../config/env");

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

// robocopy usa codigos 0-7 para exito (bits que describen que tipo de
// cambio hizo: copio archivos, elimino extras, etc.) -- solo 8+ es una falla
// real. pg_dump usa la convencion normal (0 = exito).
function ejecutarComando(comando, args) {
  return new Promise((resolve, reject) => {
    const proceso = spawn(comando, args);
    let stderr = "";

    proceso.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    proceso.on("error", reject);

    proceso.on("close", (code) => {
      const esRobocopy = comando.toLowerCase().includes("robocopy");
      const exitoso = esRobocopy ? code < 8 : code === 0;
      if (!exitoso) {
        reject(new Error(stderr.trim() || `"${comando}" termino con codigo ${code}`));
        return;
      }
      resolve();
    });
  });
}

// Dump completo de Postgres (schema + datos) en un archivo .sql con fecha en
// el nombre -- se pasa la connection string completa a pg_dump en vez de
// desarmarla en host/usuario/clave por separado, mismo mecanismo documentado
// en DESPLIEGUE-WINDOWS.md para la migracion entre servidores.
async function respaldarBaseDeDatos(destino) {
  const archivo = path.join(destino, `vehiamb_${timestamp()}.sql`);
  await ejecutarComando(env.pgDumpPath, [env.databaseUrl, "--no-owner", "--no-privileges", "-f", archivo]);
  return archivo;
}

// Espejo (no copia incremental por fecha) de uploads/ en el destino: refleja
// siempre el estado actual, incluyendo archivos borrados desde el ultimo
// backup. No se versiona por dia porque uploads/ puede pesar mucho mas que
// los .sql y crecer sin control si se duplicara completo cada vez -- el
// historial punto-en-el-tiempo lo cubren los dumps de la base de datos.
async function respaldarUploads(destino) {
  const origen = path.resolve(__dirname, "..", "..", "uploads");
  const destinoUploads = path.join(destino, "uploads");
  await ejecutarComando("robocopy", [origen, destinoUploads, "/MIR", "/NFL", "/NDL", "/NJH", "/NJS"]);
}

async function limpiarDumpsAntiguos(destino, diasRetencion) {
  const limite = Date.now() - diasRetencion * 24 * 60 * 60 * 1000;
  const archivos = await fs.readdir(destino);

  await Promise.all(
    archivos
      .filter((nombre) => nombre.startsWith("vehiamb_") && nombre.endsWith(".sql"))
      .map(async (nombre) => {
        const ruta = path.join(destino, nombre);
        const info = await fs.stat(ruta);
        if (info.mtimeMs < limite) await fs.unlink(ruta);
      })
  );
}

async function ejecutarBackup() {
  await fs.mkdir(env.backupDir, { recursive: true });
  await respaldarBaseDeDatos(env.backupDir);
  await respaldarUploads(env.backupDir);
  await limpiarDumpsAntiguos(env.backupDir, env.backupRetencionDias);
}

/**
 * Corre todos los dias a la hora configurada (BACKUP_SCHEDULE, default 1 AM,
 * antes que el resto de jobs nocturnos). Si falla, queda en el log del
 * servidor y el proceso sigue vivo -- no bloquea la app, pero el fallo no
 * queda visible en ningun otro lado, asi que conviene revisar el log del
 * servidor periodicamente o redirigir su salida a un archivo.
 */
function start() {
  if (!cron.validate(env.backupSchedule)) {
    console.error(`[BackupJob] BACKUP_SCHEDULE invalido: "${env.backupSchedule}". El scheduler no se inicio.`);
    return null;
  }

  const task = cron.schedule(
    env.backupSchedule,
    async () => {
      console.log(`[BackupJob] Iniciando backup (${new Date().toISOString()})`);

      try {
        await ejecutarBackup();
        console.log(`[BackupJob] Backup completado en ${env.backupDir}`);
      } catch (error) {
        console.error("[BackupJob] El backup fallo:", error.message);
      }
    },
    { timezone: env.importTimezone }
  );

  console.log(`[BackupJob] Programado con cron "${env.backupSchedule}" -> ${env.backupDir}`);
  return task;
}

module.exports = { start, ejecutarBackup };
