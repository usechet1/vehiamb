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

const PERMISSIONS = [
  ["dashboard.view", "Inicio", "Ver panel principal"],
  ["vehicles.view", "Vehiculos", "Ver vehiculos"],
  ["vehicles.create", "Vehiculos", "Crear vehiculos"],
  ["vehicles.delete", "Vehiculos", "Eliminar vehiculos"],
  ["maintenance.view", "Mantenimientos", "Ver mantenimientos"],
  ["maintenance.create", "Mantenimientos", "Registrar mantenimientos"],
  ["maintenance.approve", "Mantenimientos", "Aprobar o rechazar mantenimientos"],
  ["documents.view", "Documentos", "Ver documentos"],
  ["documents.create", "Documentos", "Registrar documentos"],
  ["simit.view", "SIMIT", "Consultar SIMIT"],
  ["users.manage", "Usuarios", "Administrar usuarios"]
];

const ROLE_PERMISSIONS = {
  Administrador: PERMISSIONS.map(([codigo]) => codigo),
  Operador: [
    "dashboard.view",
    "vehicles.view",
    "vehicles.create",
    "maintenance.view",
    "maintenance.create",
    "documents.view",
    "documents.create",
    "simit.view"
  ],
  Consulta: [
    "dashboard.view",
    "vehicles.view",
    "maintenance.view",
    "documents.view",
    "simit.view"
  ]
};

async function seedRolesAndPermissions() {
  for (const [codigo, modulo, descripcion] of PERMISSIONS) {
    await db.run(
      `
        INSERT INTO permisos (codigo, modulo, descripcion)
        VALUES (?, ?, ?)
        ON CONFLICT (codigo) DO UPDATE SET
          modulo = EXCLUDED.modulo,
          descripcion = EXCLUDED.descripcion
      `,
      [codigo, modulo, descripcion]
    );
  }

  for (const [roleName, permissions] of Object.entries(ROLE_PERMISSIONS)) {
    await db.run(
      `
        INSERT INTO roles (nombre, descripcion)
        VALUES (?, ?)
        ON CONFLICT (nombre) DO UPDATE SET
          descripcion = EXCLUDED.descripcion
      `,
      [roleName, `${roleName} del sistema`]
    );

    const role = await db.get("SELECT id, permisos_configurados FROM roles WHERE nombre = ?", [roleName]);
    if (!role) continue;
    if (role.permisos_configurados) continue;

    for (const permissionCode of permissions) {
      const permission = await db.get("SELECT id FROM permisos WHERE codigo = ?", [permissionCode]);
      if (!permission) continue;

      await db.run(
        `
          INSERT INTO roles_permisos (role_id, permiso_id)
          VALUES (?, ?)
          ON CONFLICT (role_id, permiso_id) DO NOTHING
        `,
        [role.id, permission.id]
      );
    }

    await db.run("UPDATE roles SET permisos_configurados = ? WHERE id = ?", [
      db.client === "postgres" ? true : 1,
      role.id
    ]);
  }
}

async function syncUserRoles() {
  await db.run(
    `
      UPDATE usuarios u
      SET role_id = r.id
      FROM roles r
      WHERE u.role_id IS NULL
        AND r.nombre = COALESCE(NULLIF(u.rol, ''), 'Administrador')
    `
  );

  await db.run(
    `
      UPDATE usuarios u
      SET role_id = r.id,
          rol = r.nombre
      FROM roles r
      WHERE u.role_id IS NULL
        AND r.nombre = 'Administrador'
    `
  );
}

