const XLSX = require("xlsx");

const COLUMNS = {
  numeroFactura: "Numero_Factura",
  fechaFactura: "Fecha_factura",
  valorFactura: "Valor_Factura",
  sala: "Sala",
  peso: "Peso",
  combustiblePesos: "Combustible Pesos",
  combustibleGalones: "Combustible Galones",
  almuerzos: "Almuerzos",
  vehiculo: "Vehiculo",
  conductor: "Conductor",
  fechaEnvio: "Fecha de Envio",
  observaciones: "Observaciones",
  peajes: "Peajes",
  parqueaderos: "Parqueaderos"
};

function normalizeNumeroFactura(raw) {
  let value = String(raw ?? "").trim();
  if (value.endsWith(".")) value = value.slice(0, -1);
  return value;
}

function normalizeVehiculo(raw) {
  return String(raw ?? "").trim().toUpperCase();
}

function normalizeText(raw) {
  const value = String(raw ?? "").trim();
  return value || null;
}

// Evita imprecision de floats (2504.8000000000002 -> 2504.8).
function roundNumber(raw) {
  const value = Number(raw);
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 1000) / 1000;
}

/**
 * Excel puede entregar la fecha ya como Date (con cellDates:true), como
 * numero serial (si la celda no tiene formato de fecha) o como texto. Se
 * cubren los tres casos y siempre se devuelve YYYY-MM-DD o null.
 */
function excelValueToIsoDate(raw) {
  if (raw === null || raw === undefined || raw === "") return null;

  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) return null;
    return raw.toISOString().slice(0, 10);
  }

  if (typeof raw === "number") {
    const parsed = XLSX.SSF.parse_date_code(raw);
    if (!parsed) return null;
    const y = String(parsed.y).padStart(4, "0");
    const m = String(parsed.m).padStart(2, "0");
    const d = String(parsed.d).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  const parsedDate = new Date(raw);
  if (!Number.isNaN(parsedDate.getTime())) return parsedDate.toISOString().slice(0, 10);

  return null;
}

/**
 * Recorre las filas de datos (todo lo que esta despues de la fila de
 * encabezados) y devuelve solo las que corresponden al periodo pedido y
 * tienen un vehiculo asignado (CLIENTE o placa). Las filas con Vehiculo en
 * blanco se descartan por completo, sin generar ningun rastro de auditoria,
 * porque el negocio las considera "aun no procesadas" por logistica.
 *
 * @param {{ rows: any[][], headerRowIndex: number, columnIndex: Record<string, number> }} validated
 * @param {string} periodo fecha objetivo en formato YYYY-MM-DD
 */
function parse(validated, periodo) {
  const { rows, headerRowIndex, columnIndex } = validated;
  const col = (key) => columnIndex[COLUMNS[key]];

  const candidates = [];
  const parseErrors = [];

  for (let i = headerRowIndex + 1; i < rows.length; i += 1) {
    const row = rows[i];
    if (!row || row.every((cell) => cell === null || cell === undefined || cell === "")) continue;

    const filaExcel = i + 1; // numero de fila tal como se ve en Excel (1-indexado)
    const fechaFacturaIso = excelValueToIsoDate(row[col("fechaFactura")]);

    // No se puede saber a que periodo pertenece una fecha ilegible: se omite
    // sin generar incidencia en ESTE run (podria pertenecer a otro periodo).
    if (!fechaFacturaIso || fechaFacturaIso !== periodo) continue;

    const vehiculoRaw = normalizeVehiculo(row[col("vehiculo")]);
    if (!vehiculoRaw) continue; // "vacio" -> ignorar completamente, sin auditoria

    const numeroFactura = normalizeNumeroFactura(row[col("numeroFactura")]);
    if (!numeroFactura) {
      parseErrors.push({
        filaExcel,
        numeroFactura: null,
        placaOriginal: vehiculoRaw,
        tipoIncidencia: "campo_nulo",
        descripcion: "La fila tiene fecha y vehiculo validos pero Numero_Factura esta vacio",
        valorProblematico: String(row[col("numeroFactura")] ?? "")
      });
      continue;
    }

    candidates.push({
      filaExcel,
      numeroFactura,
      fechaFactura: fechaFacturaIso,
      valorFactura: roundNumber(row[col("valorFactura")]),
      sala: normalizeText(row[col("sala")]),
      pesoKg: roundNumber(row[col("peso")]),
      combustiblePesos: roundNumber(row[col("combustiblePesos")]),
      combustibleGalones: roundNumber(row[col("combustibleGalones")]),
      almuerzos: roundNumber(row[col("almuerzos")]),
      peajes: roundNumber(row[col("peajes")]),
      parqueaderos: roundNumber(row[col("parqueaderos")]),
      vehiculoRaw,
      conductorNombre: normalizeText(row[col("conductor")]),
      fechaEnvio: excelValueToIsoDate(row[col("fechaEnvio")]),
      observaciones: normalizeText(row[col("observaciones")])
    });
  }

  return { candidates, parseErrors };
}

module.exports = { parse, normalizeNumeroFactura, normalizeVehiculo, roundNumber, excelValueToIsoDate };
