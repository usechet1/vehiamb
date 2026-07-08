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

function hoy() {
  return new Date().toISOString().slice(0, 10);
}

const ESTADOS_CON_HASH_VIGENTE = ["completado", "completado_con_errores", "sin_cambios"];

const MAX_DIAS_RANGO = 92;

function generarRangoFechas(desde, hasta) {
  const fechas = [];
  const cursor = new Date(`${desde}T00:00:00`);
  const fin = new Date(`${hasta}T00:00:00`);

  while (cursor <= fin) {
    fechas.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }

  if (fechas.length > MAX_DIAS_RANGO) {
    throw new HttpError(400, `El rango no puede superar ${MAX_DIAS_RANGO} dias (pediste ${fechas.length})`);
  }

  return fechas;
}

/**
 * Procesa un unico dia del Excel (ya abierto y validado) y deja el registro
 * de auditoria correspondiente. Nunca relanza el error: si un dia de un
 * rango falla, los demas dias deben poder seguir procesandose.
 */
async function ejecutarPeriodo({ periodoObjetivo, hash, nombreArchivo, validated, usuarioId }) {
  const inicioPeriodo = Date.now();

  const ultima = await importacionesRepository.findUltimaPorPeriodo(periodoObjetivo);
  if (ultima && ESTADOS_CON_HASH_VIGENTE.includes(ultima.estado) && ultima.hash_archivo === hash) {
    const sinCambios = await importacionesRepository.create({
      nombre_archivo: nombreArchivo,
      hash_archivo: hash,
      periodo: periodoObjetivo,
      usuario_id: usuarioId,
      estado: "sin_cambios"
    });

    const duracionMs = Date.now() - inicioPeriodo;
    await importacionesRepository.actualizarResultado(sinCambios.id, {
      estado: "sin_cambios",
      totalLeidos: 0,
      totalNuevos: 0,
      totalActualizados: 0,
      totalOmitidos: 0,
      totalErrores: 0,
      duracionMs,
      observaciones: "El archivo no cambio desde la ultima sincronizacion de este periodo."
    });

    console.log(`[ImportService] Importacion #${sinCambios.id} (${periodoObjetivo}): sin cambios, se omite el reprocesamiento`);

    return {
      importacionId: sinCambios.id,
      periodo: periodoObjetivo,
      estado: "sin_cambios",
      duracionMs,
      totalLeidos: 0,
      totalNuevos: 0,
      totalActualizados: 0,
      totalOmitidos: 0,
      totalErrores: 0
    };
  }

  const importacion = await importacionesRepository.create({
    nombre_archivo: nombreArchivo,
    hash_archivo: hash,
    periodo: periodoObjetivo,
    usuario_id: usuarioId,
    estado: "en_proceso"
  });

  try {
    const { candidates, parseErrors } = excelParser.parse(validated, periodoObjetivo);

    console.log(`[ImportService] Importacion #${importacion.id} (${periodoObjetivo}): ${candidates.length} filas candidatas, ${parseErrors.length} con error de formato`);

    const resultado = await syncEngine.sincronizar({ candidates, parseErrors, importacionId: importacion.id });
    const duracionMs = Date.now() - inicioPeriodo;
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

    return { importacionId: importacion.id, periodo: periodoObjetivo, estado: estadoFinal, duracionMs, ...resultado };
  } catch (error) {
    const duracionMs = Date.now() - inicioPeriodo;
    console.error(`[ImportService] Importacion #${importacion.id} (${periodoObjetivo}) fallo:`, error);

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

    return {
      importacionId: importacion.id,
      periodo: periodoObjetivo,
      estado: "fallido",
      duracionMs,
      totalLeidos: 0,
      totalNuevos: 0,
      totalActualizados: 0,
      totalOmitidos: 0,
      totalErrores: 0
    };
  }
}

