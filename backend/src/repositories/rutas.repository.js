const db = require("../database/query");

async function findAll(empresaId) {
  return db.all("SELECT * FROM rutas WHERE empresa_id = ? ORDER BY nombre ASC", [empresaId]);
}

// Catalogo de rutas por empresa: se completa sobre la marcha al crear una
// asignacion con un nombre que todavia no existe (ver asignaciones.service.js),
// sin necesidad de una pantalla aparte para administrar rutas. El nombre se
// normaliza (trim + mayusculas) para no terminar con "Zipaquira" y "ZIPAQUIRA"
// como dos rutas distintas. El ON CONFLICT cubre la carrera entre el SELECT y
// el INSERT si dos personas crean la misma ruta nueva al mismo tiempo.
async function findOrCreateByNombre(nombre, empresaId) {
  const nombreNormalizado = String(nombre || "").trim().toUpperCase();

  const existente = await db.get("SELECT * FROM rutas WHERE empresa_id = ? AND nombre = ?", [empresaId, nombreNormalizado]);
  if (existente) return existente;

  return db.get(
    `
      INSERT INTO rutas (nombre, empresa_id)
      VALUES (?, ?)
      ON CONFLICT (empresa_id, nombre) DO UPDATE SET nombre = EXCLUDED.nombre
      RETURNING *
    `,
    [nombreNormalizado, empresaId]
  );
}

module.exports = { findAll, findOrCreateByNombre };
