const env = require("../config/env");
const db = require("./query");

if (env.dbClient === "sqlite") {
  db.serialize(() => {
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

  console.log("Tablas verificadas/creadas");
} else {
  console.log("Inicializacion SQLite omitida: DB_CLIENT no es sqlite");
}
