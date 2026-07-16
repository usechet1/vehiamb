const XLSX = require("xlsx");
const HttpError = require("../../errors/http-error");

const SHEET_NAME = "SALDO 10-11";
const MAX_HEADER_SCAN_ROWS = 10;

// Columnas que el Excel de saldos debe tener si o si. El orden real no
// importa: se localizan por nombre en la fila de encabezados detectada.
// No incluye NIVEL1..NIVEL7/REFERENCIA 2/UBICACION porque el parser no las
// necesita hoy (jerarquia interna del ERP / preparacion para multi-bodega).
const REQUIRED_COLUMNS = ["REFERENCIA 1", "NOMBRE", "UNIDAD BASICA", "SALDO UNIDAD 1", "VALOR TOTAL"];

// Los encabezados del Excel real traen espacios inconsistentes ("SALDO
// UNIDAD 1 " con espacio al final, "NIVEL 1" con espacio en medio, etc.) --
// se normaliza todo con trim antes de comparar para no depender de que el
// archivo este perfectamente limpio.
function normalizarEncabezado(value) {
  return typeof value === "string" ? value.trim() : value;
}

function findHeaderRowIndex(rows) {
  const limit = Math.min(MAX_HEADER_SCAN_ROWS, rows.length);

  for (let i = 0; i < limit; i += 1) {
    const row = (rows[i] || []).map(normalizarEncabezado);
    if (row.includes("REFERENCIA 1")) return i;
  }

  return -1;
}

/**
 * Abre el Excel de saldos (read-only) y valida que tenga la hoja y las
 * columnas esperadas. El archivo real comparte libro con el de repuestos
 * sugeridos/cambio de aceite (CONFIG_EXCEL_FILE_PATH puede apuntar al mismo
 * archivo), asi que el saldo de inventario vive en su propia hoja llamada
 * "SALDO" -- no se puede asumir "la primera hoja del libro".
 *
 * @param {string} filePath ruta a la copia temporal local del archivo
 * @returns {{ rows: any[][], headerRowIndex: number, columnIndex: Record<string, number> }}
 */
function validate(filePath) {
  let workbook;

  try {
    workbook = XLSX.readFile(filePath, { cellDates: true, cellHTML: false, cellFormula: false });
  } catch (error) {
    throw new HttpError(422, `No fue posible abrir el archivo Excel: ${error.message}`);
  }

  const sheet = workbook.Sheets[SHEET_NAME];

  if (!sheet) {
    throw new HttpError(
      422,
      `La hoja "${SHEET_NAME}" no existe en el archivo (hojas disponibles: ${workbook.SheetNames.join(", ")})`
    );
  }

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null, blankrows: true });
  const headerRowIndex = findHeaderRowIndex(rows);

  if (headerRowIndex === -1) {
    throw new HttpError(422, 'No fue posible localizar la fila de encabezados (se esperaba una celda "REFERENCIA 1")');
  }

  const header = rows[headerRowIndex].map(normalizarEncabezado);
  const missing = REQUIRED_COLUMNS.filter((column) => !header.includes(column));

  if (missing.length) {
    throw new HttpError(422, `Faltan columnas obligatorias en el Excel de saldos: ${missing.join(", ")}`);
  }

  const columnIndex = {};
  header.forEach((name, index) => {
    if (name) columnIndex[name] = index;
  });

  // Las filas de datos usan los mismos indices de columna que el header
  // normalizado (map no muta el array original), asi que el resto del
  // parser sigue leyendo por indice sin cambios.
  return { rows, headerRowIndex, columnIndex };
}

module.exports = { validate, SHEET_NAME, REQUIRED_COLUMNS };
