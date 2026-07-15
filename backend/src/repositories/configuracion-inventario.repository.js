const db = require("../database/query");

async function getBooleano(clave, empresaId, valorPorDefecto = false) {
  const row = await db.get(
    "SELECT valor FROM configuracion_inventario WHERE clave = ? AND empresa_id = ?",
    [clave, empresaId]
  );
  if (!row) return valorPorDefecto;
  return row.valor === "true";
}

module.exports = { getBooleano };
