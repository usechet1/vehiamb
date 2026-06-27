const path = require("path");
const sqlite3 = require("sqlite3");

const sqlitePath = process.env.SQLITE_DATABASE_PATH ||
  path.resolve(__dirname, "..", "src", "database", "parque_automotor.db");

const tables = [
  {
    name: "usuarios",
    columns: ["id", "nombre", "email", "password_hash", "rol", "activo", "created_at"],
    map(row) {
      return {
        ...row,
        activo: Boolean(row.activo)
      };
    }
  },
  {
    name: "vehiculos",
    columns: [
      "id",
      "codigo_interno",
      "marca",
      "modelo",
      "anio",
      "color",
      "combustible",
      "cilindraje",
      "capacidad_carga",
      "placa",
      "kilometraje_actual",
      "created_at"
    ]
  },
  {
    name: "mantenimientos",
    columns: [
      "id",
      "vehiculo_id",
      "fecha",
      "tipo",
      "descripcion",
      "autorizado_por",
      "hecho_por",
      "repuestos",
      "soporte_url",
      "soporte_nombre",
      "soporte_mime",
      "valor",
      "kilometraje",
      "created_at"
    ]
  },
  {
    name: "documentos",
    columns: [
      "id",
      "vehiculo_id",
      "tipo",
      "numero_documento",
      "fecha_expedicion",
      "fecha_vencimiento",
      "archivo_url",
      "created_at"
    ]
  },
  {
    name: "cambios_aceite",
    columns: [
      "id",
      "vehiculo_id",
      "fecha",
      "kilometraje_actual",
      "proximo_cambio_km",
      "created_at"
    ]
  }
];

function sqliteAll(db, sql) {
  return new Promise((resolve, reject) => {
    db.all(sql, (error, rows) => {
      if (error) reject(error);
      else resolve(rows);
    });
  });
}

function quoteIdentifier(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function sqlLiteral(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function main() {
  const db = new sqlite3.Database(sqlitePath);

  try {
    console.log("BEGIN;");

    for (const table of tables) {
      const rows = await sqliteAll(db, `SELECT ${table.columns.join(", ")} FROM ${table.name} ORDER BY id`);
      const mappedRows = table.map ? rows.map(table.map) : rows;

      for (const row of mappedRows) {
        const columns = table.columns.map(quoteIdentifier).join(", ");
        const values = table.columns.map((column) => sqlLiteral(row[column])).join(", ");
        console.log(`
INSERT INTO ${quoteIdentifier(table.name)} (${columns})
VALUES (${values})
ON CONFLICT (id) DO NOTHING;`);
      }
    }

    for (const table of tables) {
      console.log(`
SELECT setval(
  pg_get_serial_sequence('${table.name}', 'id'),
  COALESCE((SELECT MAX(id) FROM ${quoteIdentifier(table.name)}), 1),
  (SELECT COUNT(*) > 0 FROM ${quoteIdentifier(table.name)})
);`);
    }

    console.log("COMMIT;");
  } finally {
    db.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
