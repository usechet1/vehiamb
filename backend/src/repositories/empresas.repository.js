const db = require("../database/query");

async function findAll() {
  return db.all(`
    SELECT id, nombre, slug, activo, logo_url, created_at
    FROM empresas
    ORDER BY nombre
  `);
}

async function findById(id) {
  return db.get(
    `
      SELECT id, nombre, slug, activo, logo_url, created_at
      FROM empresas
      WHERE id = ?
    `,
    [id]
  );
}

async function findBySlug(slug) {
  return db.get(
    `
      SELECT id, nombre, slug, activo, logo_url, created_at
      FROM empresas
      WHERE slug = ?
    `,
    [slug]
  );
}

async function update(id, { nombre, logo_url }) {
  await db.run(
    `
      UPDATE empresas
      SET nombre = ?, logo_url = ?
      WHERE id = ?
    `,
    [nombre, logo_url, id]
  );

  return findById(id);
}

async function create({ nombre, slug }) {
  const result = await db.get(
    `
      INSERT INTO empresas (nombre, slug)
      VALUES (?, ?)
      RETURNING id
    `,
    [nombre, slug]
  );

  return findById(result.id);
}

// La primera empresa creada por la migracion inicial (ver seedEmpresaDefault
// en database/init.js). Los cron jobs de importacion via Excel (config-import,
// stock-import, import-scheduler de gastos) son infraestructura de UNA sola
// empresa -- una ruta de archivo compartida por variables de entorno, no hay
// forma de saber "de que empresa" es el archivo salvo asumiendo que siempre
// es la empresa principal original. Empresas nuevas creadas via
// create-empresa.js no participan de estos imports automaticos.
async function findEmpresaPrincipal() {
  return db.get("SELECT id, nombre, slug FROM empresas ORDER BY id ASC LIMIT 1");
}

module.exports = {
  findAll,
  findById,
  findBySlug,
  create,
  update,
  findEmpresaPrincipal
};
