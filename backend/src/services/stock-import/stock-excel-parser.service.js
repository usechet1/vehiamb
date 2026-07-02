const COLUMNS = {
  codigoInterno: "REFERENCIA 1",
  nombre: "NOMBRE",
  unidadMedida: "UNIDAD BASICA",
  saldo: "SALDO UNIDAD 1",
  valorTotal: "VALOR TOTAL",
  ubicacion: "UBICACION"
};

function normalizeText(raw) {
  const value = String(raw ?? "").trim();
  return value || null;
}

// Evita imprecision de floats, igual que el parser de facturas.
function roundNumber(raw) {
  const value = Number(raw);
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 1000) / 1000;
}

/**
 * Recorre las filas de datos del Excel de saldos y devuelve un candidato por
 * cada fila con codigo interno. No hay concepto de "periodo" aqui (a
 * diferencia de las facturas): el archivo es una foto completa del saldo
 * actual, no un log de transacciones de un dia.
 *
 * @param {{ rows: any[][], headerRowIndex: number, columnIndex: Record<string, number> }} validated
 */
function parse(validated) {
  const { rows, headerRowIndex, columnIndex } = validated;
  const col = (key) => columnIndex[COLUMNS[key]];

  const candidates = [];
  const parseErrors = [];

  for (let i = headerRowIndex + 1; i < rows.length; i += 1) {
    const row = rows[i];
    if (!row || row.every((cell) => cell === null || cell === undefined || cell === "")) continue;

    const filaExcel = i + 1;
    const codigoInterno = normalizeText(row[col("codigoInterno")]);
    if (!codigoInterno) continue; // fila sin identidad: no se puede asociar a ningun repuesto, se ignora sin auditoria

    const nombre = normalizeText(row[col("nombre")]);
    if (!nombre) {
      parseErrors.push({
        filaExcel,
        codigoInterno,
        tipoIncidencia: "campo_nulo",
        descripcion: "La fila tiene REFERENCIA 1 pero NOMBRE esta vacio",
        valorProblematico: String(row[col("nombre")] ?? "")
      });
      continue;
    }

    const stockFisico = roundNumber(row[col("saldo")]);
    const valorTotal = roundNumber(row[col("valorTotal")]);
    const valorPromedio = stockFisico > 0 ? Math.round((valorTotal / stockFisico) * 100) / 100 : 0;

    candidates.push({
      filaExcel,
      codigoInterno,
      nombre,
      unidadMedida: normalizeText(row[col("unidadMedida")]) || "UND",
      stockFisico,
      valorPromedio,
      ubicacionOriginal: col("ubicacion") !== undefined ? normalizeText(row[col("ubicacion")]) : null
    });
  }

  return { candidates, parseErrors };
}

module.exports = { parse, normalizeText, roundNumber };
