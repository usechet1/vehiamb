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
  ["vehicles.repuestos_sugeridos", "Vehiculos", "Configurar y usar repuestos sugeridos para cambio de aceite"],
  ["maintenance.view", "Mantenimientos", "Ver mantenimientos"],
  ["maintenance.create", "Mantenimientos", "Registrar mantenimientos"],
  ["maintenance.approve", "Mantenimientos", "Aprobar o rechazar mantenimientos"],
  ["documents.view", "Documentos", "Ver documentos"],
  ["documents.create", "Documentos", "Registrar documentos"],
  ["simit.view", "SIMIT", "Consultar SIMIT"],
  ["users.manage", "Usuarios", "Administrar usuarios"],
  ["imports.view", "Importaciones", "Ver importaciones de gastos vehiculares"],
  ["imports.manage", "Importaciones", "Ejecutar importaciones y resolver incidencias"],
  ["costs.view", "Costos", "Ver el dashboard de costos vehiculares"],
  ["inventory.view", "Inventario", "Ver el catalogo de repuestos y el stock"],
  ["inventory.manage", "Inventario", "Administrar repuestos y resolver incidencias del catalogo"],
  ["inventory.import", "Inventario", "Ver y ejecutar la sincronizacion de stock y configuracion de vehiculos (automatica por cron)"],
  ["inspections.view", "Inspecciones", "Ver el checklist de inspecciones preventivas"],
  ["inspections.create", "Inspecciones", "Registrar inspecciones preventivas"],
  ["trips.view", "Viajes", "Ver el historial de viajes"],
  ["trips.create", "Viajes", "Registrar el viaje e iniciar recorrido"],
  ["empresa.manage", "Empresa", "Editar el nombre y el logo de la empresa"],
  ["empresas.switch", "Empresas", "Cambiar de empresa activa entre todas las empresas"]
];

