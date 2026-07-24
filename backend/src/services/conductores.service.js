const fs = require("fs/promises");
const path = require("path");
const HttpError = require("../errors/http-error");
const conductoresRepository = require("../repositories/conductores.repository");
const usuariosRepository = require("../repositories/usuarios.repository");
const rolesRepository = require("../repositories/roles.repository");
const db = require("../database/query");
const { hashPassword } = require("../utils/password");

const UPLOADS_ROOT = path.resolve(__dirname, "..", "..", "uploads");
const ROL_CONDUCTOR = "Conductor";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function eliminarArchivoAnterior(archivoUrl) {
  if (!archivoUrl) return;

  try {
    await fs.unlink(path.join(UPLOADS_ROOT, archivoUrl.replace(/^\/uploads[\\/]/, "")));
  } catch (error) {
    // Si el archivo ya no existe o no se puede borrar, no interrumpe el flujo principal.
  }
}

const ESTADOS_VALIDOS = new Set(["activo", "inactivo"]);
const PAGE_SIZE_OPTIONS = new Set([10, 20, 50, 100]);
const DEFAULT_LIMIT = 20;

// Categorias reales de licencia de conduccion en Colombia (Resolucion
// 3245 de 2009 / Codigo Nacional de Transito): motos (A1/A2), particulares
// (B1/B2/B3) y servicio publico/carga (C1/C2/C3).
const LICENCIA_CATEGORIAS_VALIDAS = new Set(["A1", "A2", "B1", "B2", "B3", "C1", "C2", "C3"]);
const CEDULA_REGEX = /^\d{6,10}$/;
const TELEFONO_REGEX = /^\d{7,10}$/;
const SOLO_TEXTO_REGEX = /^[A-ZÁÉÍÓÚÑÜ\s]+$/;

function toTrimmedOrNull(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
}

// Nombres y apellidos se normalizan en mayusculas (mismo criterio que
// vehiculos.service.js con placa/numero_chasis): evita que el mismo
// conductor quede duplicado en la busqueda/orden por diferencias de
// capitalizacion segun quien lo haya digitado.
function normalizePayload(payload) {
  return {
    nombres: String(payload.nombres || "").trim().toUpperCase(),
    apellidos: String(payload.apellidos || "").trim().toUpperCase(),
    cedula: toTrimmedOrNull(payload.cedula),
    telefono: toTrimmedOrNull(payload.telefono),
    licencia_categoria: toTrimmedOrNull(payload.licencia_categoria),
    email: String(payload.email || "").trim().toLowerCase(),
    estado: ESTADOS_VALIDOS.has(payload.estado) ? payload.estado : "activo"
  };
}

function nombreCompleto(conductor) {
  return `${conductor.nombres} ${conductor.apellidos}`.trim();
}

function validateConductor(conductor) {
  if (!conductor.nombres || !SOLO_TEXTO_REGEX.test(conductor.nombres)) {
    throw new HttpError(400, "Los nombres del conductor son obligatorios y solo pueden contener letras");
  }

  if (!conductor.apellidos || !SOLO_TEXTO_REGEX.test(conductor.apellidos)) {
    throw new HttpError(400, "Los apellidos del conductor son obligatorios y solo pueden contener letras");
  }

  if (!conductor.cedula || !CEDULA_REGEX.test(conductor.cedula)) {
    throw new HttpError(400, "La cédula es obligatoria y debe tener solo números (6 a 10 dígitos)");
  }

  if (!conductor.telefono || !TELEFONO_REGEX.test(conductor.telefono)) {
    throw new HttpError(400, "El teléfono es obligatorio y debe tener solo números (7 a 10 dígitos)");
  }

  if (!LICENCIA_CATEGORIAS_VALIDAS.has(conductor.licencia_categoria)) {
    throw new HttpError(400, "La categoría de licencia no es válida");
  }

  if (!conductor.email || !EMAIL_REGEX.test(conductor.email)) {
    throw new HttpError(400, "El correo del conductor es obligatorio y debe ser válido");
  }
}

function normalizeListQuery(query = {}) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = PAGE_SIZE_OPTIONS.has(Number(query.limit)) ? Number(query.limit) : DEFAULT_LIMIT;

  return {
    estado: ESTADOS_VALIDOS.has(query.estado) ? query.estado : null,
    search: toTrimmedOrNull(query.search),
    page,
    limit,
    offset: (page - 1) * limit
  };
}

async function listConductores(query, empresaId) {
  const filters = normalizeListQuery(query);
  const { rows, total } = await conductoresRepository.findAll(filters, empresaId);
  const totalPages = Math.max(1, Math.ceil(total / filters.limit));

  return { items: rows, page: filters.page, limit: filters.limit, total, totalPages };
}

