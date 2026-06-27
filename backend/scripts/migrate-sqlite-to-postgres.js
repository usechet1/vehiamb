const path = require("path");
const sqlite3 = require("sqlite3");
const { Pool } = require("pg");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env"), quiet: true });

const sqlitePath = process.env.SQLITE_DATABASE_PATH ||
  path.resolve(__dirname, "..", "src", "database", "parque_automotor.db");
const databaseUrl = process.env.DATABASE_URL ||
  "postgres://vehiamb:vehiamb_dev@localhost:5432/vehiamb";

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

function placeholders(count) {
  return Array.from({ length: count }, (_, index) => `$${index + 1}`).join(", ");
}

async function insertRows(client, table) {
  const sqlite = new sqlite3.Database(sqlitePath);

  try {
    const rows = await sqliteAll(sqlite, `SELECT ${table.columns.join(", ")} FROM ${table.name} ORDER BY id`);
    const mappedRows = table.map ? rows.map(table.map) : rows;

    for (const row of mappedRows) {
      const values = table.columns.map((column) => row[column] ?? null);
      await client.query(
        `
          INSERT INTO ${table.name} (${table.columns.join(", ")})
          VALUES (${placeholders(table.columns.length)})
          ON CONFLICT (id) DO NOTHING
        `,
        values
      );
    }

    return mappedRows.length;
  } finally {
    sqlite.close();
  }
}

async function resetSequence(client, tableName) {
  await client.query(
    `
      SELECT setval(
        pg_get_serial_sequence($1, 'id'),
        COALESCE((SELECT MAX(id) FROM ${tableName}), 1),
        (SELECT COUNT(*) > 0 FROM ${tableName})
      )
    `,
    [tableName]
  );
}

async function main() {
  const client = new Pool({ connectionString: databaseUrl });

  try {
    for (const table of tables) {
      const count = await insertRows(client, table);
      await resetSequence(client, table.name);
      console.log(`${table.name}: ${count} registros revisados`);
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
