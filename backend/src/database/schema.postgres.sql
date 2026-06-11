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
);

CREATE TABLE IF NOT EXISTS mantenimientos (
  id BIGSERIAL PRIMARY KEY,
  vehiculo_id BIGINT NOT NULL REFERENCES vehiculos(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  tipo TEXT NOT NULL,
  descripcion TEXT,
  valor NUMERIC(12, 2) NOT NULL DEFAULT 0,
  kilometraje INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS documentos (
  id BIGSERIAL PRIMARY KEY,
  vehiculo_id BIGINT NOT NULL REFERENCES vehiculos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  numero_documento TEXT,
  fecha_expedicion DATE,
  fecha_vencimiento DATE,
  archivo_url TEXT,
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

CREATE INDEX IF NOT EXISTS idx_vehiculos_placa ON vehiculos (placa);
CREATE INDEX IF NOT EXISTS idx_mantenimientos_vehiculo_id ON mantenimientos (vehiculo_id);
CREATE INDEX IF NOT EXISTS idx_documentos_vehiculo_id ON documentos (vehiculo_id);
CREATE INDEX IF NOT EXISTS idx_cambios_aceite_vehiculo_id ON cambios_aceite (vehiculo_id);