const ROLE_PERMISSIONS = {
  Administrador: PERMISSIONS.map(([codigo]) => codigo),
  // Rol de plataforma: mismos permisos que Administrador, mas la capacidad
  // de cambiar de empresa activa (ver empresas.switch) para operar como
  // administrador de cualquier empresa sin cerrar sesion. Se asigna a mano
  // (nunca por defecto) fuera de la app, igual que scripts/create-empresa.js.
  SuperAdministrador: PERMISSIONS.map(([codigo]) => codigo),
  Operador: [
    "dashboard.view",
    "vehicles.view",
    "vehicles.create",
    "vehicles.edit",
    "vehicles.repuestos_sugeridos",
    "maintenance.view",
    "maintenance.create",
    "documents.view",
    "documents.create",
    "simit.view",
    "costs.view",
    "inventory.view",
    "inventory.manage",
    "inspections.view",
    "inspections.create"
  ],
  Consulta: [
    "dashboard.view",
    "vehicles.view",
    "maintenance.view",
    "documents.view",
    "simit.view",
    "costs.view",
    "inventory.view",
    "inspections.view"
  ],
  // Personal que maneja los vehiculos: elige un vehiculo, revisa sus
  // mantenimientos/documentos y hace la inspeccion preventiva. Sin acceso a
  // ninguna otra opcion del sistema (ni crear/editar vehiculos, ni Gastos,
  // ni Usuarios, ni SIMIT, ni Inventario).
  Conductor: [
    "dashboard.view",
    "vehicles.view",
    "maintenance.view",
    "documents.view",
    "inspections.view",
    "inspections.create",
    "trips.view",
    "trips.create"
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
  "imports.view": ["Administrador"],
  "imports.manage": ["Administrador"],
  "costs.view": ["Administrador", "Operador", "Consulta"],
  "inventory.view": ["Administrador", "Operador", "Consulta"],
  "inventory.manage": ["Administrador", "Operador"],
  "inventory.import": ["Administrador"],
  "inspections.view": ["Administrador", "Operador", "Consulta"],
  "inspections.create": ["Administrador", "Operador"],
  "trips.view": ["Administrador", "Conductor"],
  "trips.create": ["Administrador", "Conductor"],
  "empresa.manage": ["Administrador"],
  "vehicles.repuestos_sugeridos": ["Administrador", "Operador", "SuperAdministrador"]
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

// Simetrico a PERMISOS_NUEVOS_POR_ROL pero en la otra direccion: revoca
// permisos que un rol tenia asignados y que la politica de acceso actual
// dice que ya no debe tener. Caso concreto: importar stock y sincronizar
// consolidados de gastos ahora corren solo por cron (ver gastos-sync.job.js,
// stock-import-scheduler.job.js, config-sync.job.js), asi que Operador y
// Consulta no necesitan ejecutarlos ni verlos manualmente. Se ejecuta en
// cada arranque -- si un administrador vuelve a marcar el permiso desde el
// panel, se le quitara de nuevo en el siguiente reinicio. Si algun dia se
// quiere permitir editarlo libremente desde el panel, hay que sacarlo de
// este mapa.
const PERMISOS_REVOCADOS_POR_ROL = {
  "imports.view": ["Operador", "Consulta"],
  "imports.manage": ["Operador", "Consulta"],
  "inventory.import": ["Operador", "Consulta"]
};

async function revocarPermisosObsoletos() {
  for (const [permissionCode, roleNames] of Object.entries(PERMISOS_REVOCADOS_POR_ROL)) {
    const permission = await db.get("SELECT id FROM permisos WHERE codigo = ?", [permissionCode]);
    if (!permission) continue;

    for (const roleName of roleNames) {
      const role = await db.get("SELECT id FROM roles WHERE nombre = ?", [roleName]);
      if (!role) continue;

      await db.run("DELETE FROM roles_permisos WHERE role_id = ? AND permiso_id = ?", [role.id, permission.id]);
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

  // En Postgres, usuarios.empresa_id es NOT NULL: el admin semilla se asigna
  // a la empresa por defecto (creada mas arriba en la cadena de migracion,
  // antes de que esta funcion corra).
  const empresaId = db.client === "postgres" ? await getEmpresaDefaultId() : null;

  await db.run(
    `
      INSERT INTO usuarios (nombre, email, password_hash, rol, role_id, activo${empresaId ? ", empresa_id" : ""})
      VALUES (?, ?, ?, ?, ?, ?${empresaId ? ", ?" : ""})
    `,
    [
      env.seedAdminName,
      env.seedAdminEmail.toLowerCase(),
      passwordHash,
      env.seedAdminRole,
      adminRole?.id || null,
      db.client === "postgres" ? true : 1,
      ...(empresaId ? [empresaId] : [])
    ]
  );
}

async function ensurePostgresTables() {
  // empresas (tenants): cada empresa cliente que compra la app. Se crea antes
  // que cualquier otra tabla porque muchas de las siguientes van a referenciar
  // empresas(id) via ensureColumn mas abajo en la cadena de migracion.
  await db.run(`
    CREATE TABLE IF NOT EXISTS empresas (
      id BIGSERIAL PRIMARY KEY,
      nombre TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      activo BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

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

  await db.run(`
    CREATE TABLE IF NOT EXISTS repuestos (
      id BIGSERIAL PRIMARY KEY,
      codigo_interno TEXT NOT NULL UNIQUE,
      nombre TEXT NOT NULL,
      categoria TEXT NOT NULL DEFAULT 'otros',
      marca TEXT,
      referencia TEXT,
      unidad_medida TEXT NOT NULL DEFAULT 'UND',
      valor_promedio NUMERIC(14, 2) NOT NULL DEFAULT 0,
      estado TEXT NOT NULL DEFAULT 'activo',
      observaciones TEXT,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS bodegas (
      id BIGSERIAL PRIMARY KEY,
      nombre TEXT NOT NULL,
      codigo TEXT NOT NULL UNIQUE,
      estado TEXT NOT NULL DEFAULT 'activa',
      creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS repuestos_stock (
      id BIGSERIAL PRIMARY KEY,
      repuesto_id BIGINT NOT NULL REFERENCES repuestos(id) ON DELETE CASCADE,
      bodega_id BIGINT NOT NULL REFERENCES bodegas(id),
      stock_fisico NUMERIC(14, 3) NOT NULL DEFAULT 0,
      stock_minimo NUMERIC(14, 3) NOT NULL DEFAULT 0,
      stock_comprometido NUMERIC(14, 3) NOT NULL DEFAULT 0,
      ubicacion_original TEXT,
      hash_fila TEXT,
      actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (repuesto_id, bodega_id)
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS movimientos_stock (
      id BIGSERIAL PRIMARY KEY,
      repuesto_id BIGINT NOT NULL REFERENCES repuestos(id),
      bodega_id BIGINT NOT NULL REFERENCES bodegas(id),
      tipo_movimiento TEXT NOT NULL,
      cantidad NUMERIC(14, 3) NOT NULL,
      stock_resultante NUMERIC(14, 3) NOT NULL,
      motivo TEXT,
      referencia_tipo TEXT,
      referencia_id BIGINT,
      usuario_id BIGINT REFERENCES usuarios(id),
      creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS importaciones_stock (
      id BIGSERIAL PRIMARY KEY,
      nombre_archivo TEXT NOT NULL,
      hash_archivo TEXT NOT NULL,
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
    CREATE TABLE IF NOT EXISTS incidencias_importacion_stock (
      id BIGSERIAL PRIMARY KEY,
      importacion_id BIGINT NOT NULL REFERENCES importaciones_stock(id) ON DELETE CASCADE,
      fila_excel INTEGER,
      codigo_interno TEXT,
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
    CREATE TABLE IF NOT EXISTS detalle_importacion_stock (
      id BIGSERIAL PRIMARY KEY,
      importacion_id BIGINT NOT NULL REFERENCES importaciones_stock(id) ON DELETE CASCADE,
      repuesto_id BIGINT REFERENCES repuestos(id) ON DELETE SET NULL,
      codigo_interno TEXT NOT NULL,
      accion TEXT NOT NULL,
      hash_anterior TEXT,
      hash_nuevo TEXT,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS vehiculo_repuestos_sugeridos (
      id BIGSERIAL PRIMARY KEY,
      vehiculo_id BIGINT NOT NULL REFERENCES vehiculos(id) ON DELETE CASCADE,
      tipo_mantenimiento TEXT NOT NULL DEFAULT 'cambio_aceite',
      repuesto_id BIGINT NOT NULL REFERENCES repuestos(id) ON DELETE CASCADE,
      cantidad NUMERIC(10, 3) NOT NULL DEFAULT 1,
      orden INTEGER NOT NULL DEFAULT 0,
      intervalo_km INTEGER,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (vehiculo_id, tipo_mantenimiento, repuesto_id)
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS repuestos_equivalencias (
      id BIGSERIAL PRIMARY KEY,
      repuesto_principal_id BIGINT NOT NULL REFERENCES repuestos(id) ON DELETE CASCADE,
      repuesto_equivalente_id BIGINT NOT NULL REFERENCES repuestos(id) ON DELETE CASCADE,
      prioridad INTEGER NOT NULL DEFAULT 1,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (repuesto_principal_id, repuesto_equivalente_id),
      CHECK (repuesto_principal_id <> repuesto_equivalente_id)
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS mantenimiento_repuestos (
      id BIGSERIAL PRIMARY KEY,
      mantenimiento_id BIGINT NOT NULL REFERENCES mantenimientos(id) ON DELETE CASCADE,
      repuesto_id BIGINT NOT NULL REFERENCES repuestos(id),
      repuesto_sugerido_id BIGINT REFERENCES repuestos(id),
      motivo_sustitucion TEXT,
      cantidad NUMERIC(10, 3) NOT NULL DEFAULT 1,
      valor_unitario NUMERIC(14, 2) NOT NULL DEFAULT 0,
      valor_total NUMERIC(14, 2) NOT NULL DEFAULT 0,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS configuracion_inventario (
      clave TEXT PRIMARY KEY,
      valor TEXT NOT NULL
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS importaciones_config_vehiculos (
      id BIGSERIAL PRIMARY KEY,
      nombre_archivo TEXT NOT NULL,
      usuario_id BIGINT REFERENCES usuarios(id),
      estado TEXT NOT NULL DEFAULT 'pendiente',
      total_sugeridos_creados INTEGER NOT NULL DEFAULT 0,
      total_equivalencias_creadas INTEGER NOT NULL DEFAULT 0,
      total_omitidos INTEGER NOT NULL DEFAULT 0,
      total_incidencias INTEGER NOT NULL DEFAULT 0,
      detalle_incidencias JSONB,
      duracion_ms INTEGER,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS simit_consultas (
      id BIGSERIAL PRIMARY KEY,
      vehiculo_id BIGINT NOT NULL REFERENCES vehiculos(id) ON DELETE CASCADE,
      placa TEXT NOT NULL,
      fecha_consulta TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      origen TEXT NOT NULL DEFAULT 'manual',
      estado_consulta TEXT NOT NULL DEFAULT 'ok',
      estado_cartera TEXT NOT NULL DEFAULT 'desconocido',
      total_comparendos INTEGER NOT NULL DEFAULT 0,
      valor_total NUMERIC(14, 2) NOT NULL DEFAULT 0,
      mensaje_error TEXT,
      resultado_raw JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS simit_comparendos (
      id BIGSERIAL PRIMARY KEY,
      consulta_id BIGINT NOT NULL REFERENCES simit_consultas(id) ON DELETE CASCADE,
      vehiculo_id BIGINT NOT NULL REFERENCES vehiculos(id) ON DELETE CASCADE,
      numero_comparendo TEXT NOT NULL,
      fecha_infraccion DATE,
      descripcion TEXT,
      valor NUMERIC(14, 2) NOT NULL DEFAULT 0,
      estado TEXT NOT NULL DEFAULT 'pendiente',
      detalle_json JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS inspecciones_preventivas (
      id BIGSERIAL PRIMARY KEY,
      vehiculo_id BIGINT NOT NULL REFERENCES vehiculos(id) ON DELETE CASCADE,
      usuario_id BIGINT REFERENCES usuarios(id),
      fecha TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      observaciones TEXT,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS inspeccion_items (
      id BIGSERIAL PRIMARY KEY,
      inspeccion_id BIGINT NOT NULL REFERENCES inspecciones_preventivas(id) ON DELETE CASCADE,
      vehiculo_id BIGINT NOT NULL REFERENCES vehiculos(id) ON DELETE CASCADE,
      item_codigo TEXT NOT NULL,
      item_label TEXT NOT NULL,
      estado TEXT NOT NULL DEFAULT 'bien',
      comentario TEXT,
      foto_url TEXT,
      foto_nombre TEXT,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS viajes (
      id BIGSERIAL PRIMARY KEY,
      vehiculo_id BIGINT NOT NULL REFERENCES vehiculos(id) ON DELETE CASCADE,
      usuario_id BIGINT REFERENCES usuarios(id),
      destino TEXT NOT NULL,
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
  await db.run("CREATE INDEX IF NOT EXISTS idx_facturas_vehiculares_placa_original ON facturas_vehiculares (placa_original)");
  await db.run("CREATE INDEX IF NOT EXISTS idx_gastos_operativos_factura_id ON gastos_operativos (factura_id)");
  await db.run("CREATE INDEX IF NOT EXISTS idx_gastos_operativos_tipo_gasto ON gastos_operativos (tipo_gasto)");
  await db.run("CREATE INDEX IF NOT EXISTS idx_incidencias_importacion_importacion_id ON incidencias_importacion (importacion_id)");
  await db.run("CREATE INDEX IF NOT EXISTS idx_incidencias_importacion_resuelta ON incidencias_importacion (resuelta)");
  await db.run("CREATE INDEX IF NOT EXISTS idx_detalle_importacion_importacion_id ON detalle_importacion (importacion_id)");
  await db.run("CREATE INDEX IF NOT EXISTS idx_detalle_importacion_numero_factura ON detalle_importacion (numero_factura)");
  await db.run("CREATE INDEX IF NOT EXISTS idx_repuestos_categoria ON repuestos (categoria)");
  await db.run("CREATE INDEX IF NOT EXISTS idx_repuestos_estado ON repuestos (estado)");
  await db.run("CREATE INDEX IF NOT EXISTS idx_repuestos_stock_repuesto_id ON repuestos_stock (repuesto_id)");
  await db.run("CREATE INDEX IF NOT EXISTS idx_movimientos_stock_repuesto_id ON movimientos_stock (repuesto_id)");
  await db.run("CREATE INDEX IF NOT EXISTS idx_importaciones_stock_estado ON importaciones_stock (estado)");
  await db.run("CREATE INDEX IF NOT EXISTS idx_incidencias_importacion_stock_importacion_id ON incidencias_importacion_stock (importacion_id)");
  await db.run("CREATE INDEX IF NOT EXISTS idx_incidencias_importacion_stock_resuelta ON incidencias_importacion_stock (resuelta)");
  await db.run("CREATE INDEX IF NOT EXISTS idx_detalle_importacion_stock_importacion_id ON detalle_importacion_stock (importacion_id)");
  await db.run("CREATE INDEX IF NOT EXISTS idx_vehiculo_repuestos_sugeridos_vehiculo_id ON vehiculo_repuestos_sugeridos (vehiculo_id)");
  await db.run("CREATE INDEX IF NOT EXISTS idx_repuestos_equivalencias_principal_id ON repuestos_equivalencias (repuesto_principal_id)");
  await db.run("CREATE INDEX IF NOT EXISTS idx_mantenimiento_repuestos_mantenimiento_id ON mantenimiento_repuestos (mantenimiento_id)");
  await db.run("CREATE INDEX IF NOT EXISTS idx_simit_consultas_vehiculo_id ON simit_consultas (vehiculo_id, fecha_consulta DESC)");
  await db.run("CREATE INDEX IF NOT EXISTS idx_simit_comparendos_consulta_id ON simit_comparendos (consulta_id)");
  await db.run("CREATE INDEX IF NOT EXISTS idx_simit_comparendos_vehiculo_numero ON simit_comparendos (vehiculo_id, numero_comparendo)");
  await db.run("CREATE INDEX IF NOT EXISTS idx_inspecciones_preventivas_vehiculo_id ON inspecciones_preventivas (vehiculo_id, fecha DESC)");
  await db.run("CREATE INDEX IF NOT EXISTS idx_inspeccion_items_inspeccion_id ON inspeccion_items (inspeccion_id)");
  await db.run("CREATE INDEX IF NOT EXISTS idx_viajes_usuario_id ON viajes (usuario_id, creado_en DESC)");

  // La bodega y configuracion por defecto ya NO se insertan aqui: bodegas.codigo
  // y configuracion_inventario.clave pasan a ser unicos POR EMPRESA (ver mas abajo
  // en la cadena de migracion, seedBodegaYConfigDefault), y en este punto la
  // tabla empresas todavia podria no tener filas (arranque en frio). Se siembran
  // despues de que exista la empresa por defecto y las constraints compuestas.
  // idx_notificaciones_estado e idx_notificaciones_vehiculo_id se crean mas abajo,
  // despues de ensureColumn: aqui correrian en cada arranque (incluso con la tabla
  // ya existente en una base antigua) y fallarian porque esas columnas aun no existen.
}

// ── Multi-tenancy (empresas) — solo aplica a la rama Postgres ──────────
//
// Cada empresa cliente ve solo sus propios datos. Se agrega empresa_id
// directo en cada tabla (no via JOIN al padre) para que cualquier
// repositorio pueda filtrar/verificar con "WHERE id = ? AND empresa_id = ?"
// sin necesitar conocer la cadena de FKs. roles/permisos/roles_permisos
// quedan GLOBALES a proposito (mismo catalogo de permisos para todas las
// empresas); usuarios.email tambien queda unico global (un email = una
// cuenta en toda la plataforma, el login no pide elegir empresa).
//
// Como esta migracion parte de una base con datos reales de una sola
// operacion, todo lo existente se asigna a una "empresa por defecto" que
// se crea aqui mismo si no existe ninguna todavia.
const TABLAS_CON_EMPRESA_ID = [
  "usuarios",
  "vehiculos",
  "mantenimientos",
  "documentos",
  "notificaciones",
  "cambios_aceite",
  "importaciones",
  "facturas_vehiculares",
  "gastos_operativos",
  "incidencias_importacion",
  "detalle_importacion",
  "repuestos",
  "bodegas",
  "repuestos_stock",
  "movimientos_stock",
  "importaciones_stock",
  "incidencias_importacion_stock",
  "detalle_importacion_stock",
  "vehiculo_repuestos_sugeridos",
  "repuestos_equivalencias",
  "mantenimiento_repuestos",
  "importaciones_config_vehiculos",
  "simit_consultas",
  "simit_comparendos",
  "inspecciones_preventivas",
  "inspeccion_items",
  "viajes"
];

async function seedEmpresaDefault() {
  await db.run(`
    INSERT INTO empresas (nombre, slug, activo)
    SELECT 'Empresa Principal', 'empresa-principal', TRUE
    WHERE NOT EXISTS (SELECT 1 FROM empresas)
  `);
}

async function getEmpresaDefaultId() {
  const row = await db.get("SELECT id FROM empresas ORDER BY id ASC LIMIT 1");
  return row?.id || null;
}

async function ensureEmpresaIdColumns() {
  await Promise.all(
    TABLAS_CON_EMPRESA_ID.map((tabla) => ensureColumn(tabla, "empresa_id", "BIGINT REFERENCES empresas(id)"))
  );
}

async function backfillEmpresaId() {
  const empresaId = await getEmpresaDefaultId();
  if (!empresaId) return;

  for (const tabla of TABLAS_CON_EMPRESA_ID) {
    await db.run(`UPDATE ${tabla} SET empresa_id = ? WHERE empresa_id IS NULL`, [empresaId]);
  }

  // configuracion_inventario todavia no tiene empresa_id (su PK es "clave"
  // sola): se agrega columna + backfill aparte porque no esta en la lista de
  // arriba (pasa a tener PK compuesta (empresa_id, clave), ver mas abajo).
  await ensureColumn("configuracion_inventario", "empresa_id", "BIGINT REFERENCES empresas(id)");
  await db.run("UPDATE configuracion_inventario SET empresa_id = ? WHERE empresa_id IS NULL", [empresaId]);
}

async function empresaIdIsNotNull(tabla) {
  const row = await db.get(
    `
      SELECT is_nullable
      FROM information_schema.columns
      WHERE table_name = ? AND column_name = 'empresa_id'
    `,
    [tabla]
  );
  return row?.is_nullable === "NO";
}

async function enforceEmpresaIdNotNull() {
  for (const tabla of [...TABLAS_CON_EMPRESA_ID, "configuracion_inventario"]) {
    if (await empresaIdIsNotNull(tabla)) continue;
    await db.run(`ALTER TABLE ${tabla} ALTER COLUMN empresa_id SET NOT NULL`);
  }
}

async function constraintExists(constraintName) {
  const row = await db.get("SELECT 1 FROM pg_constraint WHERE conname = ?", [constraintName]);
  return Boolean(row);
}

// Constraints UNIQUE/PK declaradas inline en ensurePostgresTables() que
// colisionarian entre empresas distintas (dos empresas no pueden compartir
// el espacio de nombres de placas, codigos de repuesto, etc.). Postgres les
// puso nombre automatico al crearlas (ej. "vehiculos_placa_key"): hay que
// tumbar ese nombre exacto y crear la version compuesta con empresa_id.
async function migrarConstraintsPorEmpresa() {
  const cambios = [
    { tabla: "vehiculos", constraintVieja: "vehiculos_placa_key", sql: "ALTER TABLE vehiculos ADD CONSTRAINT ux_vehiculos_empresa_placa UNIQUE (empresa_id, placa)", nuevoNombre: "ux_vehiculos_empresa_placa" },
    { tabla: "repuestos", constraintVieja: "repuestos_codigo_interno_key", sql: "ALTER TABLE repuestos ADD CONSTRAINT ux_repuestos_empresa_codigo UNIQUE (empresa_id, codigo_interno)", nuevoNombre: "ux_repuestos_empresa_codigo" },
    { tabla: "bodegas", constraintVieja: "bodegas_codigo_key", sql: "ALTER TABLE bodegas ADD CONSTRAINT ux_bodegas_empresa_codigo UNIQUE (empresa_id, codigo)", nuevoNombre: "ux_bodegas_empresa_codigo" },
    { tabla: "facturas_vehiculares", constraintVieja: "facturas_vehiculares_numero_factura_key", sql: "ALTER TABLE facturas_vehiculares ADD CONSTRAINT ux_facturas_empresa_numero UNIQUE (empresa_id, numero_factura)", nuevoNombre: "ux_facturas_empresa_numero" },
    { tabla: "repuestos_stock", constraintVieja: "repuestos_stock_repuesto_id_bodega_id_key", sql: "ALTER TABLE repuestos_stock ADD CONSTRAINT ux_repuestos_stock_empresa UNIQUE (empresa_id, repuesto_id, bodega_id)", nuevoNombre: "ux_repuestos_stock_empresa" },
    { tabla: "vehiculo_repuestos_sugeridos", constraintVieja: "vehiculo_repuestos_sugeridos_vehiculo_id_tipo_mantenimiento_key", sql: "ALTER TABLE vehiculo_repuestos_sugeridos ADD CONSTRAINT ux_vehiculo_repuestos_sugeridos_empresa UNIQUE (empresa_id, vehiculo_id, tipo_mantenimiento, repuesto_id)", nuevoNombre: "ux_vehiculo_repuestos_sugeridos_empresa" },
    { tabla: "repuestos_equivalencias", constraintVieja: "repuestos_equivalencias_repuesto_principal_id_repuesto_equi_key", sql: "ALTER TABLE repuestos_equivalencias ADD CONSTRAINT ux_repuestos_equivalencias_empresa UNIQUE (empresa_id, repuesto_principal_id, repuesto_equivalente_id)", nuevoNombre: "ux_repuestos_equivalencias_empresa" }
  ];

  for (const cambio of cambios) {
    if (await constraintExists(cambio.constraintVieja)) {
      await db.run(`ALTER TABLE ${cambio.tabla} DROP CONSTRAINT ${cambio.constraintVieja}`);
    }
    if (!(await constraintExists(cambio.nuevoNombre))) {
      await db.run(cambio.sql);
    }
  }

  // vehiculos.numero_chasis usa un indice unico parcial (no una constraint con
  // nombre de PK), se maneja aparte con CREATE/DROP INDEX en vez de CONSTRAINT.
  await db.run("DROP INDEX IF EXISTS idx_vehiculos_numero_chasis");
  await db.run(
    "CREATE UNIQUE INDEX IF NOT EXISTS ux_vehiculos_empresa_numero_chasis ON vehiculos (empresa_id, numero_chasis) WHERE numero_chasis IS NOT NULL"
  );

  // configuracion_inventario: la PK pasa de "clave" sola a (empresa_id, clave).
  if (await constraintExists("configuracion_inventario_pkey")) {
    await db.run("ALTER TABLE configuracion_inventario DROP CONSTRAINT configuracion_inventario_pkey");
  }
  if (!(await constraintExists("configuracion_inventario_empresa_clave_pkey"))) {
    await db.run(
      "ALTER TABLE configuracion_inventario ADD CONSTRAINT configuracion_inventario_empresa_clave_pkey PRIMARY KEY (empresa_id, clave)"
    );
  }
}

async function seedBodegaYConfigDefault() {
  const empresaId = await getEmpresaDefaultId();
  if (!empresaId) return;

  await db.run(
    `
      INSERT INTO bodegas (nombre, codigo, empresa_id)
      VALUES ('Bodega Principal', 'PRINCIPAL', ?)
      ON CONFLICT (empresa_id, codigo) DO NOTHING
    `,
    [empresaId]
  );

  await db.run(
    `
      INSERT INTO configuracion_inventario (clave, valor, empresa_id)
      VALUES ('stock_insuficiente_bloquea', 'false', ?)
      ON CONFLICT (empresa_id, clave) DO NOTHING
    `,
    [empresaId]
  );
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
    .then(revocarPermisosObsoletos)
    .then(syncUserRoles)
    .then(seedAdminUser)
    .then(() => console.log("Tablas verificadas/creadas"))
    .catch((error) => console.error("Error verificando columnas", error.message));
} else {
  ensurePostgresTables()
    .then(seedEmpresaDefault)
    .then(() => Promise.all([
      ensureColumn("empresas", "logo_url", "TEXT"),
      ensureColumn("empresas", "modulos_deshabilitados", "TEXT[] NOT NULL DEFAULT '{}'"),
      ensureColumn("repuestos", "foto_url", "TEXT"),
      ensureColumn("vehiculos", "intervalo_cambio_aceite_km", "INTEGER"),
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
      ensureColumn("notificaciones", "updated_at", "TIMESTAMPTZ NOT NULL DEFAULT NOW()"),
      ensureColumn("importaciones_config_vehiculos", "hash_archivo", "TEXT")
    ]))
    .then(ensureEmpresaIdColumns)
    .then(() => Promise.all([
      ensureNumericColumn("vehiculos", "kilometraje_actual"),
      ensureNumericColumn("vehiculos", "capacidad_carga")
    ]))
    .then(backfillEmpresaId)
    .then(enforceEmpresaIdNotNull)
    .then(migrarConstraintsPorEmpresa)
    .then(seedBodegaYConfigDefault)
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
    .then(revocarPermisosObsoletos)
    .then(syncUserRoles)
    .then(seedAdminUser)
    .then(() => console.log("Columnas PostgreSQL verificadas"))
    .catch((error) => console.error("Error verificando columnas PostgreSQL", error.message));
}
