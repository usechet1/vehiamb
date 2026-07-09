const fs = require("fs/promises");
const path = require("path");
const HttpError = require("../errors/http-error");
const vehiculosRepository = require("../repositories/vehiculos.repository");
const vehiculoRepuestosSugeridosRepository = require("../repositories/vehiculo-repuestos-sugeridos.repository");
const notificacionesService = require("./notificaciones.service");

const UPLOADS_ROOT = path.resolve(__dirname, "..", "..", "uploads");

async function eliminarImagenAnterior(imagenUrl) {
  if (!imagenUrl) return;

  try {
    await fs.unlink(path.join(UPLOADS_ROOT, imagenUrl.replace(/^\/uploads[\\/]/, "")));
  } catch (error) {
    // Si el archivo ya no existe o no se puede borrar, no interrumpe el flujo principal.
  }
}

const REQUIRED_FIELDS = [
  "codigo_interno",
  "marca",
  "modelo",
  "placa",
  "kilometraje_actual",
  "tipo_vehiculo"
];

const VIN_REGEX = /^[A-HJ-NPR-Z0-9]+$/i;
const VIN_MIN_LENGTH = 5;
const VIN_MAX_LENGTH = 17;

const ANIO_MIN = 1900;
const ANIO_REGEX = /^\d{4}$/;
const CILINDRAJE_MAX = 20000;

function validarAnio(rawValue) {
  const raw = rawValue === undefined || rawValue === null ? "" : String(rawValue).trim();

  if (!raw) {
    throw new HttpError(400, "El campo Año es obligatorio.");
  }

  if (!ANIO_REGEX.test(raw)) {
    throw new HttpError(400, "Ingrese un año válido de cuatro dígitos.");
  }

  const anio = Number(raw);
  const anioMax = new Date().getFullYear() + 1;

  if (anio < ANIO_MIN || anio > anioMax) {
    throw new HttpError(400, `El año debe estar entre ${ANIO_MIN} y ${anioMax}.`);
  }

  return anio;
}

const ESTADOS_VEHICULO = new Set(["activo", "reparacion", "fuera_servicio"]);

const PAGE_SIZE_OPTIONS = new Set([10, 20, 50, 100]);
const DEFAULT_LIMIT = 20;

function toNumberOrNull(value) {
  if (value === undefined || value === null || value === "") return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toTrimmedOrNull(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
}

function normalizePayload(payload) {
  return {
    codigo_interno: String(payload.codigo_interno || "").trim(),
    marca: String(payload.marca || "").trim(),
    modelo: String(payload.modelo || "").trim(),
    anio: payload.anio,
    color: payload.color ? String(payload.color).trim() : null,
    combustible: payload.combustible ? String(payload.combustible).trim() : null,
    cilindraje: toNumberOrNull(payload.cilindraje),
    capacidad_carga: toNumberOrNull(payload.capacidad_carga),
    placa: String(payload.placa || "").trim().toUpperCase(),
    kilometraje_actual: toNumberOrNull(payload.kilometraje_actual),
    tipo_vehiculo: toTrimmedOrNull(payload.tipo_vehiculo),
    tipo_carroceria: toTrimmedOrNull(payload.tipo_carroceria),
    numero_chasis: toTrimmedOrNull(payload.numero_chasis)?.toUpperCase() || null,
    numero_motor: toTrimmedOrNull(payload.numero_motor)
  };
}

function validateVehiculo(vehiculo) {
  const missingFields = REQUIRED_FIELDS.filter((field) => {
    const value = vehiculo[field];
    return value === null || value === undefined || value === "";
  });

  if (missingFields.length) {
    throw new HttpError(400, `Campos obligatorios faltantes: ${missingFields.join(", ")}`);
  }

  if (vehiculo.kilometraje_actual < 0) {
    throw new HttpError(400, "El kilometraje no puede ser negativo");
  }

  if (vehiculo.capacidad_carga !== null && vehiculo.capacidad_carga < 0) {
    throw new HttpError(400, "La capacidad de carga no puede ser negativa");
  }

  vehiculo.anio = validarAnio(vehiculo.anio);

  if (vehiculo.cilindraje !== null) {
    if (vehiculo.cilindraje < 0 || vehiculo.cilindraje > CILINDRAJE_MAX) {
      throw new HttpError(400, `El cilindraje debe estar entre 0 y ${CILINDRAJE_MAX} c.c.`);
    }
  }

  if (vehiculo.numero_chasis) {
    const vin = vehiculo.numero_chasis;

    if (vin.length < VIN_MIN_LENGTH || vin.length > VIN_MAX_LENGTH || !VIN_REGEX.test(vin)) {
      throw new HttpError(400, "El número de chasis (VIN) debe ser alfanumérico y tener una longitud válida (5 a 17 caracteres)");
    }
  }
}

function normalizeSearch(value) {
  if (!value) return null;
  const normalized = String(value).trim().replace(/\s+/g, " ");
  return normalized || null;
}

function normalizeListQuery(query = {}) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = PAGE_SIZE_OPTIONS.has(Number(query.limit)) ? Number(query.limit) : DEFAULT_LIMIT;
  const sort = vehiculosRepository.SORT_KEYS.includes(query.sort) ? query.sort : vehiculosRepository.DEFAULT_SORT;

  return {
    search: normalizeSearch(query.search),
    estado: ESTADOS_VEHICULO.has(query.estado) ? query.estado : null,
    tipo: toTrimmedOrNull(query.tipo),
    marca: toTrimmedOrNull(query.marca),
    sort,
    page,
    limit,
    offset: (page - 1) * limit
  };
}

