const fs = require("fs/promises");
const path = require("path");
const HttpError = require("../errors/http-error");
const conductorLicenciasRepository = require("../repositories/conductor-licencias.repository");
const conductoresRepository = require("../repositories/conductores.repository");

const UPLOADS_ROOT = path.resolve(__dirname, "..", "..", "uploads");

// Categorias reales de licencia de conduccion en Colombia (Resolucion
// 3245 de 2009 / Codigo Nacional de Transito): motos (A1/A2), particulares
// (B1/B2/B3) y servicio publico/carga (C1/C2/C3).
const LICENCIA_CATEGORIAS_VALIDAS = new Set(["A1", "A2", "B1", "B2", "B3", "C1", "C2", "C3"]);
const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

async function eliminarArchivoAnterior(archivoUrl) {
  if (!archivoUrl) return;

  try {
    await fs.unlink(path.join(UPLOADS_ROOT, archivoUrl.replace(/^\/uploads[\\/]/, "")));
  } catch (error) {
    // Si el archivo ya no existe o no se puede borrar, no interrumpe el flujo principal.
  }
}

function toTrimmedOrNull(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
}

function validarCategoria(categoria) {
  if (!LICENCIA_CATEGORIAS_VALIDAS.has(categoria)) {
    throw new HttpError(400, "La categoría de licencia no es válida");
  }
}

function validarFechaVencimiento(fecha) {
  if (fecha && !FECHA_REGEX.test(fecha)) {
    throw new HttpError(400, "La fecha de vencimiento no es válida");
  }
}

async function obtenerConductorOFallar(conductorId, empresaId) {
  const conductor = await conductoresRepository.findById(conductorId, empresaId);
  if (!conductor) {
    throw new HttpError(404, "Conductor no encontrado");
  }
  return conductor;
}

async function listLicencias(conductorId, empresaId) {
  await obtenerConductorOFallar(conductorId, empresaId);
  return conductorLicenciasRepository.findByConductor(conductorId, empresaId);
}

async function createLicencia(conductorId, payload, file, empresaId) {
  await obtenerConductorOFallar(conductorId, empresaId);

  const categoria = toTrimmedOrNull(payload.categoria);
  const fechaVencimiento = toTrimmedOrNull(payload.fecha_vencimiento);
  validarCategoria(categoria);
  validarFechaVencimiento(fechaVencimiento);

  return conductorLicenciasRepository.create({
    conductor_id: conductorId,
    categoria,
    fecha_vencimiento: fechaVencimiento,
    archivo_url: file ? `/uploads/conductores/${file.filename}` : null,
    archivo_nombre: file?.originalname || null,
    archivo_mime: file?.mimetype || null,
    empresa_id: empresaId
  });
}

async function updateLicencia(id, payload, file, empresaId) {
  const existente = await conductorLicenciasRepository.findById(id, empresaId);
  if (!existente) {
    throw new HttpError(404, "Licencia no encontrada");
  }

  const categoria = toTrimmedOrNull(payload.categoria);
  const fechaVencimiento = toTrimmedOrNull(payload.fecha_vencimiento);
  validarCategoria(categoria);
  validarFechaVencimiento(fechaVencimiento);

  const actualizada = await conductorLicenciasRepository.update(
    id,
    {
      conductor_id: existente.conductor_id,
      categoria,
      fecha_vencimiento: fechaVencimiento,
      archivo_url: file ? `/uploads/conductores/${file.filename}` : existente.archivo_url,
      archivo_nombre: file ? file.originalname : existente.archivo_nombre,
      archivo_mime: file ? file.mimetype : existente.archivo_mime,
      empresa_id: empresaId
    },
    empresaId
  );

  if (file && existente.archivo_url) {
    await eliminarArchivoAnterior(existente.archivo_url);
  }

  return actualizada;
}

async function deleteLicencia(id, empresaId) {
  const existente = await conductorLicenciasRepository.findById(id, empresaId);
  if (!existente) {
    throw new HttpError(404, "Licencia no encontrada");
  }

  const eliminada = await conductorLicenciasRepository.remove(id, empresaId);
  await eliminarArchivoAnterior(existente.archivo_url);
  return eliminada;
}

module.exports = {
  listLicencias,
  createLicencia,
  updateLicencia,
  deleteLicencia
};