async function seedAdminUser() {
  const existing = await db.get("SELECT id FROM usuarios LIMIT 1");
  if (existing) return;

  const passwordHash = await hashPassword(env.seedAdminPassword);
  const adminRole = await db.get("SELECT id FROM roles WHERE nombre = ?", ["Administrador"]);

  await db.run(
    `
      INSERT INTO usuarios (nombre, email, password_hash, rol, role_id, activo)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      env.seedAdminName,
      env.seedAdminEmail.toLowerCase(),
      passwordHash,
      env.seedAdminRole,
      adminRole?.id || null,
      db.client === "postgres" ? true : 1
    ]
  );
}

async function ensurePostgresTables() {
  await db.run(`
    CREATE TABLE IF NOT EXISTS roles (
      id BIGSERIAL PRIMARY KEY,
      nombre TEXT NOT NULL UNIQUE,
      descripcion TEXT,
      activo BOOLEAN NOT NULL DEFAULT TRUE,
      permisos_configurados BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS permisos (
      id BIGSERIAL PRIMARY KEY,
      codigo TEXT NOT NULL UNIQUE,
      modulo TEXT NOT NULL,
      descripcion TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS roles_permisos (
      role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      permiso_id BIGINT NOT NULL REFERENCES permisos(id) ON DELETE CASCADE,
      PRIMARY KEY (role_id, permiso_id)
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id BIGSERIAL PRIMARY KEY,
      nombre TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      rol TEXT NOT NULL DEFAULT 'Administrador',
      role_id BIGINT REFERENCES roles(id),
      activo BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS vehiculos (
      id BIGSERIAL PRIMARY KEY,
      codigo_interno TEXT NOT NULL,
      marca TEXT NOT NULL,
      modelo TEXT NOT NULL,
      anio INTEGER,
      color TEXT,
      combustible TEXT,
      cilindraje INTEGER,
      capacidad_carga INTEGER,
      placa TEXT NOT NULL UNIQUE,
      kilometraje_actual INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS mantenimientos (
      id BIGSERIAL PRIMARY KEY,
      vehiculo_id BIGINT NOT NULL REFERENCES vehiculos(id) ON DELETE CASCADE,
      fecha DATE NOT NULL,
      tipo TEXT NOT NULL,
      descripcion TEXT,
      autorizado_por TEXT,
      hecho_por TEXT,
      repuestos TEXT,
      soporte_url TEXT,
      soporte_nombre TEXT,
      soporte_mime TEXT,
      valor NUMERIC(12, 2) NOT NULL DEFAULT 0,
      valor_mano_obra NUMERIC(12, 2) NOT NULL DEFAULT 0,
      kilometraje FLOAT,
      proximo_cambio_km INTEGER,
      proximo_cambio_fecha DATE,
      creado_por_usuario_id BIGINT REFERENCES usuarios(id),
      estado TEXT NOT NULL DEFAULT 'completado',
      vehiculo_varado BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS notificaciones (
      id BIGSERIAL PRIMARY KEY,
      usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      tipo TEXT NOT NULL,
      prioridad TEXT NOT NULL DEFAULT 'media',
      mensaje TEXT NOT NULL,
      leido BOOLEAN NOT NULL DEFAULT FALSE,
      referencia_tipo TEXT,
      referencia_id BIGINT,
      fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS documentos (
      id BIGSERIAL PRIMARY KEY,
      vehiculo_id BIGINT NOT NULL REFERENCES vehiculos(id) ON DELETE CASCADE,
      tipo TEXT NOT NULL,
      numero_documento TEXT,
      fecha_expedicion DATE,
      fecha_vencimiento DATE,
      archivo_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS cambios_aceite (
      id BIGSERIAL PRIMARY KEY,
      vehiculo_id BIGINT NOT NULL REFERENCES vehiculos(id) ON DELETE CASCADE,
      fecha DATE NOT NULL,
      kilometraje_actual INTEGER NOT NULL,
      proximo_cambio_km INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.run("CREATE INDEX IF NOT EXISTS idx_vehiculos_placa ON vehiculos (placa)");
  await db.run("CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios (email)");
  await db.run("CREATE INDEX IF NOT EXISTS idx_mantenimientos_vehiculo_id ON mantenimientos (vehiculo_id)");
  await db.run("CREATE INDEX IF NOT EXISTS idx_documentos_vehiculo_id ON documentos (vehiculo_id)");
  await db.run("CREATE INDEX IF NOT EXISTS idx_cambios_aceite_vehiculo_id ON cambios_aceite (vehiculo_id)");
  await db.run("CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario_id ON notificaciones (usuario_id)");
  await db.run("CREATE INDEX IF NOT EXISTS idx_notificaciones_referencia ON notificaciones (referencia_tipo, referencia_id)");
}

if (env.dbClient === "sqlite") {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS roles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL UNIQUE,
        descripcion TEXT,
        activo INTEGER NOT NULL DEFAULT 1,
        permisos_configurados INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS permisos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        codigo TEXT NOT NULL UNIQUE,
        modulo TEXT NOT NULL,
        descripcion TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS roles_permisos (
        role_id INTEGER NOT NULL,
        permiso_id INTEGER NOT NULL,
        PRIMARY KEY (role_id, permiso_id),
        FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
        FOREIGN KEY (permiso_id) REFERENCES permisos(id) ON DELETE CASCADE
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        rol TEXT NOT NULL DEFAULT 'Administrador',
        role_id INTEGER,
        activo INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (role_id) REFERENCES roles(id)
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
        valor_mano_obra REAL DEFAULT 0,
        kilometraje INTEGER,
        proximo_cambio_km INTEGER,
        proximo_cambio_fecha TEXT,
        creado_por_usuario_id INTEGER,
        estado TEXT NOT NULL DEFAULT 'completado',
        vehiculo_varado INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (vehiculo_id) REFERENCES vehiculos(id) ON DELETE CASCADE,
        FOREIGN KEY (creado_por_usuario_id) REFERENCES usuarios(id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS notificaciones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER NOT NULL,
        tipo TEXT NOT NULL,
        prioridad TEXT NOT NULL DEFAULT 'media',
        mensaje TEXT NOT NULL,
        leido INTEGER NOT NULL DEFAULT 0,
        referencia_tipo TEXT,
        referencia_id INTEGER,
        fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
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
    ensureColumn("usuarios", "role_id", "INTEGER"),
    ensureColumn("roles", "permisos_configurados", "INTEGER NOT NULL DEFAULT 0"),
    ensureColumn("mantenimientos", "repuestos", "TEXT"),
    ensureColumn("mantenimientos", "autorizado_por", "TEXT"),
    ensureColumn("mantenimientos", "hecho_por", "TEXT"),
    ensureColumn("mantenimientos", "soporte_url", "TEXT"),
    ensureColumn("mantenimientos", "soporte_nombre", "TEXT"),
    ensureColumn("mantenimientos", "soporte_mime", "TEXT"),
    ensureColumn("mantenimientos", "valor_mano_obra", "REAL DEFAULT 0"),
    ensureColumn("mantenimientos", "proximo_cambio_km", "INTEGER"),
    ensureColumn("mantenimientos", "proximo_cambio_fecha", "TEXT"),
    ensureColumn("mantenimientos", "creado_por_usuario_id", "INTEGER"),
    ensureColumn("mantenimientos", "estado", "TEXT NOT NULL DEFAULT 'completado'"),
    ensureColumn("mantenimientos", "vehiculo_varado", "INTEGER NOT NULL DEFAULT 0")
  ])
    .then(seedRolesAndPermissions)
    .then(syncUserRoles)
    .then(seedAdminUser)
    .then(() => console.log("Tablas verificadas/creadas"))
    .catch((error) => console.error("Error verificando columnas", error.message));
} else {
  ensurePostgresTables()
    .then(() => Promise.all([
      ensureColumn("usuarios", "role_id", "BIGINT REFERENCES roles(id)"),
      ensureColumn("roles", "permisos_configurados", "BOOLEAN NOT NULL DEFAULT FALSE"),
      ensureColumn("mantenimientos", "repuestos", "TEXT"),
      ensureColumn("mantenimientos", "autorizado_por", "TEXT"),
      ensureColumn("mantenimientos", "hecho_por", "TEXT"),
      ensureColumn("mantenimientos", "soporte_url", "TEXT"),
      ensureColumn("mantenimientos", "soporte_nombre", "TEXT"),
      ensureColumn("mantenimientos", "soporte_mime", "TEXT"),
      ensureColumn("mantenimientos", "valor_mano_obra", "NUMERIC(12, 2) DEFAULT 0"),
      ensureColumn("mantenimientos", "proximo_cambio_km", "INTEGER"),
      ensureColumn("mantenimientos", "proximo_cambio_fecha", "DATE"),
      ensureColumn("mantenimientos", "creado_por_usuario_id", "BIGINT REFERENCES usuarios(id)"),
      ensureColumn("mantenimientos", "estado", "TEXT NOT NULL DEFAULT 'completado'"),
      ensureColumn("mantenimientos", "vehiculo_varado", "BOOLEAN NOT NULL DEFAULT FALSE")
    ]))
    .then(() => db.run("CREATE INDEX IF NOT EXISTS idx_usuarios_role_id ON usuarios (role_id)"))
    .then(seedRolesAndPermissions)
    .then(syncUserRoles)
    .then(seedAdminUser)
    .then(() => console.log("Columnas PostgreSQL verificadas"))
    .catch((error) => console.error("Error verificando columnas PostgreSQL", error.message));
}
