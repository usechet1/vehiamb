const fs = require("fs/promises");
const path = require("path");
const HttpError = require("../errors/http-error");
const repuestosRepository = require("../repositories/repuestos.repository");

const UPLOADS_ROOT = path.resolve(__dirname, "..", "..", "uploads");

async function eliminarFotoAnterior(fotoUrl) {
  if (!fotoUrl) return;
  try {
    await fs.unlink(path.join(UPLOADS_ROOT, fotoUrl.replace(/^\/uploads[\\/]/, "")));
  } catch (error) {
    // El archivo ya pudo haber sido borrado o movido; no bloquea la actualizacion.
  }
}

const UNIDADES_MEDIDA_VALIDAS = new Set(["UND", "GAL", "LT", "KG", "GR", "M", "CM", "PAR", "JGO", "CJA", "ROLLO"]);

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

// codigo_interno NO se toma del payload del cliente: se genera siempre en el
// servidor (ver generarCodigoInterno), asi que nunca es editable desde el
// formulario ni en creacion ni en edicion.
function normalizePayload(payload) {
  return {
    nombre: String(payload.nombre || "").trim(),
    categoria: CATEGORIAS_VALIDAS.has(payload.categoria) ? payload.categoria : "otros",
    marca: toTrimmedOrNull(payload.marca),
    referencia: toTrimmedOrNull(payload.referencia),
    unidad_medida: UNIDADES_MEDIDA_VALIDAS.has(payload.unidad_medida) ? payload.unidad_medida : "UND",
    valor_promedio: toNumberOrNull(payload.valor_promedio) ?? 0,
    estado: ESTADOS_VALIDOS.has(payload.estado) ? payload.estado : "activo",
    observaciones: toTrimmedOrNull(payload.observaciones)
  };
}

function validateRepuesto(repuesto) {
  if (!repuesto.nombre) {
    throw new HttpError(400, "El nombre es obligatorio");
  }

  if (repuesto.valor_promedio < 0) {
    throw new HttpError(400, "El valor promedio no puede ser negativo");
  }
}

// Genera el siguiente "REP-000N" para la empresa e inserta reintentando si
// otro request concurrente ya tomo ese numero (mismo patron de manejo de
// 23505 que ya usaban create/updateRepuesto, solo que aqui tambien dispara un
// reintento con el numero siguiente en vez de solo reportar error).
async function crearConCodigoAutomatico(repuesto, intentosRestantes = 3) {
  const codigo_interno = await previsualizarCodigoInterno(repuesto.empresa_id);

  try {
    return await repuestosRepository.create({ ...repuesto, codigo_interno });
  } catch (error) {
    if (error.code === "23505" && String(error.constraint || "").includes("codigo_interno") && intentosRestantes > 0) {
      return crearConCodigoAutomatico(repuesto, intentosRestantes - 1);
    }
    throw error;
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

async function previsualizarCodigoInterno(empresaId) {
  const numero = await repuestosRepository.findSiguienteNumeroCodigo(empresaId);
  return `${repuestosRepository.CODIGO_INTERNO_PREFIJO}${String(numero).padStart(4, "0")}`;
}

async function getRepuesto(id, empresaId) {
  const repuesto = await repuestosRepository.findById(id, empresaId);
  if (!repuesto) {
    throw new HttpError(404, "Repuesto no encontrado");
  }
  return repuesto;
}

async function createRepuesto(payload, empresaId, file) {
  const repuesto = normalizePayload(payload);
  repuesto.empresa_id = empresaId;
  repuesto.foto_url = file ? `/uploads/repuestos/${file.filename}` : null;
  validateRepuesto(repuesto);

  return crearConCodigoAutomatico(repuesto);
}

async function updateRepuesto(id, payload, empresaId, file) {
  const existing = await repuestosRepository.findById(id, empresaId);
  if (!existing) {
    throw new HttpError(404, "Repuesto no encontrado");
  }

  const repuesto = normalizePayload(payload);
  repuesto.empresa_id = empresaId;
  repuesto.codigo_interno = existing.codigo_interno;
  repuesto.foto_url = file ? `/uploads/repuestos/${file.filename}` : existing.foto_url;
  validateRepuesto(repuesto);

  const actualizado = await repuestosRepository.update(id, repuesto, empresaId);

  if (file && existing.foto_url) {
    await eliminarFotoAnterior(existing.foto_url);
  }

  return actualizado;
}

module.exports = {
  listRepuestos,
  buscarRepuestos,
  previsualizarCodigoInterno,
  getRepuesto,
  createRepuesto,
  updateRepuesto,
  CATEGORIAS_VALIDAS,
  ESTADOS_VALIDOS,
  UNIDADES_MEDIDA_VALIDAS
};