async function listConductoresActivos(empresaId) {
  return conductoresRepository.findAllActivos(empresaId);
}

async function getConductor(id, empresaId) {
  const conductor = await conductoresRepository.findById(id, empresaId);
  if (!conductor) {
    throw new HttpError(404, "Conductor no encontrado");
  }
  return conductor;
}

// Cada conductor tiene, ademas de su ficha, una cuenta de usuario con rol
// "Conductor" para poder entrar a su modulo (Entrega y recibida, etc). La
// contrasena la escribe el administrador en el mismo formulario, igual que ya
// se hace al crear un usuario desde admin-usuarios.html.
async function crearUsuarioConductor(conductor, password, empresaId) {
  const existeEmail = await usuariosRepository.findByEmail(conductor.email);
  if (existeEmail) {
    throw new HttpError(409, "Ya existe un usuario con ese correo");
  }

  const rol = await rolesRepository.findByNombre(ROL_CONDUCTOR);
  if (!rol) {
    throw new HttpError(500, "El rol Conductor no esta configurado en el sistema");
  }

  return usuariosRepository.create({
    nombre: nombreCompleto(conductor),
    email: conductor.email,
    password_hash: await hashPassword(password),
    rol: rol.nombre,
    role_id: rol.id,
    activo: true,
    foto_url: null,
    empresa_id: empresaId
  });
}

async function createConductor(payload, file, empresaId) {
  const conductor = normalizePayload(payload);
  validateConductor(conductor);

  const password = String(payload.password || "");
  if (password.length < 6) {
    throw new HttpError(400, "La contraseña debe tener al menos 6 caracteres");
  }

  conductor.licencia_archivo_url = file ? `/uploads/conductores/${file.filename}` : null;
  conductor.licencia_archivo_nombre = file?.originalname || null;
  conductor.licencia_archivo_mime = file?.mimetype || null;
  conductor.empresa_id = empresaId;

  const usuario = await crearUsuarioConductor(conductor, password, empresaId);
  conductor.usuario_id = usuario.id;

  try {
    return await conductoresRepository.create(conductor);
  } catch (error) {
    // Si la ficha del conductor no se pudo crear, no dejamos huerfana la
    // cuenta de usuario que ya se habia creado para el.
    await db.run("DELETE FROM usuarios WHERE id = ?", [usuario.id]).catch(() => {});
    throw error;
  }
}

async function updateConductor(id, payload, file, empresaId) {
  const existing = await conductoresRepository.findById(id, empresaId);
  if (!existing) {
    throw new HttpError(404, "Conductor no encontrado");
  }

  const conductor = normalizePayload(payload);
  validateConductor(conductor);
  conductor.licencia_archivo_url = file ? `/uploads/conductores/${file.filename}` : existing.licencia_archivo_url;
  conductor.licencia_archivo_nombre = file ? file.originalname : existing.licencia_archivo_nombre;
  conductor.licencia_archivo_mime = file ? file.mimetype : existing.licencia_archivo_mime;
  conductor.empresa_id = empresaId;

  const password = String(payload.password || "");
  if (password && password.length < 6) {
    throw new HttpError(400, "La contraseña debe tener al menos 6 caracteres");
  }

  if (existing.usuario_id) {
    const usuario = await usuariosRepository.findById(existing.usuario_id, empresaId);

    if (usuario && conductor.email !== usuario.email) {
      const sameEmailUser = await usuariosRepository.findByEmail(conductor.email);
      if (sameEmailUser && String(sameEmailUser.id) !== String(usuario.id)) {
        throw new HttpError(409, "Ya existe un usuario con ese correo");
      }
    }

    if (usuario) {
      await usuariosRepository.update(
        usuario.id,
        {
          nombre: nombreCompleto(conductor),
          email: conductor.email,
          rol: usuario.rol,
          role_id: usuario.role_id,
          activo: usuario.activo,
          foto_url: usuario.foto_url,
          password_hash: password ? await hashPassword(password) : null
        },
        empresaId
      );
    }

    conductor.usuario_id = existing.usuario_id;
  } else if (password) {
    // Conductor creado antes de existir esta funcionalidad (sin cuenta
    // vinculada): si ahora se le da una contraseña, se crea su acceso.
    const usuario = await crearUsuarioConductor(conductor, password, empresaId);
    conductor.usuario_id = usuario.id;
  } else {
    conductor.usuario_id = null;
  }

  const actualizado = await conductoresRepository.update(id, conductor, empresaId);

  if (file && existing.licencia_archivo_url) {
    await eliminarArchivoAnterior(existing.licencia_archivo_url);
  }

  return actualizado;
}

module.exports = {
  listConductores,
  listConductoresActivos,
  getConductor,
  createConductor,
  updateConductor,
  ESTADOS_VALIDOS
};