async function listVehiculos(query) {
  const filters = normalizeListQuery(query);
  const { rows, total } = await vehiculosRepository.findAll(filters);
  const totalPages = Math.max(1, Math.ceil(total / filters.limit));

  return {
    items: rows,
    page: filters.page,
    limit: filters.limit,
    total,
    totalPages
  };
}

async function getMarcas() {
  return vehiculosRepository.findDistinctMarcas();
}

async function listVehiculosSimple() {
  return vehiculosRepository.findAllSimple();
}

async function getVehiculo(id) {
  const vehiculo = await vehiculosRepository.findById(id);

  if (!vehiculo) {
    throw new HttpError(404, "Vehículo no encontrado");
  }

  return vehiculo;
}

async function createVehiculo(payload, file) {
  const vehiculo = normalizePayload(payload);
  vehiculo.imagen_url = file ? `/uploads/vehiculos/${file.filename}` : null;
  validateVehiculo(vehiculo);

  try {
    return await vehiculosRepository.create(vehiculo);
  } catch (error) {
    if (error.code === "23505" && String(error.constraint || "").includes("vehiculos_placa")) {
      throw new HttpError(409, "Ya existe un vehículo registrado con esa placa");
    }

    if (error.code === "23505" && String(error.constraint || "").includes("numero_chasis")) {
      throw new HttpError(409, "Ya existe un vehículo registrado con ese número de chasis (VIN)");
    }

    throw error;
  }
}

async function updateVehiculo(id, payload, file) {
  const existing = await vehiculosRepository.findById(id);

  if (!existing) {
    throw new HttpError(404, "Vehículo no encontrado");
  }

  const vehiculo = normalizePayload(payload);
  vehiculo.estado = ESTADOS_VEHICULO.has(payload.estado) ? payload.estado : existing.estado;
  vehiculo.imagen_url = file ? `/uploads/vehiculos/${file.filename}` : existing.imagen_url;
  validateVehiculo(vehiculo);

  try {
    const actualizado = await vehiculosRepository.update(id, vehiculo);

    if (file && existing.imagen_url) {
      await eliminarImagenAnterior(existing.imagen_url);
    }

    return actualizado;
  } catch (error) {
    if (error.code === "23505" && String(error.constraint || "").includes("vehiculos_placa")) {
      throw new HttpError(409, "Ya existe un vehículo registrado con esa placa");
    }

    if (error.code === "23505" && String(error.constraint || "").includes("numero_chasis")) {
      throw new HttpError(409, "Ya existe un vehículo registrado con ese número de chasis (VIN)");
    }

    throw error;
  }
}

async function updateEstadoVehiculo(id, estado) {
  if (!ESTADOS_VEHICULO.has(estado)) {
    throw new HttpError(400, `Estado invalido. Valores permitidos: ${[...ESTADOS_VEHICULO].join(", ")}`);
  }

  const existing = await vehiculosRepository.findById(id);

  if (!existing) {
    throw new HttpError(404, "Vehículo no encontrado");
  }

  const actualizado = await vehiculosRepository.updateEstado(id, estado);

  notificacionesService
    .notificarCambioEstadoVehiculo({ vehiculo: actualizado, estadoAnterior: existing.estado, estadoNuevo: estado })
    .catch((error) => {
      console.error("No fue posible notificar el cambio de estado del vehiculo:", error.message);
    });

  return actualizado;
}

async function deleteVehiculo(id) {
  const result = await vehiculosRepository.remove(id);

  if (!result.changes) {
    throw new HttpError(404, "Vehículo no encontrado");
  }
}

const TIPOS_MANTENIMIENTO_VALIDOS = new Set([
  "revision",
  "preventivo",
  "correctivo",
  "cambio_aceite",
  "llantas",
  "frenos",
  "otro"
]);

async function getRepuestosSugeridos(vehiculoId, tipoMantenimiento) {
  const tipo = TIPOS_MANTENIMIENTO_VALIDOS.has(tipoMantenimiento) ? tipoMantenimiento : "cambio_aceite";
  await getVehiculo(vehiculoId);
  return vehiculoRepuestosSugeridosRepository.findByVehiculo(vehiculoId, tipo);
}

async function updateRepuestosSugeridos(vehiculoId, tipoMantenimiento, items) {
  const tipo = TIPOS_MANTENIMIENTO_VALIDOS.has(tipoMantenimiento) ? tipoMantenimiento : "cambio_aceite";
  await getVehiculo(vehiculoId);

  if (!Array.isArray(items)) {
    throw new HttpError(400, "items debe ser un arreglo");
  }

  const normalizados = items
    .map((item, index) => ({
      repuesto_id: Number(item.repuesto_id),
      cantidad: Number(item.cantidad) > 0 ? Number(item.cantidad) : 1,
      orden: Number.isFinite(Number(item.orden)) ? Number(item.orden) : index,
      intervalo_km: item.intervalo_km ? Number(item.intervalo_km) : null
    }))
    .filter((item) => item.repuesto_id);

  await vehiculoRepuestosSugeridosRepository.replaceParaVehiculoYTipo(vehiculoId, tipo, normalizados);
  return vehiculoRepuestosSugeridosRepository.findByVehiculo(vehiculoId, tipo);
}

module.exports = {
  listVehiculos,
  listVehiculosSimple,
  getVehiculo,
  getMarcas,
  createVehiculo,
  updateVehiculo,
  updateEstadoVehiculo,
  deleteVehiculo,
  getRepuestosSugeridos,
  updateRepuestosSugeridos,
  ESTADOS_VEHICULO
};
