const HttpError = require("../errors/http-error");
const vehiculosRepository = require("../repositories/vehiculos.repository");

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

const ANIO_MIN = 1950;
const CILINDRAJE_MAX = 20000;

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
    anio: toNumberOrNull(payload.anio),
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

  if (vehiculo.anio !== null) {
    const anioMax = new Date().getFullYear() + 1;

    if (vehiculo.anio < ANIO_MIN || vehiculo.anio > anioMax) {
      throw new HttpError(400, `El año debe estar entre ${ANIO_MIN} y ${anioMax}`);
    }
  }

  if (vehiculo.cilindraje !== null) {
    if (vehiculo.cilindraje < 0 || vehiculo.cilindraje > CILINDRAJE_MAX) {
      throw new HttpError(400, `El cilindraje debe estar entre 0 y ${CILINDRAJE_MAX} c.c.`);
    }
  }

  if (vehiculo.numero_chasis) {
    const vin = vehiculo.numero_chasis;

    if (vin.length < VIN_MIN_LENGTH || vin.length > VIN_MAX_LENGTH || !VIN_REGEX.test(vin)) {
      throw new HttpError(400, "El numero de chasis (VIN) debe ser alfanumerico y tener una longitud valida (5 a 17 caracteres)");
    }
  }
}

async function listVehiculos() {
  return vehiculosRepository.findAll();
}

async function getVehiculo(id) {
  const vehiculo = await vehiculosRepository.findById(id);

  if (!vehiculo) {
    throw new HttpError(404, "Vehículo no encontrado");
  }

  return vehiculo;
}

async function createVehiculo(payload) {
  const vehiculo = normalizePayload(payload);
  validateVehiculo(vehiculo);

  try {
    return await vehiculosRepository.create(vehiculo);
  } catch (error) {
    if (error.code === "23505" && String(error.constraint || "").includes("vehiculos_placa")) {
      throw new HttpError(409, "Ya existe un vehiculo registrado con esa placa");
    }

    if (error.code === "23505" && String(error.constraint || "").includes("numero_chasis")) {
      throw new HttpError(409, "Ya existe un vehiculo registrado con ese numero de chasis (VIN)");
    }

    throw error;
  }
}

async function deleteVehiculo(id) {
  const result = await vehiculosRepository.remove(id);

  if (!result.changes) {
    throw new HttpError(404, "Vehículo no encontrado");
  }
}

module.exports = {
  listVehiculos,
  getVehiculo,
  createVehiculo,
  deleteVehiculo
};
