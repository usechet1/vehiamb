const db = require("../database/query");

async function findByRepuestoPrincipal(repuestoPrincipalId, empresaId) {
  return db.all(
    `
      SELECT re.*, r.codigo_interno, r.nombre, r.categoria, r.unidad_medida,
             COALESCE(rs.stock_fisico, 0) - COALESCE(rs.stock_comprometido, 0) AS stock_disponible
      FROM repuestos_equivalencias re
      INNER JOIN repuestos r ON r.id = re.repuesto_equivalente_id
      LEFT JOIN repuestos_stock rs ON rs.repuesto_id = r.id
      WHERE re.repuesto_principal_id = ? AND re.empresa_id = ?
      ORDER BY re.prioridad ASC
    `,
    [repuestoPrincipalId, empresaId]
  );
}

async function findMaxPrioridad(repuestoPrincipalId, empresaId) {
  const row = await db.get(
    "SELECT MAX(prioridad) AS max_prioridad FROM repuestos_equivalencias WHERE repuesto_principal_id = ? AND empresa_id = ?",
    [repuestoPrincipalId, empresaId]
  );
  return Number(row?.max_prioridad || 0);
}

async function create(equivalencia) {
  return db.get(
    `
      INSERT INTO repuestos_equivalencias (repuesto_principal_id, repuesto_equivalente_id, prioridad, empresa_id)
      VALUES (?, ?, ?, ?)
      RETURNING *
    `,
    [equivalencia.repuesto_principal_id, equivalencia.repuesto_equivalente_id, equivalencia.prioridad, equivalencia.empresa_id]
  );
}

async function upsertIgnore(equivalencia) {
  return db.run(
    `
      INSERT INTO repuestos_equivalencias (repuesto_principal_id, repuesto_equivalente_id, prioridad, empresa_id)
      VALUES (?, ?, ?, ?)
      ON CONFLICT (empresa_id, repuesto_principal_id, repuesto_equivalente_id) DO NOTHING
    `,
    [equivalencia.repuesto_principal_id, equivalencia.repuesto_equivalente_id, equivalencia.prioridad, equivalencia.empresa_id]
  );
}

async function findById(id, empresaId) {
  return db.get("SELECT * FROM repuestos_equivalencias WHERE id = ? AND empresa_id = ?", [id, empresaId]);
}

async function remove(id, empresaId) {
  return db.run("DELETE FROM repuestos_equivalencias WHERE id = ? AND empresa_id = ?", [id, empresaId]);
}

module.exports = { findByRepuestoPrincipal, findMaxPrioridad, create, upsertIgnore, findById, remove };
