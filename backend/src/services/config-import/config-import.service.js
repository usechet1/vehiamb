const XLSX = require("xlsx");
const HttpError = require("../../errors/http-error");
const configExcelParser = require("./config-excel-parser.service");
const vehiculosRepository = require("../../repositories/vehiculos.repository");
const repuestosRepository = require("../../repositories/repuestos.repository");
const vehiculoRepuestosSugeridosRepository = require("../../repositories/vehiculo-repuestos-sugeridos.repository");
const equivalenciasRepository = require("../../repositories/repuestos-equivalencias.repository");
const importacionesConfigRepository = require("../../repositories/importaciones-config-vehiculos.repository");

const HOJA_KITS = "CAMBIO DE ACEITE VEHICULOS ";
const HOJA_VEHICULOS = "VEHICULOS ";
const MAX_INCIDENCIAS_GUARDADAS = 200;

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
 * Importador bootstrap (boton manual, sin cron, sin sincronizacion
 * incremental): lee las hojas "CAMBIO DE ACEITE VEHICULOS " y "VEHICULOS "
 * del Excel real de configuracion y crea vehiculo_repuestos_sugeridos +
 * repuestos_equivalencias que aun no existan. Nunca pisa lo que el usuario
 * ya haya configurado a mano (ON CONFLICT DO NOTHING en ambas tablas) y
 * nunca bloquea por una fila problematica: placas/codigos no reconocidos
 * quedan como incidencia y se sigue con el resto del archivo.
 */
async function ejecutar({ buffer, nombreArchivo, usuarioId }) {
  const inicio = Date.now();

  let workbook;
  try {
    workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  } catch (error) {
    throw new HttpError(422, `No fue posible abrir el archivo Excel: ${error.message}`);
  }

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

module.exports = { ejecutar, listar };
