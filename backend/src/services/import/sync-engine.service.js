const { computeRowHash } = require("./row-hash.util");
const vehicleResolver = require("./vehicle-resolver.service");
const facturasRepository = require("../../repositories/facturas-vehiculares.repository");
const incidenciasRepository = require("../../repositories/incidencias-importacion.repository");
const detalleRepository = require("../../repositories/detalle-importacion.repository");

const BATCH_SIZE = 500;
const CLIENTE_LABEL = "CLIENTE";

function chunk(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Si el mismo numero_factura aparece varias veces en el lote (pasa: Power
 * Query reinserta la factura cuando el auxiliar la retoca en vez de
 * actualizar la fila original), se conserva la version con Fecha de Envio
 * mas reciente -- si empatan o no tienen fecha, la ultima en el orden del
 * archivo (se asume mas reciente). Las descartadas quedan registradas como
 * incidencia, nunca se pierden en silencio.
 */
function deduplicarPorNumeroFactura(candidates) {
  const porNumero = new Map();

  candidates.forEach((candidate) => {
    if (!porNumero.has(candidate.numeroFactura)) porNumero.set(candidate.numeroFactura, []);
    porNumero.get(candidate.numeroFactura).push(candidate);
  });

  const ganadores = [];
  const incidenciasDuplicados = [];
  const detalleIgnorados = [];

  porNumero.forEach((ocurrencias) => {
    if (ocurrencias.length === 1) {
      ganadores.push(ocurrencias[0]);
      return;
    }

    const ordenadas = [...ocurrencias].sort((a, b) => {
      const fechaA = a.fechaEnvio || "";
      const fechaB = b.fechaEnvio || "";
      if (fechaA !== fechaB) return fechaA < fechaB ? -1 : 1;
      return a.filaExcel - b.filaExcel;
    });

    const ganador = ordenadas[ordenadas.length - 1];
    const descartadas = ordenadas.slice(0, -1);

    ganadores.push(ganador);

    descartadas.forEach((descartada) => {
      incidenciasDuplicados.push({
        filaExcel: descartada.filaExcel,
        numeroFactura: descartada.numeroFactura,
        placaOriginal: descartada.vehiculoRaw,
        tipoIncidencia: "otro",
        descripcion: `Factura duplicada en el Excel para el mismo periodo (fila ${descartada.filaExcel}); se conservo la fila ${ganador.filaExcel} por tener Fecha de Envio mas reciente.`,
        valorProblematico: descartada.numeroFactura
      });
      detalleIgnorados.push({
        numeroFactura: descartada.numeroFactura,
        accion: "ignorado",
        hashAnterior: null,
        hashNuevo: computeRowHash(descartada)
      });
    });
  });

  return { ganadores, incidenciasDuplicados, detalleIgnorados };
}

function resolverEstadoVehiculo(vehiculoRaw, vehiculoId) {
  if (vehiculoRaw === CLIENTE_LABEL || vehiculoRaw === `${CLIENTE_LABEL}S`) return "cliente";
  if (vehiculoId) return "propio";
  return "sin_asignar";
}

function construirGastos(candidate) {
  const gastos = [
    { tipo: "combustible_pesos", valor: candidate.combustiblePesos, unidad: "COP" },
    { tipo: "combustible_galones", valor: candidate.combustibleGalones, unidad: "galones" },
    { tipo: "almuerzos", valor: candidate.almuerzos, unidad: "COP" },
    { tipo: "peajes", valor: candidate.peajes, unidad: "COP" },
    { tipo: "parqueaderos", valor: candidate.parqueaderos, unidad: "COP" }
  ];

  // No tiene sentido guardar renglones en cero para cada factura (la mayoria
  // de recogidas de cliente no tienen gasto operativo asociado).
  return gastos.filter((gasto) => gasto.valor > 0);
}

async function procesarLote(candidatesLote, importacionId, contexto) {
  const numeros = candidatesLote.map((c) => c.numeroFactura);
  const existentes = await facturasRepository.findByNumerosFactura(numeros);

  const placasParaResolver = candidatesLote
    .map((c) => c.vehiculoRaw)
    .filter((v) => v !== CLIENTE_LABEL && v !== `${CLIENTE_LABEL}S`);
  const vehiculosResueltos = await vehicleResolver.resolverPorPlacas(placasParaResolver);

  const detalles = [];
  const incidencias = [];
  let nuevos = 0;
  let actualizados = 0;
  let omitidos = 0;
  let errores = 0;

  for (const candidate of candidatesLote) {
    try {
      const hashNuevo = computeRowHash(candidate);
      const existente = existentes.get(candidate.numeroFactura);

      const vehiculoId = vehiculosResueltos.get(candidate.vehiculoRaw) || null;
      const estadoVehiculo = resolverEstadoVehiculo(candidate.vehiculoRaw, vehiculoId);

      if (!vehiculoId && estadoVehiculo === "sin_asignar") {
        incidencias.push({
          filaExcel: candidate.filaExcel,
          numeroFactura: candidate.numeroFactura,
          placaOriginal: candidate.vehiculoRaw,
          tipoIncidencia: "vehiculo_no_encontrado",
          descripcion: `La placa "${candidate.vehiculoRaw}" no existe en el catalogo de vehiculos de VehiAmb. La factura se importo igualmente con estado_vehiculo = sin_asignar.`,
          valorProblematico: candidate.vehiculoRaw
        });
      }

      const registro = {
        numero_factura: candidate.numeroFactura,
        fecha_factura: candidate.fechaFactura,
        valor_factura: candidate.valorFactura,
        sala: candidate.sala,
        peso_kg: candidate.pesoKg,
        vehiculo_id: vehiculoId,
        placa_original: candidate.vehiculoRaw,
        conductor_nombre: candidate.conductorNombre,
        fecha_envio: candidate.fechaEnvio,
        observaciones: candidate.observaciones,
        estado_vehiculo: estadoVehiculo,
        importacion_creacion_id: importacionId,
        importacion_ultima_id: importacionId,
        hash_fila: hashNuevo
      };

      if (!existente) {
        const creada = await facturasRepository.create(registro);
        await facturasRepository.replaceGastos(creada.id, construirGastos(candidate), importacionId);
        detalles.push({ facturaId: creada.id, numeroFactura: candidate.numeroFactura, accion: "creado", hashAnterior: null, hashNuevo });
        nuevos += 1;
        continue;
      }

      if (existente.hash_fila === hashNuevo) {
        detalles.push({
          facturaId: existente.id,
          numeroFactura: candidate.numeroFactura,
          accion: "omitido",
          hashAnterior: existente.hash_fila,
          hashNuevo
        });
        omitidos += 1;
        continue;
      }

      const actualizada = await facturasRepository.update(existente.id, registro);
      await facturasRepository.replaceGastos(actualizada.id, construirGastos(candidate), importacionId);
      detalles.push({
        facturaId: actualizada.id,
        numeroFactura: candidate.numeroFactura,
        accion: "actualizado",
        hashAnterior: existente.hash_fila,
        hashNuevo
      });
      actualizados += 1;
    } catch (error) {
      errores += 1;
      incidencias.push({
        filaExcel: candidate.filaExcel,
        numeroFactura: candidate.numeroFactura,
        placaOriginal: candidate.vehiculoRaw,
        tipoIncidencia: "otro",
        descripcion: `Error inesperado procesando la fila: ${error.message}`,
        valorProblematico: null
      });
      detalles.push({ numeroFactura: candidate.numeroFactura, accion: "error", hashAnterior: null, hashNuevo: null });
      console.error(`[SyncEngine] error en factura ${candidate.numeroFactura} (fila ${candidate.filaExcel}):`, error);
    }
  }

  contexto.totalNuevos += nuevos;
  contexto.totalActualizados += actualizados;
  contexto.totalOmitidos += omitidos;
  contexto.totalErrores += errores;
  contexto.detalles.push(...detalles);
  contexto.incidencias.push(...incidencias);
}

/**
 * Punto de entrada del motor de sincronizacion: recibe los candidatos ya
 * filtrados por ExcelParser (periodo correcto + vehiculo asignado) y decide,
 * fila por fila, si crea, actualiza u omite -- nunca borra y recarga todo.
 */
async function sincronizar({ candidates, parseErrors, importacionId }) {
  const { ganadores, incidenciasDuplicados, detalleIgnorados } = deduplicarPorNumeroFactura(candidates);

  const contexto = {
    totalNuevos: 0,
    totalActualizados: 0,
    totalOmitidos: 0,
    totalErrores: parseErrors.length,
    detalles: [...detalleIgnorados],
    incidencias: [...incidenciasDuplicados]
  };

  parseErrors.forEach((error) => {
    contexto.incidencias.push(error);
    contexto.detalles.push({ numeroFactura: error.numeroFactura || "(vacio)", accion: "error", hashAnterior: null, hashNuevo: null });
  });

  const lotes = chunk(ganadores, BATCH_SIZE);
  for (const lote of lotes) {
    await procesarLote(lote, importacionId, contexto);
  }

  if (contexto.detalles.length) await detalleRepository.createMany(importacionId, contexto.detalles);
  if (contexto.incidencias.length) await incidenciasRepository.createMany(importacionId, contexto.incidencias);

  // Cada "ganador" termina en exactamente uno de estos 4 estados (creado,
  // actualizado, omitido o error de BD), asi que sumar por su longitud total
  // es mas confiable que sumar los contadores individuales (cubre tambien
  // los errores que ocurren dentro de procesarLote, no solo los de parseo).
  const totalLeidos = parseErrors.length + incidenciasDuplicados.length + ganadores.length;

  return {
    totalLeidos,
    totalNuevos: contexto.totalNuevos,
    totalActualizados: contexto.totalActualizados,
    totalOmitidos: contexto.totalOmitidos,
    totalErrores: contexto.totalErrores
  };
}

module.exports = { sincronizar };