function sumarTotales(resultados) {
  return resultados.reduce(
    (acc, r) => ({
      totalLeidos: acc.totalLeidos + r.totalLeidos,
      totalNuevos: acc.totalNuevos + r.totalNuevos,
      totalActualizados: acc.totalActualizados + r.totalActualizados,
      totalOmitidos: acc.totalOmitidos + r.totalOmitidos,
      totalErrores: acc.totalErrores + r.totalErrores
    }),
    { totalLeidos: 0, totalNuevos: 0, totalActualizados: 0, totalOmitidos: 0, totalErrores: 0 }
  );
}

/**
 * Si el FileProvider no pudo entregar el archivo (unidad de red no montada,
 * ruta incorrecta, o bloqueado tras agotar los reintentos), igual se deja
 * constancia en el historial de "importaciones" -- de lo contrario una falla
 * de infraestructura pasaria completamente desapercibida para el usuario.
 * No hay hash real que registrar (nunca se llego a leer el archivo).
 */
async function registrarFalloObtencionArchivo({ periodos, usuarioId, error }) {
  const nombreArchivo = env.excelFilePath ? path.basename(env.excelFilePath) : "desconocido";

  await Promise.all(
    periodos.map((periodoObjetivo) =>
      importacionesRepository
        .create({
          nombre_archivo: nombreArchivo,
          hash_archivo: "N/A",
          periodo: periodoObjetivo,
          usuario_id: usuarioId,
          estado: "fallido"
        })
        .then((importacion) =>
          importacionesRepository.actualizarResultado(importacion.id, {
            estado: "fallido",
            totalLeidos: 0,
            totalNuevos: 0,
            totalActualizados: 0,
            totalOmitidos: 0,
            totalErrores: 0,
            duracionMs: 0,
            observaciones: `No fue posible acceder al archivo de origen: ${error.message}`
          })
        )
    )
  );
}

/**
 * Orquesta el flujo completo de una importacion: obtiene el archivo (via el
 * FileProvider configurado) UNA sola vez, lo valida, y procesa uno o varios
 * dias contra esa misma copia -- cada dia deja su propio registro de
 * auditoria en "importaciones" (la granularidad diaria del esquema no
 * cambia), pero el disparo manual puede pedir un rango completo de una vez.
 * Sin importar si el origen del archivo cambia en el futuro (Drive,
 * OneDrive, API), esta capa no se toca.
 */
async function ejecutar({ periodo, desde, hasta, usuarioId = null } = {}) {
  const periodos = desde && hasta ? generarRangoFechas(desde, hasta) : [periodo || ayer()];
  const inicio = Date.now();
  const provider = crearFileProvider();

  console.log(
    `[ImportService] Iniciando importacion de ${periodos.length} periodo(s) ` +
      `(${periodos[0]}${periodos.length > 1 ? ` a ${periodos[periodos.length - 1]}` : ""}), usuario: ${usuarioId ?? "automatico"}`
  );

  let filePath;
  let cleanup;

  try {
    ({ path: filePath, cleanup } = await provider.getFile());
  } catch (error) {
    console.error("[ImportService] No fue posible obtener el archivo de origen:", error.message);
    await registrarFalloObtencionArchivo({ periodos, usuarioId, error });
    throw error;
  }

  try {
    const hash = await hashArchivo(filePath);
    const nombreArchivo = path.basename(env.excelFilePath || filePath);
    const validated = fileValidator.validate(filePath);

    const resultados = [];
    for (const periodoObjetivo of periodos) {
      resultados.push(await ejecutarPeriodo({ periodoObjetivo, hash, nombreArchivo, validated, usuarioId }));
    }

    const duracionMs = Date.now() - inicio;

    if (resultados.length === 1) {
      return { ...resultados[0], duracionMs };
    }

    return {
      desde: periodos[0],
      hasta: periodos[periodos.length - 1],
      totalDias: periodos.length,
      duracionMs,
      ...sumarTotales(resultados),
      resultados
    };
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
  ayer,
  hoy
};
