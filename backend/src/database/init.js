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

async function ensureNumericColumn(tableName, columnName, precision = "12, 2") {
  const row = await db.get(
    `
      SELECT data_type
      FROM information_schema.columns
      WHERE table_name = ? AND column_name = ?
    `,
    [tableName, columnName]
  );

  if (!row || row.data_type === "numeric") return;
  await db.run(`ALTER TABLE ${tableName} ALTER COLUMN ${columnName} TYPE NUMERIC(${precision}) USING ${columnName}::numeric`);
}

const PERMISSIONS = [
  ["dashboard.view", "Inicio", "Ver panel principal"],
  ["vehicles.view", "Vehiculos", "Ver vehiculos"],
  ["vehicles.create", "Vehiculos", "Crear vehiculos"],
  ["vehicles.edit", "Vehiculos", "Editar vehiculos"],
  ["vehicles.delete", "Vehiculos", "Eliminar vehiculos"],
  ["maintenance.view", "Mantenimientos", "Ver mantenimientos"],
  ["maintenance.create", "Mantenimientos", "Registrar mantenimientos"],
  ["maintenance.approve", "Mantenimientos", "Aprobar o rechazar mantenimientos"],
  ["documents.view", "Documentos", "Ver documentos"],
  ["documents.create", "Documentos", "Registrar documentos"],
  ["simit.view", "SIMIT", "Consultar SIMIT"],
  ["users.manage", "Usuarios", "Administrar usuarios"],
  ["imports.view", "Importaciones", "Ver importaciones de gastos vehiculares"],
  ["imports.manage", "Importaciones", "Ejecutar importaciones y resolver incidencias"]
];

