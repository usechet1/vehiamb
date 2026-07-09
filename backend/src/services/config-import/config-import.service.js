const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const XLSX = require("xlsx");
const HttpError = require("../../errors/http-error");
const env = require("../../config/env");
const { crearFileProvider } = require("../../providers/file-provider.factory");
const configExcelParser = require("./config-excel-parser.service");
const vehiculosRepository = require("../../repositories/vehiculos.repository");
const repuestosRepository = require("../../repositories/repuestos.repository");
const vehiculoRepuestosSugeridosRepository = require("../../repositories/vehiculo-repuestos-sugeridos.repository");
const equivalenciasRepository = require("../../repositories/repuestos-equivalencias.repository");
const importacionesConfigRepository = require("../../repositories/importaciones-config-vehiculos.repository");

const HOJA_KITS = "CAMBIO DE ACEITE VEHICULOS ";
const HOJA_VEHICULOS = "VEHICULOS ";
const MAX_INCIDENCIAS_GUARDADAS = 200;

function hashArchivo(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

async function resolverRepuestoCache(cache, codigoInterno) {
  if (cache.has(codigoInterno)) return cache.get(codigoInterno);
  const repuesto = await repuestosRepository.findByCodigoInterno(codigoInterno);
  cache.set(codigoInterno, repuesto || null);
  return repuesto || null;
}

async function resolverVehiculoCache(cache, placa) {
  if (cache.has(placa)) return cache.get(placa);
  const vehiculo = await vehiculosRepository.findByPlaca(placa);
  cache.set(placa, vehiculo || null);
  return vehiculo || null;
}

/**
 * Registra en el historial una corrida que nunca llego a leer el archivo
 * (unidad de red no disponible, ruta incorrecta, bloqueado tras agotar
 * reintentos) -- igual criterio que import.service.js/stock-import.service.js:
 * mejor un registro "fallido" visible que un error silencioso.
 */
async function registrarFalloObtencionArchivo({ nombreArchivo, usuarioId, error, duracionMs }) {
  return importacionesConfigRepository.create({
    nombre_archivo: nombreArchivo,
    hash_archivo: null,
    usuario_id: usuarioId,
    estado: "fallido",
    total_incidencias: 1,
    detalle_incidencias: [{ hoja: "archivo", motivo: "no_disponible", valor: error.message }],
    duracion_ms: duracionMs
  });
}

/**
 * Importador bootstrap (sin sincronizacion incremental, sin concepto de
 * "periodo"): lee las hojas "CAMBIO DE ACEITE VEHICULOS " y "VEHICULOS " del
 * Excel de configuracion (via el FileProvider apuntado a CONFIG_EXCEL_FILE_PATH)
 * y crea vehiculo_repuestos_sugeridos + repuestos_equivalencias que aun no
 * existan. Nunca pisa lo que el usuario ya haya configurado a mano
 * (ON CONFLICT DO NOTHING en ambas tablas) y nunca bloquea por una fila
 * problematica: placas/codigos no reconocidos quedan como incidencia y se
 * sigue con el resto del archivo. Se dispara por cron (config-sync.job.js) o
 * manualmente desde POST /api/config-import/vehiculos-repuestos.
 */
async function ejecutar({ usuarioId = null } = {}) {
  if (!env.configExcelFilePath) {
    throw new HttpError(400, "CONFIG_EXCEL_FILE_PATH no esta configurado");
  }

  const inicio = Date.now();
  const provider = crearFileProvider({
    sourcePath: env.configExcelFilePath,
    retryAttempts: env.excelRetryAttempts,
    retryDelayMs: env.excelRetryDelayMs
  });
  const nombreArchivo = path.basename(env.configExcelFilePath);

  console.log(`[ConfigImportService] Iniciando importacion de configuracion (usuario: ${usuarioId ?? "automatico"})`);

  let filePath;
  let cleanup;

  try {
    ({ path: filePath, cleanup } = await provider.getFile());
  } catch (error) {
    console.error("[ConfigImportService] No fue posible obtener el archivo de origen:", error.message);
    await registrarFalloObtencionArchivo({ nombreArchivo, usuarioId, error, duracionMs: Date.now() - inicio });
    throw error;
  }

  try {
    return await procesarArchivo({ filePath, nombreArchivo, usuarioId, inicio });
  } finally {
    await cleanup();
  }
}

async function procesarArchivo({ filePath, nombreArchivo, usuarioId, inicio }) {
  let hash;
  let workbook;

  try {
    hash = await hashArchivo(filePath);
    workbook = XLSX.readFile(filePath, { cellDates: true });
  } catch (error) {
    const duracionMs = Date.now() - inicio;
    console.error("[ConfigImportService] No fue posible leer el archivo Excel:", error.message);
    await importacionesConfigRepository.create({
      nombre_archivo: nombreArchivo,
      hash_archivo: hash ?? null,
      usuario_id: usuarioId,
      estado: "fallido",
      total_incidencias: 1,
      detalle_incidencias: [{ hoja: "archivo", motivo: "error_lectura", valor: error.message }],
      duracion_ms: duracionMs
    });
    throw new HttpError(422, `No fue posible abrir el archivo Excel: ${error.message}`);
  }

  try {
    return await sincronizarConfiguracion({ workbook, hash, nombreArchivo, usuarioId, inicio });
  } catch (error) {
    const duracionMs = Date.now() - inicio;
    console.error("[ConfigImportService] La importacion fallo:", error);

    await importacionesConfigRepository.create({
      nombre_archivo: nombreArchivo,
      hash_archivo: hash,
      usuario_id: usuarioId,
      estado: "fallido",
      total_incidencias: 1,
      detalle_incidencias: [{ hoja: "archivo", motivo: "error_procesamiento", valor: error.message }],
      duracion_ms: duracionMs
    });

    throw error;
  }
}

async function sincronizarConfiguracion({ workbook, hash, nombreArchivo, usuarioId, inicio }) {
  const hojaKits = workbook.Sheets[HOJA_KITS];
  const hojaVehiculos = workbook.Sheets[HOJA_VEHICULOS];

  if (!hojaKits && !hojaVehiculos) {
    throw new HttpError(422, `El archivo no tiene ninguna de las hojas esperadas ("${HOJA_KITS}" / "${HOJA_VEHICULOS}")`);
  }

  const rowsKits = hojaKits ? XLSX.utils.sheet_to_json(hojaKits, { header: 1, raw: true, defval: null }) : [];
  const rowsVehiculos = hojaVehiculos ? XLSX.utils.sheet_to_json(hojaVehiculos, { header: 1, raw: true, defval: null }) : [];

  const { kits, incidencias: incidenciasKits } = configExcelParser.parseKitsPorVehiculo(rowsKits);
  const { sugeridos, equivalencias, incidencias: incidenciasVehiculos } = configExcelParser.parseVehiculosConEquivalencias(rowsVehiculos);

  const incidencias = [...incidenciasKits, ...incidenciasVehiculos];

  const intervaloKmPorPlaca = new Map();
  kits.forEach((kit) => intervaloKmPorPlaca.set(kit.placa, kit.intervaloKm));

  // Combina candidatos de ambas hojas en una sola lista {placa, codigoInterno, cantidad}
  const candidatosSugeridos = [
    ...kits.flatMap((kit) => kit.items.map((item) => ({ placa: kit.placa, codigoInterno: item.codigoInterno, cantidad: item.cantidad }))),
    ...sugeridos
  ];

  const vehiculoCache = new Map();
  const repuestoCache = new Map();
  const ordenPorVehiculo = new Map();

  let totalSugeridosCreados = 0;
  let totalOmitidos = 0;

  for (const candidato of candidatosSugeridos) {
    const vehiculo = await resolverVehiculoCache(vehiculoCache, candidato.placa);
    if (!vehiculo) {
      incidencias.push({ hoja: "sugeridos", motivo: "vehiculo_no_encontrado_en_catalogo", valor: candidato.placa });
      totalOmitidos += 1;
      continue;
    }

    const repuesto = await resolverRepuestoCache(repuestoCache, candidato.codigoInterno);
    if (!repuesto) {
      incidencias.push({ hoja: "sugeridos", motivo: "repuesto_no_encontrado", valor: candidato.codigoInterno, placa: candidato.placa });
      totalOmitidos += 1;
      continue;
    }

    const orden = ordenPorVehiculo.get(vehiculo.id) ?? 0;
    ordenPorVehiculo.set(vehiculo.id, orden + 1);

    const resultado = await vehiculoRepuestosSugeridosRepository.upsertIgnore({
      vehiculo_id: vehiculo.id,
      tipo_mantenimiento: "cambio_aceite",
      repuesto_id: repuesto.id,
      cantidad: candidato.cantidad,
      orden,
      intervalo_km: intervaloKmPorPlaca.get(candidato.placa) ?? null
    });

    if (resultado.changes > 0) totalSugeridosCreados += 1;
    else totalOmitidos += 1;
  }

  let totalEquivalenciasCreadas = 0;

  for (const equivalencia of equivalencias) {
    const principal = await resolverRepuestoCache(repuestoCache, equivalencia.codigoPrincipal);
    const equivalente = await resolverRepuestoCache(repuestoCache, equivalencia.codigoEquivalente);

    if (!principal || !equivalente) {
      incidencias.push({
        hoja: "equivalencias",
        motivo: !principal ? "repuesto_no_encontrado" : "repuesto_no_encontrado",
        valor: !principal ? equivalencia.codigoPrincipal : equivalencia.codigoEquivalente
      });
      totalOmitidos += 1;
      continue;
    }

    if (principal.id === equivalente.id) {
      totalOmitidos += 1;
      continue;
    }

    if (principal.categoria !== equivalente.categoria) {
      incidencias.push({
        hoja: "equivalencias",
        motivo: "categoria_no_coincide",
        valor: `${equivalencia.codigoPrincipal} (${principal.categoria}) vs ${equivalencia.codigoEquivalente} (${equivalente.categoria})`
      });
      totalOmitidos += 1;
      continue;
    }

    const prioridad = (await equivalenciasRepository.findMaxPrioridad(principal.id)) + 1;
    const resultado = await equivalenciasRepository.upsertIgnore({
      repuesto_principal_id: principal.id,
      repuesto_equivalente_id: equivalente.id,
      prioridad
    });

    if (resultado.changes > 0) totalEquivalenciasCreadas += 1;
    else totalOmitidos += 1;
  }

  const duracionMs = Date.now() - inicio;

  const registro = await importacionesConfigRepository.create({
    nombre_archivo: nombreArchivo,
    hash_archivo: hash,
    usuario_id: usuarioId,
    estado: "completado",
    total_sugeridos_creados: totalSugeridosCreados,
    total_equivalencias_creadas: totalEquivalenciasCreadas,
    total_omitidos: totalOmitidos,
    total_incidencias: incidencias.length,
    detalle_incidencias: incidencias.slice(0, MAX_INCIDENCIAS_GUARDADAS),
    duracion_ms: duracionMs
  });

  return {
    importacionId: registro.id,
    totalSugeridosCreados,
    totalEquivalenciasCreadas,
    totalOmitidos,
    totalIncidencias: incidencias.length,
    incidencias: incidencias.slice(0, MAX_INCIDENCIAS_GUARDADAS),
    duracionMs
  };
}

async function listar(filtros) {
  return importacionesConfigRepository.findAll(filtros);
}

async function estadoUltimaAutomatica() {
  return importacionesConfigRepository.findUltimaAutomatica();
}

module.exports = { ejecutar, listar, estadoUltimaAutomatica };
