const HttpError = require("../errors/http-error");
const mantenimientosRepository = require("../repositories/mantenimientos.repository");
const vehiculosRepository = require("../repositories/vehiculos.repository");

const TIPOS_VALIDOS = new Set([
  "revision",
  "preventivo",
  "correctivo",
  "cambio_aceite",
  "llantas",
  "frenos",
  "otro"
]);

function toNumberOrNull(value) {
  if (value === undefined || value === null || value === "") return null;
  let cleanValue = value;
  if (typeof value == "string") {
    cleanValue = value.replace(",", "."); 
  }
  const parsed = Number(cleanValue);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizePayload(payload) {
  return {
    vehiculo_id: toNumberOrNull(payload.vehiculo_id),
    fecha: String(payload.fecha || "").trim(),
    tipo: String(payload.tipo || "").trim(),
    descripcion: payload.descripcion ? String(payload.descripcion).trim() : null,
    autorizado_por: payload.autorizado_por ? String(payload.autorizado_por).trim() : null,
    hecho_por: payload.hecho_por ? String(payload.hecho_por).trim() : null,
    repuestos: payload.repuestos ? String(payload.repuestos).trim() : null,
    soporte_url: payload.soporte_url ? String(payload.soporte_url).trim() : null,
    soporte_nombre: payload.soporte_nombre ? String(payload.soporte_nombre).trim() : null,
    soporte_mime: payload.soporte_mime ? String(payload.soporte_mime).trim() : null,
    valor: toNumberOrNull(payload.valor) ?? 0,
    kilometraje: toNumberOrNull(payload.kilometraje)
  };
}

async function validateMantenimiento(mantenimiento) {
  if (!mantenimiento.vehiculo_id || !mantenimiento.fecha || !mantenimiento.tipo) {
    throw new HttpError(400, "Vehiculo, fecha y tipo son obligatorios");
  }

  if (!TIPOS_VALIDOS.has(mantenimiento.tipo)) {
    throw new HttpError(400, "Tipo de mantenimiento no valido");
  }

  if (mantenimiento.valor < 0) {
    throw new HttpError(400, "El valor no puede ser negativo");
  }

  if (mantenimiento.kilometraje !== null && mantenimiento.kilometraje < 0) {
    throw new HttpError(400, "El kilometraje no puede ser negativo");
  }

  const vehiculo = await vehiculosRepository.findById(mantenimiento.vehiculo_id);
  if (!vehiculo) {
    throw new HttpError(404, "Vehiculo no encontrado");
  }

  const kilometrajeActual = Number(vehiculo.kilometraje_actual || 0);
  if (mantenimiento.kilometraje !== null && mantenimiento.kilometraje < kilometrajeActual) {
    throw new HttpError(
      400,
      `El kilometraje debe ser mayor o igual al actual del vehiculo (${kilometrajeActual} km)`
    );
  }
}

async function listMantenimientos() {
  return mantenimientosRepository.findAll();
}

async function listMantenimientosByVehicle(vehiculoId) {
  return mantenimientosRepository.findByVehicle(vehiculoId);
}

async function createMantenimiento(payload, file) {
  const mantenimiento = normalizePayload({
    ...payload,
    soporte_url: file ? `/uploads/mantenimientos/${file.filename}` : null,
    soporte_nombre: file?.originalname || null,
    soporte_mime: file?.mimetype || null
  });
  await validateMantenimiento(mantenimiento);

  return mantenimientosRepository.create(mantenimiento);
}

module.exports = {
  listMantenimientos,
  listMantenimientosByVehicle,
  createMantenimiento
};
