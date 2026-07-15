const HttpError = require("../errors/http-error");
const costosRepository = require("../repositories/costos.repository");

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

function pad2(value) {
  return String(value).padStart(2, "0");
}

function toIso(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

// Las columnas DATE de Postgres vuelven como objetos Date (medianoche UTC),
// no como strings. String(date) da un formato local ("Mon Jun 01 2026 ...");
// hay que leer los componentes UTC para no correrse de dia con la zona
// horaria del proceso.
function fechaColumnaToIso(value) {
  if (value instanceof Date) {
    return `${value.getUTCFullYear()}-${pad2(value.getUTCMonth() + 1)}-${pad2(value.getUTCDate())}`;
  }
  return String(value).slice(0, 10);
}

function mesEnCurso() {
  const hoy = new Date();
  const desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const hasta = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
  return { desde: toIso(desde), hasta: toIso(hasta) };
}

/**
 * Valida y normaliza el rango de fechas. Si no se especifica, usa el mes en
 * curso completo (dia 1 al ultimo dia del mes actual).
 */
function normalizarRango(query = {}) {
  if (!query.desde && !query.hasta) return mesEnCurso();

  const desde = String(query.desde || "").trim();
  const hasta = String(query.hasta || "").trim();

  if (!FECHA_REGEX.test(desde) || !FECHA_REGEX.test(hasta)) {
    throw new HttpError(400, "desde y hasta deben tener formato YYYY-MM-DD");
  }

  if (desde > hasta) {
    throw new HttpError(400, "desde no puede ser posterior a hasta");
  }

  return { desde, hasta };
}

/**
 * Periodo anterior equivalente: misma cantidad de dias, inmediatamente antes
 * del periodo seleccionado. Ej: 2026-06-10 a 2026-06-19 (10 dias) -> periodo
 * anterior es 2026-05-31 a 2026-06-09 (los 10 dias inmediatamente antes).
 */
function periodoAnterior(desde, hasta) {
  const desdeDate = new Date(`${desde}T00:00:00`);
  const hastaDate = new Date(`${hasta}T00:00:00`);
  const dias = Math.round((hastaDate - desdeDate) / 86400000) + 1;

  const hastaAnteriorDate = new Date(desdeDate);
  hastaAnteriorDate.setDate(hastaAnteriorDate.getDate() - 1);

  const desdeAnteriorDate = new Date(hastaAnteriorDate);
  desdeAnteriorDate.setDate(desdeAnteriorDate.getDate() - (dias - 1));

  return { desdeAnterior: toIso(desdeAnteriorDate), hastaAnterior: toIso(hastaAnteriorDate) };
}

/**
 * Delta porcentual entre el valor actual y el anterior, a 1 decimal.
 * Cuando el periodo anterior fue 0: si el actual tambien es 0 el delta es 0
 * (sin cambio); si el actual es mayor, no hay base matematica para un
 * porcentaje (division por cero) y se devuelve null -- el frontend lo
 * muestra como "Nuevo" en vez de un infinito o un numero inventado.
 */
function delta(actual, anterior) {
  const a = Number(actual) || 0;
  const b = Number(anterior) || 0;

  if (b === 0) return a === 0 ? 0 : null;
  return Math.round(((a - b) / b) * 1000) / 10;
}

function tendencia(deltaPct) {
  if (deltaPct === null || deltaPct === 0) return "igual";
  return deltaPct > 0 ? "subio" : "bajo";
}

async function listarVehiculos(query, empresaId) {
  const { desde, hasta } = normalizarRango(query);
  const { desdeAnterior, hastaAnterior } = periodoAnterior(desde, hasta);

  const [actual, anterior] = await Promise.all([
    costosRepository.aggregarPorVehiculo(desde, hasta, empresaId),
    costosRepository.aggregarPorVehiculo(desdeAnterior, hastaAnterior, empresaId)
  ]);

  const anteriorPorPlaca = new Map(anterior.map((row) => [row.placa, row]));

  const items = actual.map((row) => {
    const previo = anteriorPorPlaca.get(row.placa);
    const totalAnterior = Number(previo?.total_gastado || 0);
    const deltaPct = delta(row.total_gastado, totalAnterior);

    return {
      placa: row.placa,
      numFacturas: Number(row.num_facturas),
      totalGastado: Number(row.total_gastado),
      gastoMasAlto: Number(row.gasto_mas_alto),
      totalGastadoAnterior: totalAnterior,
      deltaPct,
      tendencia: tendencia(deltaPct)
    };
  });

  return { desde, hasta, desdeAnterior, hastaAnterior, items };
}

async function kpisVehiculo(placa, query, empresaId) {
  const { desde, hasta } = normalizarRango(query);
  const { desdeAnterior, hastaAnterior } = periodoAnterior(desde, hasta);

  const [actual, anterior] = await Promise.all([
    costosRepository.kpisVehiculo(placa, desde, hasta, empresaId),
    costosRepository.kpisVehiculo(placa, desdeAnterior, hastaAnterior, empresaId)
  ]);

  const construir = (row) => {
    const numFacturas = Number(row?.num_facturas || 0);
    const totalGastado = Number(row?.total_gastado || 0);
    const totalCombustible = Number(row?.total_combustible || 0);

    return {
      numFacturas,
      totalGastado,
      totalCombustible,
      totalGalones: Number(row?.total_galones || 0),
      totalAlmuerzos: Number(row?.total_almuerzos || 0),
      totalPeajes: Number(row?.total_peajes || 0),
      totalParqueaderos: Number(row?.total_parqueaderos || 0),
      costoPromedioPorCargue: numFacturas > 0 ? Math.round((totalGastado / numFacturas) * 100) / 100 : 0,
      combustiblePct: totalGastado > 0 ? Math.round((totalCombustible / totalGastado) * 1000) / 10 : 0
    };
  };

  const kpisActual = construir(actual);
  const kpisAnterior = construir(anterior);

  const deltas = {};
  for (const key of Object.keys(kpisActual)) {
    deltas[key] = delta(kpisActual[key], kpisAnterior[key]);
  }

  return {
    placa,
    desde,
    hasta,
    desdeAnterior,
    hastaAnterior,
    actual: kpisActual,
    anterior: kpisAnterior,
    deltas
  };
}

async function graficasVehiculo(placa, query, empresaId) {
  const { desde, hasta } = normalizarRango(query);

  const [evolucion, porTipo, porTipoDiario, salas] = await Promise.all([
    costosRepository.evolucionDiaria(placa, desde, hasta, empresaId),
    costosRepository.desglosePorTipo(placa, desde, hasta, empresaId),
    costosRepository.desglosePorTipoDiario(placa, desde, hasta, empresaId),
    costosRepository.topSalas(placa, desde, hasta, empresaId, 10)
  ]);

  const TIPOS = ["combustible_pesos", "almuerzos", "peajes", "parqueaderos", "otros"];
  const totalesPorTipo = Object.fromEntries(TIPOS.map((tipo) => [tipo, 0]));
  porTipo.forEach((row) => {
    if (Object.prototype.hasOwnProperty.call(totalesPorTipo, row.tipo_gasto)) {
      totalesPorTipo[row.tipo_gasto] = Number(row.total);
    } else {
      // Cualquier tipo_gasto no contemplado en el catalogo actual cae en "otros",
      // en vez de perderse silenciosamente.
      totalesPorTipo.otros += Number(row.total);
    }
  });

  const fechasDiario = [...new Set(porTipoDiario.map((row) => fechaColumnaToIso(row.fecha)))].sort();
  const porTipoDiarioMapa = {};
  TIPOS.forEach((tipo) => {
    porTipoDiarioMapa[tipo] = fechasDiario.map((fecha) => {
      const encontrado = porTipoDiario.find(
        (row) => fechaColumnaToIso(row.fecha) === fecha && row.tipo_gasto === tipo
      );
      return Number(encontrado?.total || 0);
    });
  });

  return {
    evolucionDiaria: {
      fechas: evolucion.map((row) => fechaColumnaToIso(row.fecha)),
      gastoTotal: evolucion.map((row) => Number(row.gasto_total)),
      galones: evolucion.map((row) => Number(row.galones))
    },
    proporcionPorTipo: totalesPorTipo,
    desglosePorTipoDiario: {
      fechas: fechasDiario,
      series: porTipoDiarioMapa
    },
    topSalas: salas.map((row) => ({ sala: row.sala, total: Number(row.total) }))
  };
}

async function listarFacturas(placa, query, empresaId) {
  const { desde, hasta } = normalizarRango(query);
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number.parseInt(query.limit, 10) || DEFAULT_LIMIT));
  const search = query.search ? String(query.search).trim() : "";
  const orderBy = query.orderBy || "fecha_envio";
  const dir = query.dir === "asc" ? "asc" : "desc";

  const { rows, total } = await costosRepository.listarFacturas(placa, {
    desde,
    hasta,
    page,
    limit,
    search,
    orderBy,
    dir
  }, empresaId);

  return {
    items: rows.map((row) => ({
      id: row.id,
      numeroFactura: row.numero_factura,
      fechaFactura: row.fecha_factura,
      fechaEnvio: row.fecha_envio,
      sala: row.sala,
      pesoKg: Number(row.peso_kg || 0),
      valorFactura: Number(row.valor_factura || 0),
      combustible: Number(row.combustible || 0),
      galones: Number(row.galones || 0),
      almuerzos: Number(row.almuerzos || 0),
      peajes: Number(row.peajes || 0),
      parqueaderos: Number(row.parqueaderos || 0),
      totalGasto: Number(row.total_gasto || 0),
      observaciones: row.observaciones
    })),
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit))
  };
}

module.exports = {
  normalizarRango,
  periodoAnterior,
  listarVehiculos,
  kpisVehiculo,
  graficasVehiculo,
  listarFacturas
};
