const HttpError = require("../errors/http-error");
const vehiculosRepository = require("../repositories/vehiculos.repository");

const REQUIRED_FIELDS = [
  "codigo_interno",
  "marca",
  "modelo",
  "placa",
  "kilometraje_actual"
];

function toNumberOrNull(value) {
  if (value === undefined || value === null || value === "") return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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
    kilometraje_actual: toNumberOrNull(payload.kilometraje_actual)
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

  return vehiculosRepository.create(vehiculo);
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
