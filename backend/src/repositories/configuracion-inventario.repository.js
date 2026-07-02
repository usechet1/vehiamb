const db = require("../database/query");

async function getBooleano(clave, valorPorDefecto = false) {
  const row = await db.get("SELECT valor FROM configuracion_inventario WHERE clave = ?", [clave]);
  if (!row) return valorPorDefecto;
  return row.valor === "true";
}

module.exports = { getBooleano };
