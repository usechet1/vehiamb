const PLACA_REGEX = /\b[A-Z]{3}-\d{3}\b/g;
const TITULO_REGEX = /CAMBIO DE ACEITE/i;
const INTERVALO_REGEX = /\d+/;

function isBlank(value) {
  return value === null || value === undefined || value === "";
}

function extraerPlacas(texto) {
  if (!texto) return [];
  const matches = String(texto).match(PLACA_REGEX);
  return matches ? [...new Set(matches)] : [];
}

/**
 * Hoja "CAMBIO DE ACEITE VEHICULOS ": bloques de 2 vehiculos en paralelo
 * (columnas 0-4 para el izquierdo, 5-9 para el derecho). Cada bloque:
 *   fila título ("CAMBIO DE ACEITE VH: XXX-000")
 *   fila intervalo ("KILOMETAJE DE CAMBIO" / "HORAS DE CAMBIO", valor en col+1)
 *   fila de encabezados (se ignora)
 *   N filas de items hasta el siguiente título o el fin de la hoja
 */
function parseKitsPorVehiculo(rows) {
  const kits = []; // { placa, intervaloKm, items: [{codigoInterno, nombre, cantidad}] }
  const incidencias = [];

  let i = 0;
  while (i < rows.length) {
    const row = rows[i] || [];
    const tieneTituloIzq = TITULO_REGEX.test(String(row[0] || ""));
    const tieneTituloDer = TITULO_REGEX.test(String(row[5] || ""));

    if (!tieneTituloIzq && !tieneTituloDer) {
      i += 1;
      continue;
    }

    const filaIntervalo = rows[i + 1] || [];
    const intervaloIzq = filaIntervalo[1] ? Number((String(filaIntervalo[1]).match(INTERVALO_REGEX) || [])[0]) || null : null;
    const intervaloDer = filaIntervalo[6] ? Number((String(filaIntervalo[6]).match(INTERVALO_REGEX) || [])[0]) || null : null;

    const placasIzq = tieneTituloIzq ? extraerPlacas(row[0]) : [];
    const placasDer = tieneTituloDer ? extraerPlacas(row[5]) : [];

    if (tieneTituloIzq && !placasIzq.length) {
      incidencias.push({ hoja: "CAMBIO DE ACEITE VEHICULOS", fila: i + 1, motivo: "vehiculo_no_reconocido", valor: row[0] });
    }
    if (tieneTituloDer && !placasDer.length) {
      incidencias.push({ hoja: "CAMBIO DE ACEITE VEHICULOS", fila: i + 1, motivo: "vehiculo_no_reconocido", valor: row[5] });
    }

    const kitIzq = placasIzq[0] ? { placa: placasIzq[0], intervaloKm: intervaloIzq, items: [] } : null;
    const kitDer = placasDer[0] ? { placa: placasDer[0], intervaloKm: intervaloDer, items: [] } : null;

    let j = i + 3; // salta titulo + intervalo + encabezados
    while (j < rows.length) {
      const dataRow = rows[j] || [];
      const esNuevoBloque = TITULO_REGEX.test(String(dataRow[0] || "")) || TITULO_REGEX.test(String(dataRow[5] || ""));
      if (esNuevoBloque) break;

      if (kitIzq && !isBlank(dataRow[0])) {
        kitIzq.items.push({ codigoInterno: String(dataRow[0]).trim(), nombre: dataRow[1] || "", cantidad: Number(dataRow[2]) || 1 });
      }
      if (kitDer && !isBlank(dataRow[5])) {
        kitDer.items.push({ codigoInterno: String(dataRow[5]).trim(), nombre: dataRow[6] || "", cantidad: Number(dataRow[7]) || 1 });
      }

      j += 1;
    }

    if (kitIzq) kits.push(kitIzq);
    if (kitDer) kits.push(kitDer);

    i = j;
  }

  return { kits, incidencias };
}

/**
 * Hoja "VEHICULOS ": 2 bloques de columnas independientes (0-8 y 10-18).
 * La columna VEHICULO solo trae valor en la primera fila de cada grupo; las
 * siguientes filas heredan el ultimo valor no nulo (arrastre de "vehiculo
 * actual"), igual que una celda combinada en Excel.
 */
function parseVehiculosConEquivalencias(rows) {
  const sugeridos = []; // { placa, codigoInterno, cantidad }
  const equivalencias = []; // { codigoPrincipal, codigoEquivalente }
  const incidencias = [];

  let placasIzq = [];
  let placasDer = [];

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i] || [];

    if (!isBlank(row[0])) {
      placasIzq = extraerPlacas(row[0]);
      if (!placasIzq.length) {
        incidencias.push({ hoja: "VEHICULOS", fila: i + 1, motivo: "vehiculo_no_reconocido", valor: row[0] });
      }
    }
    if (!isBlank(row[10])) {
      placasDer = extraerPlacas(row[10]);
      if (!placasDer.length) {
        incidencias.push({ hoja: "VEHICULOS", fila: i + 1, motivo: "vehiculo_no_reconocido", valor: row[10] });
      }
    }

    if (!isBlank(row[1]) && placasIzq.length) {
      const codigoInterno = String(row[1]).trim();
      const cantidad = Number(row[4]) || 1;
      placasIzq.forEach((placa) => sugeridos.push({ placa, codigoInterno, cantidad }));

      if (!isBlank(row[6])) {
        equivalencias.push({ codigoPrincipal: codigoInterno, codigoEquivalente: String(row[6]).trim() });
      }
    }

    if (!isBlank(row[11]) && placasDer.length) {
      const codigoInterno = String(row[11]).trim();
      const cantidad = Number(row[14]) || 1;
      placasDer.forEach((placa) => sugeridos.push({ placa, codigoInterno, cantidad }));

      if (!isBlank(row[16])) {
        equivalencias.push({ codigoPrincipal: codigoInterno, codigoEquivalente: String(row[16]).trim() });
      }
    }
  }

  return { sugeridos, equivalencias, incidencias };
}

module.exports = { parseKitsPorVehiculo, parseVehiculosConEquivalencias, extraerPlacas };
