/**
 * Lista los usuarios de la instalacion y, sobre todo, QUIENES reciben cada
 * tipo de alerta automatica.
 *
 * Existe porque "a quien le llega esta notificacion" no se puede responder
 * mirando una sola tabla: el destinatario no se guarda en ningun lado, se
 * resuelve en tiempo de ejecucion como "todos los usuarios activos, de la
 * misma empresa, cuyo rol tenga el permiso X" (ver notificarUsuariosConPermiso
 * en services/notificaciones.service.js). Este script reproduce esa misma
 * consulta para poder auditarla sin tener que disparar una alerta de verdad.
 *
 * Uso, desde la carpeta backend/:
 *   node scripts/destinatarios-notificaciones.js
 */

const db = require("../src/database/query");
const notifConfig = require("../src/config/notificaciones.config");
const notificacionesService = require("../src/services/notificaciones.service");

// Permiso que decide el destinatario de cada alerta, tal como lo pasa cada
// job/servicio a notificarUsuariosConPermiso. Si se agrega una alerta nueva,
// agregar aca su permiso para que quede auditada.
const ALERTAS = [
  ["Inspección preventiva con hallazgos", "inspections.alertas_hallazgos", "notificaciones.service.js"],
  ["Vencimiento de documentos (SOAT, RTM, seguro)", "documents.alertas_vencimiento", "documentos-vencimiento.job.js"],
  ["Mantenimientos próximos", "maintenance.view", "mantenimientos-proximos.job.js"],
  ["Cambio de aceite preventivo", "maintenance.view", "preventivo-cambio-aceite.job.js"],
  ["Mantenimiento pendiente de aprobación", "maintenance.approve", "notificaciones.service.js"],
  ["Comparendos SIMIT", "simit.view", "simit.service.js"],
  ["Alertas de stock", "inventory.view", "stock-alertas.job.js"],
  ["Acta de entrega/recibido registrada", "vehicles.edit", "entregas-recibidas.service.js"],
  ["Gestión de usuarios", "users.manage", "notificaciones.service.js"]
];

// Se importan de donde viven de verdad, para que la auditoria no mienta si
// manana cambian: los roles que quedan fuera del reparto automatico y los
// que no reciben correo/WhatsApp.
const ROLES_EXCLUIDOS = notificacionesService.ROLES_SIN_NOTIFICACION_AUTOMATICA;
const ROLES_SIN_CANALES_EXTERNOS = notifConfig.ROLES_SIN_CANALES_EXTERNOS;

function formatearUsuario(usuario) {
  const contacto = usuario.celular
    ? `${usuario.email} / ${usuario.celular}`
    : `${usuario.email} / (sin celular: no recibe WhatsApp)`;
  return `${(usuario.rol || "SIN ROL").padEnd(20)} ${usuario.nombre.padEnd(30)} ${contacto}`;
}

async function listarUsuarios() {
  const usuarios = await db.all(`
    SELECT u.nombre, u.email, u.celular, u.activo, u.empresa_id,
           r.nombre AS rol, e.nombre AS empresa
    FROM usuarios u
    LEFT JOIN roles r ON r.id = u.role_id
    LEFT JOIN empresas e ON e.id = u.empresa_id
    ORDER BY u.empresa_id, r.nombre, u.nombre
  `);

  console.log("═══════════════ USUARIOS ═══════════════");

  let empresaActual = null;
  usuarios.forEach((usuario) => {
    if (usuario.empresa_id !== empresaActual) {
      empresaActual = usuario.empresa_id;
      console.log(`\n── ${usuario.empresa || "(sin empresa)"} ──`);
    }
    const estado = usuario.activo ? "activo  " : "INACTIVO";
    console.log(`  ${estado} ${formatearUsuario(usuario)}`);
  });

  const activos = usuarios.filter((usuario) => usuario.activo).length;
  console.log(`\nTotal: ${usuarios.length} usuarios (${activos} activos)`);
}

async function listarDestinatarios() {
  const empresas = await db.all("SELECT id, nombre FROM empresas ORDER BY id");

  console.log("\n═══════════ DESTINATARIOS DE CADA ALERTA ═══════════");

  for (const empresa of empresas) {
    console.log(`\n████ ${empresa.nombre} ████`);

    for (const [descripcion, permiso, origen] of ALERTAS) {
      const destinatarios = await db.all(
        `
          SELECT DISTINCT u.nombre, u.email, u.celular, r.nombre AS rol
          FROM usuarios u
          INNER JOIN roles r ON r.id = u.role_id
          INNER JOIN roles_permisos rp ON rp.role_id = r.id
          INNER JOIN permisos p ON p.id = rp.permiso_id
          WHERE p.codigo = ?
            AND u.activo = TRUE
            AND r.activo = TRUE
            AND u.empresa_id = ?
          ORDER BY r.nombre, u.nombre
        `,
        [permiso, empresa.id]
      );

      const finales = destinatarios.filter((usuario) => !ROLES_EXCLUIDOS.includes(usuario.rol));

      console.log(`\n  ${descripcion}`);
      console.log(`    permiso: ${permiso}   ·   origen: ${origen}`);
      if (!finales.length) {
        console.log("    ⚠  NADIE la recibe");
        continue;
      }
      finales.forEach((usuario) => {
        const externos = ROLES_SIN_CANALES_EXTERNOS.includes(usuario.rol) ? "  [solo in-app]" : "";
        console.log(`    - ${formatearUsuario(usuario)}${externos}`);
      });
    }
  }
}

(async () => {
  await listarUsuarios();
  await listarDestinatarios();
  console.log(`\nRoles excluidos del reparto automático: ${ROLES_EXCLUIDOS.join(", ")}`);
  process.exit(0);
})().catch((error) => {
  console.error("ERROR:", error.message);
  process.exit(1);
});
