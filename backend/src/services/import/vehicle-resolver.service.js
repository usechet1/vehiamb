const db = require("../../database/query");

/**
 * Resuelve un lote de placas contra el catalogo de vehiculos de VehiAmb en
 * una sola consulta (evita N+1 sobre lotes de cientos de filas). Las placas
 * en vehiculos ya se guardan trim+uppercase (vehiculos.service.js), igual
 * que las que entrega excel-parser, asi que el match es directo.
 *
 * @param {string[]} placas placas normalizadas (sin duplicados no es necesario)
 * @returns {Promise<Map<string, number>>} placa -> vehiculo_id
 */
async function resolverPorPlacas(placas) {
  const unicas = [...new Set(placas.filter(Boolean))];
  if (!unicas.length) return new Map();

  const rows = await db.all("SELECT id, placa FROM vehiculos WHERE placa = ANY(?)", [unicas]);

  const mapa = new Map();
  rows.forEach((row) => mapa.set(row.placa, row.id));
  return mapa;
}

module.exports = { resolverPorPlacas };
