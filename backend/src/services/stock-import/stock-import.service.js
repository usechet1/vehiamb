const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const HttpError = require("../../errors/http-error");
const env = require("../../config/env");
const { crearFileProvider } = require("../../providers/file-provider.factory");
const stockFileValidator = require("./stock-file-validator.service");
const stockExcelParser = require("./stock-excel-parser.service");
const stockSyncEngine = require("./stock-sync-engine.service");
const importacionesStockRepository = require("../../repositories/importaciones-stock.repository");
const incidenciasRepository = require("../../repositories/incidencias-importacion-stock.repository");
const detalleRepository = require("../../repositories/detalle-importacion-stock.repository");

function hashArchivo(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

/**
 * Orquesta el flujo completo de una importacion de stock: obtiene el Excel
 * de saldos (via el FileProvider configurado con STOCK_EXCEL_FILE_PATH), lo
 * valida, lo parsea y sincroniza contra el catalogo/stock. A diferencia del
 * pipeline de gastos vehiculares, no hay concepto de "periodo": el archivo
 * es una foto completa del saldo actual, asi que cada corrida procesa el
 * archivo entero de una vez.
 */
async function ejecutar({ usuarioId = null } = {}) {
  if (!env.stockExcelFilePath) {
    throw new HttpError(400, "STOCK_EXCEL_FILE_PATH no esta configurado");
  }

  const inicio = Date.now();
  const provider = crearFileProvider({
    sourcePath: env.stockExcelFilePath,
    retryAttempts: env.excelRetryAttempts,
    retryDelayMs: env.excelRetryDelayMs
  });

  console.log(`[StockImportService] Iniciando importacion de stock (usuario: ${usuarioId ?? "automatico"})`);

  const { path: filePath, cleanup } = await provider.getFile();

  try {
    const hash = await hashArchivo(filePath);
    const nombreArchivo = path.basename(env.stockExcelFilePath);

    const importacion = await importacionesStockRepository.create({
      nombre_archivo: nombreArchivo,
      hash_archivo: hash,
      usuario_id: usuarioId,
      estado: "en_proceso"
    });

    try {
      const validated = stockFileValidator.validate(filePath);
      const { candidates, parseErrors } = stockExcelParser.parse(validated);

      console.log(`[StockImportService] Importacion #${importacion.id}: ${candidates.length} filas candidatas, ${parseErrors.length} con error de formato`);

      const resultado = await stockSyncEngine.sincronizar({ candidates, parseErrors, importacionId: importacion.id });
      const duracionMs = Date.now() - inicio;
      const estadoFinal = resultado.totalErrores > 0 ? "completado_con_errores" : "completado";

      await importacionesStockRepository.actualizarResultado(importacion.id, {
        estado: estadoFinal,
        ...resultado,
        duracionMs,
        observaciones: null
      });

      console.log(
        `[StockImportService] Importacion #${importacion.id} ${estadoFinal} en ${duracionMs}ms: ` +
          `${resultado.totalNuevos} nuevos, ${resultado.totalActualizados} actualizados, ` +
          `${resultado.totalOmitidos} omitidos, ${resultado.totalErrores} errores`
      );

      return { importacionId: importacion.id, estado: estadoFinal, duracionMs, ...resultado };
    } catch (error) {
      const duracionMs = Date.now() - inicio;
      console.error(`[StockImportService] Importacion #${importacion.id} fallo:`, error);

      await importacionesStockRepository.actualizarResultado(importacion.id, {
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
  return importacionesStockRepository.findAll(filtros);
}

async function obtener(id) {
  const importacion = await importacionesStockRepository.findById(id);
  if (!importacion) throw new HttpError(404, "Importación de stock no encontrada");
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
  return importacionesStockRepository.findUltimaAutomatica();
}

module.exports = {
  ejecutar,
  listar,
  obtener,
  obtenerDetalle,
  obtenerIncidencias,
  resolverIncidencia,
  estadoUltimaAutomatica
};
