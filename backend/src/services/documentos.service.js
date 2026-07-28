const fs = require("fs/promises");
const path = require("path");
const HttpError = require("../errors/http-error");
const documentosRepository = require("../repositories/documentos.repository");
const vehiculosRepository = require("../repositories/vehiculos.repository");

const UPLOADS_ROOT = path.resolve(__dirname, "..", "..", "uploads");

async function eliminarArchivoAnterior(archivoUrl) {
  if (!archivoUrl) return;

  try {
    await fs.unlink(path.join(UPLOADS_ROOT, archivoUrl.replace(/^\/uploads[\\/]/, "")));
  } catch (error) {
    // Si el archivo ya no existe o no se puede borrar, no interrumpe el flujo principal.
  }
}

const TIPOS_VALIDOS = new Set([
  "tecnomecanica",
  "soat",
  "seguro",
  "licencia_transito",
  "otro"
]);

// La licencia de transito (documento de propiedad del vehiculo en Colombia)
// no tiene fecha de vencimiento -- solo fecha de expedicion y numero -- a
// diferencia de RTM/SOAT/seguro/tarjeta de operacion que si vencen.
const TIPOS_SIN_VENCIMIENTO = new Set(["licencia_transito"]);

// Catalogo fijo de propietarios validos para la licencia de transito (los dos
// unicos titulares bajo los que puede quedar registrado un vehiculo de la
// flota). Se resuelve en el servidor a partir del numero recibido para que el
// nombre/tipo de identificacion nunca dependa de lo que mande el cliente.
const PROPIETARIOS_CATALOGO = [
  { tipo_identificacion: "NIT", numero_identificacion: "830514610", nombre: "AMBIENTES CERAMICOS LTDA" },
  { tipo_identificacion: "CC", numero_identificacion: "79539118", nombre: "RENE OSWALDO USECHE CAMACHO" }
];

function resolverPropietario(numeroIdentificacion) {
  return PROPIETARIOS_CATALOGO.find((propietario) => propietario.numero_identificacion === numeroIdentificacion) || null;
}

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
    fecha_vencimiento: payload.fecha_vencimiento ? String(payload.fecha_vencimiento).trim() : null,
    archivo_url: payload.archivo_url ? String(payload.archivo_url).trim() : null,
    archivo_nombre: payload.archivo_nombre ? String(payload.archivo_nombre).trim() : null,
    archivo_mime: payload.archivo_mime ? String(payload.archivo_mime).trim() : null,
    propietario_numero_identificacion: payload.propietario_numero_identificacion ? String(payload.propietario_numero_identificacion).trim() : null
  };
}

async function validateDocumento(documento, empresaId) {
  if (!documento.vehiculo_id || !documento.tipo) {
    throw new HttpError(400, "Vehículo y tipo son obligatorios");
  }

  if (!TIPOS_VALIDOS.has(documento.tipo)) {
    throw new HttpError(400, "Tipo de documento no valido");
  }

  if (TIPOS_SIN_VENCIMIENTO.has(documento.tipo)) {
    if (!documento.numero_documento) {
      throw new HttpError(400, "El número de la licencia de tránsito es obligatorio");
    }

    const propietario = resolverPropietario(documento.propietario_numero_identificacion);
    if (!propietario) {
      throw new HttpError(400, "Debes seleccionar un propietario válido para la licencia de tránsito");
    }

    documento.propietario_tipo_identificacion = propietario.tipo_identificacion;
    documento.propietario_numero_identificacion = propietario.numero_identificacion;
    documento.propietario_nombre = propietario.nombre;
  } else if (!documento.fecha_vencimiento) {
    throw new HttpError(400, "La fecha de vencimiento es obligatoria para este tipo de documento");
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

async function updateDocumento(id, payload, file, empresaId) {
  const existing = await documentosRepository.findById(id, empresaId);
  if (!existing) {
    throw new HttpError(404, "Documento no encontrado");
  }

  const documento = normalizePayload({
    ...payload,
    archivo_url: file ? `/uploads/documentos/${file.filename}` : existing.archivo_url,
    archivo_nombre: file ? file.originalname : existing.archivo_nombre,
    archivo_mime: file ? file.mimetype : existing.archivo_mime
  });
  await validateDocumento(documento, empresaId);
  documento.empresa_id = empresaId;

  const actualizado = await documentosRepository.update(id, documento, empresaId);

  if (file && existing.archivo_url) {
    await eliminarArchivoAnterior(existing.archivo_url);
  }

  return actualizado;
}

async function deleteDocumento(id, empresaId) {
  const existing = await documentosRepository.findById(id, empresaId);
  if (!existing) {
    throw new HttpError(404, "Documento no encontrado");
  }

  await documentosRepository.remove(id, empresaId);
  await eliminarArchivoAnterior(existing.archivo_url);
}

module.exports = {
  listDocumentos,
  listDocumentosByVehicle,
  createDocumento,
  updateDocumento,
  deleteDocumento
};
