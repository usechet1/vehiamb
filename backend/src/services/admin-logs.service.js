const db = require("../database/query");
const logsAccesoRepository = require("../repositories/logs-acceso.repository");
const logsRegistroRepository = require("../repositories/logs-registro.repository");
const logsErroresRepository = require("../repositories/logs-errores.repository");
const importacionesRepository = require("../repositories/importaciones.repository");
const notificacionesRepository = require("../repositories/notificaciones.repository");

const PERMISO_SUPER_ADMIN = "empresas.switch";

// Modulos cuyo timestamp de creacion ya existe en sus propias tablas -- no se
// loguea cada request HTTP para calcular "mas usados", se agregan estas
// columnas que ya existen (ver init.js). tabla -> { columnaFecha }.
const MODULOS_ACTIVIDAD = [
  { modulo: "mantenimientos", tabla: "mantenimientos", columnaFecha: "created_at" },
  { modulo: "documentos", tabla: "documentos", columnaFecha: "created_at" },
  { modulo: "viajes", tabla: "viajes", columnaFecha: "creado_en" },
  { modulo: "entregas_recibidas", tabla: "entregas_recibidas", columnaFecha: "creado_en" },
  { modulo: "asignaciones_ruta", tabla: "asignaciones_ruta", columnaFecha: "creado_en" },
  { modulo: "inspecciones_preventivas", tabla: "inspecciones_preventivas", columnaFecha: "creado_en" },
  { modulo: "preoperacionales", tabla: "preoperacionales", columnaFecha: "creado_en" },
  { modulo: "simit_consultas", tabla: "simit_consultas", columnaFecha: "created_at" }
];

function rangoPorDefecto(filters = {}) {
  const hasta = filters.hasta || new Date().toISOString().slice(0, 10);
  const desdeDefecto = new Date();
  desdeDefecto.setDate(desdeDefecto.getDate() - 29);
  const desde = filters.desde || desdeDefecto.toISOString().slice(0, 10);
  return { desde, hasta };
}

async function listAccesos(filters, empresaId) {
  return logsAccesoRepository.findAll(filters, empresaId);
}

async function listRegistro(filters, empresaId) {
  return logsRegistroRepository.findAll(filters, empresaId);
}

async function listErrores(filters, empresaId) {
  return logsErroresRepository.findAll(filters, empresaId);
}

async function listNotificaciones(filters, empresaId) {
  return notificacionesRepository.findAllEmpresa(filters, empresaId);
}

async function modulosMasUsados(desde, hasta, empresaId) {
  const consultas = MODULOS_ACTIVIDAD.map(
    ({ modulo, tabla, columnaFecha }) => `
      SELECT '${modulo}' AS modulo, COUNT(*) AS total
      FROM ${tabla}
      WHERE empresa_id = ? AND ${columnaFecha} >= ? AND ${columnaFecha} < (?::date + INTERVAL '1 day')
    `
  );

  const values = MODULOS_ACTIVIDAD.flatMap(() => [empresaId, desde, hasta]);

  const filas = await db.all(`${consultas.join(" UNION ALL ")} ORDER BY total DESC`, values);
  return filas.map((fila) => ({ modulo: fila.modulo, total: Number(fila.total || 0) }));
}

async function getMetricas(filters, { empresaId, permisos = [] } = {}) {
  const { desde, hasta } = rangoPorDefecto(filters);

  const [loginsPorDia, usuariosActivos, erroresPorDia, modulos, ultimasImportaciones] = await Promise.all([
    logsAccesoRepository.contarLoginsPorDia(desde, hasta, empresaId),
    logsAccesoRepository.contarUsuariosActivos(desde, hasta, empresaId),
    logsErroresRepository.contarErroresPorDia(desde, hasta, empresaId),
    modulosMasUsados(desde, hasta, empresaId),
    importacionesRepository.findAll({ page: 1, limit: 5 }, empresaId)
  ]);

  const metricas = {
    rango: { desde, hasta },
    uso: {
      logins_por_dia: loginsPorDia.map((f) => ({ fecha: f.fecha, total: Number(f.total || 0) })),
      usuarios_activos: usuariosActivos,
      modulos_mas_usados: modulos
    },
    salud: {
      errores_por_dia: erroresPorDia.map((f) => ({ fecha: f.fecha, total: Number(f.total || 0) })),
      ultimas_sincronizaciones: ultimasImportaciones.items
    }
  };

  if (permisos.includes(PERMISO_SUPER_ADMIN)) {
    const row = await db.get("SELECT COUNT(*) AS total FROM empresas WHERE activo = TRUE");
    metricas.empresas_activas = Number(row?.total || 0);
  }

  return metricas;
}

module.exports = { listAccesos, listRegistro, listErrores, listNotificaciones, getMetricas };
