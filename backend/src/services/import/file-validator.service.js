const XLSX = require("xlsx");
const HttpError = require("../../errors/http-error");

const SHEET_NAME = "cargues";
const MAX_HEADER_SCAN_ROWS = 10;

// Columnas que el Excel debe tener si o si. El orden real de las columnas no
// importa: se localizan por nombre en la fila de encabezados detectada.
const REQUIRED_COLUMNS = [
  "Numero_Factura",
  "Fecha_factura",
  "Valor_Factura",
  "Sala",
  "Peso",
  "Combustible Pesos",
  "Combustible Galones",
  "Almuerzos",
  "Vehiculo",
  "Conductor",
  "Fecha de Envio",
  "Observaciones",
  "Peajes",
  "Parqueaderos"
];

/**
 * El layout tiene filas de encabezado "flotantes" (botones de macro, filas en
 * blanco) antes de la fila real de headers, y esa posicion puede variar entre
 * versiones del archivo. En vez de asumir un indice de fila fijo, se busca la
 * primera fila que contenga la celda "Numero_Factura".
 */
function findHeaderRowIndex(rows) {
  const limit = Math.min(MAX_HEADER_SCAN_ROWS, rows.length);

  for (let i = 0; i < limit; i += 1) {
    const row = rows[i] || [];
    if (row.includes("Numero_Factura")) return i;
  }

  return -1;
}

/**
 * Abre el Excel (read-only: nunca se escribe sobre el workbook) y valida que
 * tenga la hoja y columnas esperadas antes de que cualquier otra capa toque
 * la base de datos.
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
    throw new HttpError(422, 'No fue posible localizar la fila de encabezados (se esperaba una celda "Numero_Factura")');
  }

  const header = rows[headerRowIndex];
  const missing = REQUIRED_COLUMNS.filter((column) => !header.includes(column));

  if (missing.length) {
    throw new HttpError(422, `Faltan columnas obligatorias en el Excel: ${missing.join(", ")}`);
  }

  const columnIndex = {};
  header.forEach((name, index) => {
    if (name) columnIndex[name] = index;
  });

  return { rows, headerRowIndex, columnIndex };
}

module.exports = { validate, SHEET_NAME, REQUIRED_COLUMNS };
