const HttpError = require("../errors/http-error");
const repuestosRepository = require("../repositories/repuestos.repository");

const CATEGORIAS_VALIDAS = new Set([
  "aceite_motor",
  "filtro_aceite",
  "filtro_aire",
  "filtro_combustible",
  "llantas",
  "baterias",
  "lubricantes",
  "refrigerantes",
  "correas",
  "bombillos",
  "otros"
]);

const ESTADOS_VALIDOS = new Set(["activo", "inactivo"]);

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
    nombre: String(payload.nombre || "").trim(),
    categoria: CATEGORIAS_VALIDAS.has(payload.categoria) ? payload.categoria : "otros",
    marca: toTrimmedOrNull(payload.marca),
    referencia: toTrimmedOrNull(payload.referencia),
    unidad_medida: toTrimmedOrNull(payload.unidad_medida) || "UND",
    valor_promedio: toNumberOrNull(payload.valor_promedio) ?? 0,
    estado: ESTADOS_VALIDOS.has(payload.estado) ? payload.estado : "activo",
    observaciones: toTrimmedOrNull(payload.observaciones)
  };
}

function validateRepuesto(repuesto) {
  if (!repuesto.codigo_interno || !repuesto.nombre) {
    throw new HttpError(400, "Código interno y nombre son obligatorios");
  }

  if (repuesto.valor_promedio < 0) {
    throw new HttpError(400, "El valor promedio no puede ser negativo");
  }
}

function normalizeListQuery(query = {}) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = PAGE_SIZE_OPTIONS.has(Number(query.limit)) ? Number(query.limit) : DEFAULT_LIMIT;

  return {
    categoria: CATEGORIAS_VALIDAS.has(query.categoria) ? query.categoria : null,
    estado: ESTADOS_VALIDOS.has(query.estado) ? query.estado : null,
    search: toTrimmedOrNull(query.search),
    page,
    limit,
    offset: (page - 1) * limit
  };
}

async function listRepuestos(query, empresaId) {
  const filters = normalizeListQuery(query);
  const { rows, total } = await repuestosRepository.findAll(filters, empresaId);
  const totalPages = Math.max(1, Math.ceil(total / filters.limit));

  return { items: rows, page: filters.page, limit: filters.limit, total, totalPages };
}

async function buscarRepuestos(term, empresaId) {
  const trimmed = toTrimmedOrNull(term);
  if (!trimmed || trimmed.length < 2) return [];
  return repuestosRepository.buscar(trimmed, empresaId, 10);
}

async function getRepuesto(id, empresaId) {
  const repuesto = await repuestosRepository.findById(id, empresaId);
  if (!repuesto) {
    throw new HttpError(404, "Repuesto no encontrado");
  }
  return repuesto;
}

async function createRepuesto(payload, empresaId) {
  const repuesto = normalizePayload(payload);
  repuesto.empresa_id = empresaId;
  validateRepuesto(repuesto);

  try {
    return await repuestosRepository.create(repuesto);
  } catch (error) {
    if (error.code === "23505" && String(error.constraint || "").includes("codigo_interno")) {
      throw new HttpError(409, "Ya existe un repuesto registrado con ese código interno");
    }
    throw error;
  }
}

async function updateRepuesto(id, payload, empresaId) {
  const existing = await repuestosRepository.findById(id, empresaId);
  if (!existing) {
    throw new HttpError(404, "Repuesto no encontrado");
  }

  const repuesto = normalizePayload(payload);
  validateRepuesto(repuesto);

  try {
    return await repuestosRepository.update(id, repuesto, empresaId);
  } catch (error) {
    if (error.code === "23505" && String(error.constraint || "").includes("codigo_interno")) {
      throw new HttpError(409, "Ya existe un repuesto registrado con ese código interno");
    }
    throw error;
  }
}

module.exports = {
  listRepuestos,
  buscarRepuestos,
  getRepuesto,
  createRepuesto,
  updateRepuesto,
  CATEGORIAS_VALIDAS,
  ESTADOS_VALIDOS
};
