CREATE TABLE IF NOT EXISTS roles (
  id BIGSERIAL PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE,
  descripcion TEXT,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  permisos_configurados BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS permisos (
  id BIGSERIAL PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE,
  modulo TEXT NOT NULL,
  descripcion TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS roles_permisos (
  role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permiso_id BIGINT NOT NULL REFERENCES permisos(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permiso_id)
);

CREATE TABLE IF NOT EXISTS usuarios (
  id BIGSERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  rol TEXT NOT NULL DEFAULT 'Administrador',
  role_id BIGINT REFERENCES roles(id),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
);

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
);

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
);

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
);

CREATE TABLE IF NOT EXISTS cambios_aceite (
  id BIGSERIAL PRIMARY KEY,
  vehiculo_id BIGINT NOT NULL REFERENCES vehiculos(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  kilometraje_actual INTEGER NOT NULL,
  proximo_cambio_km INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Modulo de importacion de gastos vehiculares (Excel CARGUES_BODEGA) ──
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
);

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
);

CREATE TABLE IF NOT EXISTS gastos_operativos (
  id BIGSERIAL PRIMARY KEY,
  factura_id BIGINT NOT NULL REFERENCES facturas_vehiculares(id) ON DELETE CASCADE,
  tipo_gasto TEXT NOT NULL,
  valor NUMERIC(14, 3) NOT NULL DEFAULT 0,
  unidad TEXT NOT NULL,
  importacion_id BIGINT REFERENCES importaciones(id),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
);

CREATE TABLE IF NOT EXISTS detalle_importacion (
  id BIGSERIAL PRIMARY KEY,
  importacion_id BIGINT NOT NULL REFERENCES importaciones(id) ON DELETE CASCADE,
  factura_id BIGINT REFERENCES facturas_vehiculares(id) ON DELETE SET NULL,
  numero_factura TEXT NOT NULL,
  accion TEXT NOT NULL,
  hash_anterior TEXT,
  hash_nuevo TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vehiculos_placa ON vehiculos (placa);
CREATE UNIQUE INDEX IF NOT EXISTS idx_vehiculos_numero_chasis ON vehiculos (numero_chasis) WHERE numero_chasis IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vehiculos_estado ON vehiculos (estado);
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios (email);
CREATE INDEX IF NOT EXISTS idx_usuarios_role_id ON usuarios (role_id);
CREATE INDEX IF NOT EXISTS idx_mantenimientos_vehiculo_id ON mantenimientos (vehiculo_id);
CREATE INDEX IF NOT EXISTS idx_documentos_vehiculo_id ON documentos (vehiculo_id);
CREATE INDEX IF NOT EXISTS idx_cambios_aceite_vehiculo_id ON cambios_aceite (vehiculo_id);
CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario_id ON notificaciones (usuario_id);
CREATE INDEX IF NOT EXISTS idx_notificaciones_referencia ON notificaciones (referencia_tipo, referencia_id);
CREATE INDEX IF NOT EXISTS idx_notificaciones_estado ON notificaciones (usuario_id, estado);
CREATE INDEX IF NOT EXISTS idx_notificaciones_vehiculo_id ON notificaciones (vehiculo_id);
CREATE INDEX IF NOT EXISTS idx_importaciones_periodo ON importaciones (periodo);
CREATE INDEX IF NOT EXISTS idx_importaciones_estado ON importaciones (estado);
CREATE INDEX IF NOT EXISTS idx_facturas_vehiculares_vehiculo_id ON facturas_vehiculares (vehiculo_id);
CREATE INDEX IF NOT EXISTS idx_facturas_vehiculares_fecha_factura ON facturas_vehiculares (fecha_factura);
CREATE INDEX IF NOT EXISTS idx_facturas_vehiculares_estado_vehiculo ON facturas_vehiculares (estado_vehiculo);
CREATE INDEX IF NOT EXISTS idx_facturas_vehiculares_placa_original ON facturas_vehiculares (placa_original);
CREATE INDEX IF NOT EXISTS idx_gastos_operativos_factura_id ON gastos_operativos (factura_id);
CREATE INDEX IF NOT EXISTS idx_gastos_operativos_tipo_gasto ON gastos_operativos (tipo_gasto);
CREATE INDEX IF NOT EXISTS idx_incidencias_importacion_importacion_id ON incidencias_importacion (importacion_id);
CREATE INDEX IF NOT EXISTS idx_incidencias_importacion_resuelta ON incidencias_importacion (resuelta);
CREATE INDEX IF NOT EXISTS idx_detalle_importacion_importacion_id ON detalle_importacion (importacion_id);
CREATE INDEX IF NOT EXISTS idx_detalle_importacion_numero_factura ON detalle_importacion (numero_factura);