const ROLE_PERMISSIONS = {
  Administrador: PERMISSIONS.map(([codigo]) => codigo),
  Operador: [
    "dashboard.view",
    "vehicles.view",
    "vehicles.create",
    "vehicles.edit",
    "maintenance.view",
    "maintenance.create",
    "documents.view",
    "documents.create",
    "simit.view",
    "imports.view",
    "imports.manage"
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

// seedRolesAndPermissions() no toca roles ya marcados permisos_configurados=true
// (para no pisar cambios hechos desde el panel de administracion). Cuando se
// agrega un permiso nuevo en una version posterior, esta funcion lo asigna
// explicitamente a los roles pensados para el, sin tocar el resto de la
// configuracion de esos roles. Es idempotente (ON CONFLICT DO NOTHING); si un
// administrador quita manualmente uno de estos permisos despues, se debe
// quitar tambien de este mapa o volvera a aparecer en el siguiente arranque.
const PERMISOS_NUEVOS_POR_ROL = {
  "imports.view": ["Administrador", "Operador"],
  "imports.manage": ["Administrador", "Operador"]
};

async function grantPermisosNuevos() {
  for (const [permissionCode, roleNames] of Object.entries(PERMISOS_NUEVOS_POR_ROL)) {
    const permission = await db.get("SELECT id FROM permisos WHERE codigo = ?", [permissionCode]);
    if (!permission) continue;

    for (const roleName of roleNames) {
      const role = await db.get("SELECT id FROM roles WHERE nombre = ?", [roleName]);
      if (!role) continue;

      await db.run(
        `
          INSERT INTO roles_permisos (role_id, permiso_id)
          VALUES (?, ?)
          ON CONFLICT (role_id, permiso_id) DO NOTHING
        `,
        [role.id, permission.id]
      );
    }
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
      capacidad_carga NUMERIC(12, 2),
      placa TEXT NOT NULL UNIQUE,
      kilometraje_actual NUMERIC(12, 2) NOT NULL DEFAULT 0,
      tipo_vehiculo TEXT,
      tipo_carroceria TEXT,
      numero_chasis TEXT,
      numero_motor TEXT,
      estado TEXT NOT NULL DEFAULT 'activo',
      imagen_url TEXT,
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
      categoria TEXT NOT NULL DEFAULT 'sistema',
      prioridad TEXT NOT NULL DEFAULT 'media',
      titulo TEXT,
      mensaje TEXT NOT NULL,
      vehiculo_id BIGINT REFERENCES vehiculos(id) ON DELETE SET NULL,
      accion_tipo TEXT,
      accion_payload TEXT,
      estado TEXT NOT NULL DEFAULT 'no_leida',
      leido BOOLEAN NOT NULL DEFAULT FALSE,
      referencia_tipo TEXT,
      referencia_id BIGINT,
      fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
      archivo_nombre TEXT,
      archivo_mime TEXT,
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

  // ── Modulo de importacion de gastos vehiculares (Excel CARGUES_BODEGA) ──
  await db.run(`
    CREATE TABLE IF NOT EXISTS importaciones (
      id BIGSERIAL PRIMARY KEY,
      nombre_archivo TEXT NOT NULL,
      hash_archivo TEXT NOT NULL,
      periodo DATE NOT NULL,
      fecha_importacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      usuario_id BIGINT REFERENCES usuarios(id),
      estado TEXT NOT NULL DEFAULT 'pendiente',
      total_leidos INTEGER NOT NULL DEFAULT 0,
      total_nuevos INTEGER NOT NULL DEFAULT 0,
      total_actualizados INTEGER NOT NULL DEFAULT 0,
      total_omitidos INTEGER NOT NULL DEFAULT 0,
      total_errores INTEGER NOT NULL DEFAULT 0,
      duracion_ms INTEGER,
      observaciones TEXT,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS facturas_vehiculares (
      id BIGSERIAL PRIMARY KEY,
      numero_factura TEXT NOT NULL UNIQUE,
      fecha_factura DATE NOT NULL,
      valor_factura NUMERIC(14, 2) NOT NULL DEFAULT 0,
      sala TEXT,
      peso_kg NUMERIC(12, 3),
      vehiculo_id BIGINT REFERENCES vehiculos(id) ON DELETE SET NULL,
      placa_original TEXT,
      conductor_nombre TEXT,
      fecha_envio DATE,
      observaciones TEXT,
      estado_vehiculo TEXT NOT NULL DEFAULT 'sin_asignar',
      importacion_creacion_id BIGINT REFERENCES importaciones(id),
      importacion_ultima_id BIGINT REFERENCES importaciones(id),
      hash_fila TEXT NOT NULL,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS gastos_operativos (
      id BIGSERIAL PRIMARY KEY,
      factura_id BIGINT NOT NULL REFERENCES facturas_vehiculares(id) ON DELETE CASCADE,
      tipo_gasto TEXT NOT NULL,
      valor NUMERIC(14, 3) NOT NULL DEFAULT 0,
      unidad TEXT NOT NULL,
      importacion_id BIGINT REFERENCES importaciones(id),
      creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS incidencias_importacion (
      id BIGSERIAL PRIMARY KEY,
      importacion_id BIGINT NOT NULL REFERENCES importaciones(id) ON DELETE CASCADE,
      fila_excel INTEGER,
      numero_factura TEXT,
      placa_original TEXT,
      tipo_incidencia TEXT NOT NULL,
      descripcion TEXT NOT NULL,
      valor_problematico TEXT,
      resuelta BOOLEAN NOT NULL DEFAULT FALSE,
      resuelta_por BIGINT REFERENCES usuarios(id),
      resuelta_en TIMESTAMPTZ,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS detalle_importacion (
      id BIGSERIAL PRIMARY KEY,
      importacion_id BIGINT NOT NULL REFERENCES importaciones(id) ON DELETE CASCADE,
      factura_id BIGINT REFERENCES facturas_vehiculares(id) ON DELETE SET NULL,
      numero_factura TEXT NOT NULL,
      accion TEXT NOT NULL,
      hash_anterior TEXT,
      hash_nuevo TEXT,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.run("CREATE INDEX IF NOT EXISTS idx_vehiculos_placa ON vehiculos (placa)");
  await db.run("CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios (email)");
  await db.run("CREATE INDEX IF NOT EXISTS idx_mantenimientos_vehiculo_id ON mantenimientos (vehiculo_id)");
  await db.run("CREATE INDEX IF NOT EXISTS idx_documentos_vehiculo_id ON documentos (vehiculo_id)");
  await db.run("CREATE INDEX IF NOT EXISTS idx_cambios_aceite_vehiculo_id ON cambios_aceite (vehiculo_id)");
  await db.run("CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario_id ON notificaciones (usuario_id)");
  await db.run("CREATE INDEX IF NOT EXISTS idx_notificaciones_referencia ON notificaciones (referencia_tipo, referencia_id)");
  await db.run("CREATE INDEX IF NOT EXISTS idx_importaciones_periodo ON importaciones (periodo)");
  await db.run("CREATE INDEX IF NOT EXISTS idx_importaciones_estado ON importaciones (estado)");
  await db.run("CREATE INDEX IF NOT EXISTS idx_facturas_vehiculares_vehiculo_id ON facturas_vehiculares (vehiculo_id)");
  await db.run("CREATE INDEX IF NOT EXISTS idx_facturas_vehiculares_fecha_factura ON facturas_vehiculares (fecha_factura)");
  await db.run("CREATE INDEX IF NOT EXISTS idx_facturas_vehiculares_estado_vehiculo ON facturas_vehiculares (estado_vehiculo)");
  await db.run("CREATE INDEX IF NOT EXISTS idx_gastos_operativos_factura_id ON gastos_operativos (factura_id)");
  await db.run("CREATE INDEX IF NOT EXISTS idx_gastos_operativos_tipo_gasto ON gastos_operativos (tipo_gasto)");
  await db.run("CREATE INDEX IF NOT EXISTS idx_incidencias_importacion_importacion_id ON incidencias_importacion (importacion_id)");
  await db.run("CREATE INDEX IF NOT EXISTS idx_incidencias_importacion_resuelta ON incidencias_importacion (resuelta)");
  await db.run("CREATE INDEX IF NOT EXISTS idx_detalle_importacion_importacion_id ON detalle_importacion (importacion_id)");
  await db.run("CREATE INDEX IF NOT EXISTS idx_detalle_importacion_numero_factura ON detalle_importacion (numero_factura)");
  // idx_notificaciones_estado e idx_notificaciones_vehiculo_id se crean mas abajo,
  // despues de ensureColumn: aqui correrian en cada arranque (incluso con la tabla
  // ya existente en una base antigua) y fallarian porque esas columnas aun no existen.
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
        tipo_vehiculo TEXT,
        tipo_carroceria TEXT,
        numero_chasis TEXT,
        numero_motor TEXT,
        estado TEXT NOT NULL DEFAULT 'activo',
        imagen_url TEXT,
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
        categoria TEXT NOT NULL DEFAULT 'sistema',
        prioridad TEXT NOT NULL DEFAULT 'media',
        titulo TEXT,
        mensaje TEXT NOT NULL,
        vehiculo_id INTEGER,
        accion_tipo TEXT,
        accion_payload TEXT,
        estado TEXT NOT NULL DEFAULT 'no_leida',
        leido INTEGER NOT NULL DEFAULT 0,
        referencia_tipo TEXT,
        referencia_id INTEGER,
        fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
        FOREIGN KEY (vehiculo_id) REFERENCES vehiculos(id)
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
        archivo_nombre TEXT,
        archivo_mime TEXT,
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

    db.run(`
      CREATE TABLE IF NOT EXISTS importaciones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre_archivo TEXT NOT NULL,
        hash_archivo TEXT NOT NULL,
        periodo TEXT NOT NULL,
        fecha_importacion DATETIME DEFAULT CURRENT_TIMESTAMP,
        usuario_id INTEGER,
        estado TEXT NOT NULL DEFAULT 'pendiente',
        total_leidos INTEGER NOT NULL DEFAULT 0,
        total_nuevos INTEGER NOT NULL DEFAULT 0,
        total_actualizados INTEGER NOT NULL DEFAULT 0,
        total_omitidos INTEGER NOT NULL DEFAULT 0,
        total_errores INTEGER NOT NULL DEFAULT 0,
        duracion_ms INTEGER,
        observaciones TEXT,
        creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS facturas_vehiculares (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        numero_factura TEXT NOT NULL UNIQUE,
        fecha_factura TEXT NOT NULL,
        valor_factura REAL NOT NULL DEFAULT 0,
        sala TEXT,
        peso_kg REAL,
        vehiculo_id INTEGER,
        placa_original TEXT,
        conductor_nombre TEXT,
        fecha_envio TEXT,
        observaciones TEXT,
        estado_vehiculo TEXT NOT NULL DEFAULT 'sin_asignar',
        importacion_creacion_id INTEGER,
        importacion_ultima_id INTEGER,
        hash_fila TEXT NOT NULL,
        creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
        actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (vehiculo_id) REFERENCES vehiculos(id) ON DELETE SET NULL,
        FOREIGN KEY (importacion_creacion_id) REFERENCES importaciones(id),
        FOREIGN KEY (importacion_ultima_id) REFERENCES importaciones(id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS gastos_operativos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        factura_id INTEGER NOT NULL,
        tipo_gasto TEXT NOT NULL,
        valor REAL NOT NULL DEFAULT 0,
        unidad TEXT NOT NULL,
        importacion_id INTEGER,
        creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
        actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (factura_id) REFERENCES facturas_vehiculares(id) ON DELETE CASCADE,
        FOREIGN KEY (importacion_id) REFERENCES importaciones(id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS incidencias_importacion (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        importacion_id INTEGER NOT NULL,
        fila_excel INTEGER,
        numero_factura TEXT,
        placa_original TEXT,
        tipo_incidencia TEXT NOT NULL,
        descripcion TEXT NOT NULL,
        valor_problematico TEXT,
        resuelta INTEGER NOT NULL DEFAULT 0,
        resuelta_por INTEGER,
        resuelta_en DATETIME,
        creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (importacion_id) REFERENCES importaciones(id) ON DELETE CASCADE,
        FOREIGN KEY (resuelta_por) REFERENCES usuarios(id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS detalle_importacion (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        importacion_id INTEGER NOT NULL,
        factura_id INTEGER,
        numero_factura TEXT NOT NULL,
        accion TEXT NOT NULL,
        hash_anterior TEXT,
        hash_nuevo TEXT,
        creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (importacion_id) REFERENCES importaciones(id) ON DELETE CASCADE,
        FOREIGN KEY (factura_id) REFERENCES facturas_vehiculares(id) ON DELETE SET NULL
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
    ensureColumn("mantenimientos", "vehiculo_varado", "INTEGER NOT NULL DEFAULT 0"),
    ensureColumn("vehiculos", "tipo_vehiculo", "TEXT"),
    ensureColumn("vehiculos", "tipo_carroceria", "TEXT"),
    ensureColumn("vehiculos", "numero_chasis", "TEXT"),
    ensureColumn("vehiculos", "numero_motor", "TEXT"),
    ensureColumn("vehiculos", "estado", "TEXT NOT NULL DEFAULT 'activo'"),
    ensureColumn("vehiculos", "imagen_url", "TEXT"),
    ensureColumn("documentos", "archivo_nombre", "TEXT"),
    ensureColumn("documentos", "archivo_mime", "TEXT"),
    ensureColumn("notificaciones", "categoria", "TEXT NOT NULL DEFAULT 'sistema'"),
    ensureColumn("notificaciones", "titulo", "TEXT"),
    ensureColumn("notificaciones", "vehiculo_id", "INTEGER"),
    ensureColumn("notificaciones", "accion_tipo", "TEXT"),
    ensureColumn("notificaciones", "accion_payload", "TEXT"),
    ensureColumn("notificaciones", "estado", "TEXT NOT NULL DEFAULT 'no_leida'"),
    ensureColumn("notificaciones", "updated_at", "DATETIME DEFAULT CURRENT_TIMESTAMP")
  ])
    .then(() => db.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_vehiculos_numero_chasis ON vehiculos (numero_chasis) WHERE numero_chasis IS NOT NULL"))
    .then(() => db.run("UPDATE notificaciones SET estado = 'leida' WHERE leido = 1 AND estado = 'no_leida'"))
    .then(() => db.run("UPDATE notificaciones SET vehiculo_id = referencia_id WHERE referencia_tipo = 'vehiculo' AND vehiculo_id IS NULL"))
    .then(seedRolesAndPermissions)
    .then(grantPermisosNuevos)
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
      ensureColumn("mantenimientos", "vehiculo_varado", "BOOLEAN NOT NULL DEFAULT FALSE"),
      ensureColumn("vehiculos", "tipo_vehiculo", "TEXT"),
      ensureColumn("vehiculos", "tipo_carroceria", "TEXT"),
      ensureColumn("vehiculos", "numero_chasis", "TEXT"),
      ensureColumn("vehiculos", "numero_motor", "TEXT"),
      ensureColumn("vehiculos", "estado", "TEXT NOT NULL DEFAULT 'activo'"),
      ensureColumn("vehiculos", "imagen_url", "TEXT"),
      ensureColumn("documentos", "archivo_nombre", "TEXT"),
      ensureColumn("documentos", "archivo_mime", "TEXT"),
      ensureColumn("notificaciones", "categoria", "TEXT NOT NULL DEFAULT 'sistema'"),
      ensureColumn("notificaciones", "titulo", "TEXT"),
      ensureColumn("notificaciones", "vehiculo_id", "BIGINT REFERENCES vehiculos(id) ON DELETE SET NULL"),
      ensureColumn("notificaciones", "accion_tipo", "TEXT"),
      ensureColumn("notificaciones", "accion_payload", "TEXT"),
      ensureColumn("notificaciones", "estado", "TEXT NOT NULL DEFAULT 'no_leida'"),
      ensureColumn("notificaciones", "updated_at", "TIMESTAMPTZ NOT NULL DEFAULT NOW()")
    ]))
    .then(() => Promise.all([
      ensureNumericColumn("vehiculos", "kilometraje_actual"),
      ensureNumericColumn("vehiculos", "capacidad_carga")
    ]))
    .then(() => db.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_vehiculos_numero_chasis ON vehiculos (numero_chasis) WHERE numero_chasis IS NOT NULL"))
    .then(() => db.run("CREATE INDEX IF NOT EXISTS idx_vehiculos_estado ON vehiculos (estado)"))
    .then(() => db.run("CREATE INDEX IF NOT EXISTS idx_usuarios_role_id ON usuarios (role_id)"))
    .then(() => db.run("CREATE INDEX IF NOT EXISTS idx_notificaciones_estado ON notificaciones (usuario_id, estado)"))
    .then(() => db.run("CREATE INDEX IF NOT EXISTS idx_notificaciones_vehiculo_id ON notificaciones (vehiculo_id)"))
    .then(() => db.run("UPDATE notificaciones SET estado = 'leida' WHERE leido = TRUE AND estado = 'no_leida'"))
    .then(() => db.run("UPDATE notificaciones SET vehiculo_id = referencia_id WHERE referencia_tipo = 'vehiculo' AND vehiculo_id IS NULL"))
    .then(() => db.run(`
      UPDATE notificaciones n
      SET vehiculo_id = m.vehiculo_id
      FROM mantenimientos m
      WHERE n.referencia_tipo = 'mantenimiento'
        AND n.referencia_id = m.id
        AND n.vehiculo_id IS NULL
    `))
    .then(seedRolesAndPermissions)
    .then(grantPermisosNuevos)
    .then(syncUserRoles)
    .then(seedAdminUser)
    .then(() => console.log("Columnas PostgreSQL verificadas"))
    .catch((error) => console.error("Error verificando columnas PostgreSQL", error.message));
}
