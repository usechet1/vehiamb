const env = require("../config/env");
const db = require("./query");
const { hashPassword } = require("../utils/password");

async function columnExists(tableName, columnName) {
  if (db.client === "postgres") {
    const row = await db.get(
      `
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = ? AND column_name = ?
      `,
      [tableName, columnName]
    );

    return Boolean(row);
  }

  const columns = await db.all(`PRAGMA table_info(${tableName})`);
  return columns.some((column) => column.name === columnName);
}

async function ensureColumn(tableName, columnName, definition) {
  if (await columnExists(tableName, columnName)) return;
  await db.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
}

async function seedAdminUser() {
  const existing = await db.get("SELECT id FROM usuarios LIMIT 1");
  if (existing) return;

  const passwordHash = await hashPassword(env.seedAdminPassword);

  await db.run(
    `
      INSERT INTO usuarios (nombre, email, password_hash, rol, activo)
      VALUES (?, ?, ?, ?, ?)
    `,
    [
      env.seedAdminName,
      env.seedAdminEmail.toLowerCase(),
      passwordHash,
      env.seedAdminRole,
      db.client === "postgres" ? true : 1
    ]
  );
}

if (env.dbClient === "sqlite") {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        rol TEXT NOT NULL DEFAULT 'Administrador',
        activo INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS vehiculos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        codigo_interno TEXT,
        marca TEXT,
        modelo TEXT,
        anio INTEGER,
        color TEXT,
        combustible TEXT,
        cilindraje INTEGER,
        capacidad_carga INTEGER,
        placa TEXT,
        kilometraje_actual INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS mantenimientos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vehiculo_id INTEGER,
        fecha TEXT,
        tipo TEXT,
        descripcion TEXT,
        autorizado_por TEXT,
        hecho_por TEXT,
        repuestos TEXT,
        soporte_url TEXT,
        soporte_nombre TEXT,
        soporte_mime TEXT,
        valor REAL DEFAULT 0,
        kilometraje INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (vehiculo_id) REFERENCES vehiculos(id) ON DELETE CASCADE
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS documentos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vehiculo_id INTEGER,
        tipo TEXT,
        numero_documento TEXT,
        fecha_expedicion TEXT,
        fecha_vencimiento TEXT,
        archivo_url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (vehiculo_id) REFERENCES vehiculos(id) ON DELETE CASCADE
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS cambios_aceite (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vehiculo_id INTEGER,
        fecha TEXT,
        kilometraje_actual INTEGER,
        proximo_cambio_km INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (vehiculo_id) REFERENCES vehiculos(id) ON DELETE CASCADE
      )
    `);
  });

  Promise.all([
    ensureColumn("mantenimientos", "repuestos", "TEXT"),
    ensureColumn("mantenimientos", "autorizado_por", "TEXT"),
    ensureColumn("mantenimientos", "hecho_por", "TEXT"),
    ensureColumn("mantenimientos", "soporte_url", "TEXT"),
    ensureColumn("mantenimientos", "soporte_nombre", "TEXT"),
    ensureColumn("mantenimientos", "soporte_mime", "TEXT")
  ])
    .then(seedAdminUser)
    .then(() => console.log("Tablas verificadas/creadas"))
    .catch((error) => console.error("Error verificando columnas", error.message));
} else {
  Promise.all([
    ensureColumn("mantenimientos", "repuestos", "TEXT"),
    ensureColumn("mantenimientos", "autorizado_por", "TEXT"),
    ensureColumn("mantenimientos", "hecho_por", "TEXT"),
    ensureColumn("mantenimientos", "soporte_url", "TEXT"),
    ensureColumn("mantenimientos", "soporte_nombre", "TEXT"),
    ensureColumn("mantenimientos", "soporte_mime", "TEXT")
  ])
    .then(seedAdminUser)
    .then(() => console.log("Columnas PostgreSQL verificadas"))
    .catch((error) => console.error("Error verificando columnas PostgreSQL", error.message));
}
