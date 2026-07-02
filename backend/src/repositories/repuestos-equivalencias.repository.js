const db = require("../database/query");

async function findByRepuestoPrincipal(repuestoPrincipalId) {
  return db.all(
    `
      SELECT re.*, r.codigo_interno, r.nombre, r.categoria, r.unidad_medida,
             COALESCE(rs.stock_fisico, 0) - COALESCE(rs.stock_comprometido, 0) AS stock_disponible
      FROM repuestos_equivalencias re
      INNER JOIN repuestos r ON r.id = re.repuesto_equivalente_id
      LEFT JOIN repuestos_stock rs ON rs.repuesto_id = r.id
      WHERE re.repuesto_principal_id = ?
      ORDER BY re.prioridad ASC
    `,
    [repuestoPrincipalId]
  );
}

async function findMaxPrioridad(repuestoPrincipalId) {
  const row = await db.get(
    "SELECT MAX(prioridad) AS max_prioridad FROM repuestos_equivalencias WHERE repuesto_principal_id = ?",
    [repuestoPrincipalId]
  );
  return Number(row?.max_prioridad || 0);
}

async function create(equivalencia) {
  return db.get(
    `
      INSERT INTO repuestos_equivalencias (repuesto_principal_id, repuesto_equivalente_id, prioridad)
      VALUES (?, ?, ?)
      RETURNING *
    `,
    [equivalencia.repuesto_principal_id, equivalencia.repuesto_equivalente_id, equivalencia.prioridad]
  );
}

async function upsertIgnore(equivalencia) {
  return db.run(
    `
      INSERT INTO repuestos_equivalencias (repuesto_principal_id, repuesto_equivalente_id, prioridad)
      VALUES (?, ?, ?)
      ON CONFLICT (repuesto_principal_id, repuesto_equivalente_id) DO NOTHING
    `,
    [equivalencia.repuesto_principal_id, equivalencia.repuesto_equivalente_id, equivalencia.prioridad]
  );
}

async function findById(id) {
  return db.get("SELECT * FROM repuestos_equivalencias WHERE id = ?", [id]);
}

async function remove(id) {
  return db.run("DELETE FROM repuestos_equivalencias WHERE id = ?", [id]);
}

module.exports = { findByRepuestoPrincipal, findMaxPrioridad, create, upsertIgnore, findById, remove };
