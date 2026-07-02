const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const HttpError = require("../../errors/http-error");
const env = require("../../config/env");
const { crearFileProvider } = require("../../providers/file-provider.factory");
const fileValidator = require("./file-validator.service");
const excelParser = require("./excel-parser.service");
const syncEngine = require("./sync-engine.service");
const importacionesRepository = require("../../repositories/importaciones.repository");
const incidenciasRepository = require("../../repositories/incidencias-importacion.repository");
const detalleRepository = require("../../repositories/detalle-importacion.repository");

function hashArchivo(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

function ayer() {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() - 1);
  return fecha.toISOString().slice(0, 10);
}

/**
 * Orquesta el flujo completo de una importacion: obtiene el archivo (via el
 * FileProvider configurado), lo valida, lo parsea, sincroniza los registros
 * y deja todo registrado en las tablas de auditoria -- sin importar si el
 * origen del archivo cambia en el futuro (Drive, OneDrive, API), esta capa
 * no se toca.
 */
async function ejecutar({ periodo, usuarioId = null } = {}) {
  const periodoObjetivo = periodo || ayer();
  const inicio = Date.now();
  const provider = crearFileProvider();

  console.log(`[ImportService] Iniciando importacion del periodo ${periodoObjetivo} (usuario: ${usuarioId ?? "automatico"})`);

  const { path: filePath, cleanup } = await provider.getFile();

  try {
    const hash = await hashArchivo(filePath);
    const nombreArchivo = path.basename(env.excelFilePath || filePath);

    const importacion = await importacionesRepository.create({
      nombre_archivo: nombreArchivo,
      hash_archivo: hash,
      periodo: periodoObjetivo,
      usuario_id: usuarioId,
      estado: "en_proceso"
    });

    try {
      const validated = fileValidator.validate(filePath);
      const { candidates, parseErrors } = excelParser.parse(validated, periodoObjetivo);

      console.log(`[ImportService] Importacion #${importacion.id}: ${candidates.length} filas candidatas, ${parseErrors.length} con error de formato`);

      const resultado = await syncEngine.sincronizar({ candidates, parseErrors, importacionId: importacion.id });
      const duracionMs = Date.now() - inicio;
      const estadoFinal = resultado.totalErrores > 0 ? "completado_con_errores" : "completado";

      await importacionesRepository.actualizarResultado(importacion.id, {
        estado: estadoFinal,
        ...resultado,
        duracionMs,
        observaciones: null
      });

      console.log(
        `[ImportService] Importacion #${importacion.id} ${estadoFinal} en ${duracionMs}ms: ` +
          `${resultado.totalNuevos} nuevos, ${resultado.totalActualizados} actualizados, ` +
          `${resultado.totalOmitidos} omitidos, ${resultado.totalErrores} errores`
      );

      return { importacionId: importacion.id, estado: estadoFinal, duracionMs, ...resultado };
    } catch (error) {
      const duracionMs = Date.now() - inicio;
      console.error(`[ImportService] Importacion #${importacion.id} fallo:`, error);

      await importacionesRepository.actualizarResultado(importacion.id, {
        estado: "fallido",
        totalLeidos: 0,
        totalNuevos: 0,
        totalActualizados: 0,
        totalOmitidos: 0,
        totalErrores: 0,
        duracionMs,
        observaciones: error.message
      });

      throw error;
    }
  } finally {
    await cleanup();
  }
}

async function listar(filtros) {
  return importacionesRepository.findAll(filtros);
}

async function obtener(id) {
  const importacion = await importacionesRepository.findById(id);
  if (!importacion) throw new HttpError(404, "Importacion no encontrada");
  return importacion;
}

async function obtenerDetalle(id, filtros) {
  await obtener(id);
  return detalleRepository.findByImportacion(id, filtros);
}

async function obtenerIncidencias(id, filtros) {
  await obtener(id);
  return incidenciasRepository.findByImportacion(id, filtros);
}

async function resolverIncidencia(id, usuarioId) {
  const incidencia = await incidenciasRepository.findById(id);
  if (!incidencia) throw new HttpError(404, "Incidencia no encontrada");

  await incidenciasRepository.resolver(id, usuarioId);
  return incidenciasRepository.findById(id);
}

async function estadoUltimaAutomatica() {
  return importacionesRepository.findUltimaAutomatica();
}

module.exports = {
  ejecutar,
  listar,
  obtener,
  obtenerDetalle,
  obtenerIncidencias,
  resolverIncidencia,
  estadoUltimaAutomatica,
  ayer
};
