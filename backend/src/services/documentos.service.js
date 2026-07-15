const HttpError = require("../errors/http-error");
const documentosRepository = require("../repositories/documentos.repository");
const vehiculosRepository = require("../repositories/vehiculos.repository");

const TIPOS_VALIDOS = new Set([
  "tecnomecanica",
  "soat",
  "seguro",
  "tarjeta_operacion",
  "otro"
]);

function toNumberOrNull(value) {
  if (value === undefined || value === null || value === "") return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizePayload(payload) {
  return {
    vehiculo_id: toNumberOrNull(payload.vehiculo_id),
    tipo: String(payload.tipo || "").trim(),
    numero_documento: payload.numero_documento ? String(payload.numero_documento).trim() : null,
    fecha_expedicion: payload.fecha_expedicion ? String(payload.fecha_expedicion).trim() : null,
    fecha_vencimiento: String(payload.fecha_vencimiento || "").trim(),
    archivo_url: payload.archivo_url ? String(payload.archivo_url).trim() : null,
    archivo_nombre: payload.archivo_nombre ? String(payload.archivo_nombre).trim() : null,
    archivo_mime: payload.archivo_mime ? String(payload.archivo_mime).trim() : null
  };
}

async function validateDocumento(documento, empresaId) {
  if (!documento.vehiculo_id || !documento.tipo || !documento.fecha_vencimiento) {
    throw new HttpError(400, "Vehículo, tipo y fecha de vencimiento son obligatorios");
  }

  if (!TIPOS_VALIDOS.has(documento.tipo)) {
    throw new HttpError(400, "Tipo de documento no valido");
  }

  const vehiculo = await vehiculosRepository.findById(documento.vehiculo_id, empresaId);
  if (!vehiculo) {
    throw new HttpError(404, "Vehículo no encontrado");
  }
}

async function listDocumentos(empresaId) {
  return documentosRepository.findAll(empresaId);
}

async function listDocumentosByVehicle(vehiculoId, empresaId) {
  return documentosRepository.findByVehicle(vehiculoId, empresaId);
}

async function createDocumento(payload, file, empresaId) {
  const documento = normalizePayload({
    ...payload,
    archivo_url: file ? `/uploads/documentos/${file.filename}` : null,
    archivo_nombre: file?.originalname || null,
    archivo_mime: file?.mimetype || null
  });
  await validateDocumento(documento, empresaId);
  documento.empresa_id = empresaId;

  return documentosRepository.create(documento);
}

module.exports = {
  listDocumentos,
  listDocumentosByVehicle,
  createDocumento
};
