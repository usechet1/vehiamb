const db = require("../database/query");

const VEHICULO_FIELDS = [
  "codigo_interno",
  "marca",
  "modelo",
  "anio",
  "color",
  "combustible",
  "cilindraje",
  "capacidad_carga",
  "placa",
  "kilometraje_actual"
];

async function findAll() {
  return db.all("SELECT * FROM vehiculos ORDER BY id DESC");
}

async function findById(id) {
  return db.get("SELECT * FROM vehiculos WHERE id = ?", [id]);
}

async function create(vehiculo) {
  const placeholders = VEHICULO_FIELDS.map(() => "?").join(", ");
  const values = VEHICULO_FIELDS.map((field) => vehiculo[field] ?? null);

  if (db.client === "postgres") {
    return db.get(
      `INSERT INTO vehiculos (${VEHICULO_FIELDS.join(", ")}) VALUES (${placeholders}) RETURNING *`,
      values
    );
  }

  const result = await db.run(
    `INSERT INTO vehiculos (${VEHICULO_FIELDS.join(", ")}) VALUES (${placeholders})`,
    values
  );

  return findById(result.lastID);
}

async function remove(id) {
  return db.run("DELETE FROM vehiculos WHERE id = ?", [id]);
}

module.exports = {
  findAll,
  findById,
  create,
  remove
};
