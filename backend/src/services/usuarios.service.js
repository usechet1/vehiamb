const fs = require("fs/promises");
const path = require("path");
const HttpError = require("../errors/http-error");
const rolesRepository = require("../repositories/roles.repository");
const usuariosRepository = require("../repositories/usuarios.repository");
const logsRegistroRepository = require("../repositories/logs-registro.repository");
const { hashPassword } = require("../utils/password");
const notificacionesService = require("./notificaciones.service");

// Fire-and-forget, mismo criterio que las notificaciones de este archivo: un
// fallo al guardar el log de registro nunca debe romper la operacion real.
function registrarEventoUsuario(data) {
  logsRegistroRepository
    .registrar(data)
    .catch((error) => console.error("No fue posible registrar el log de registro:", error.message));
}

const PERMISO_SUPER_ADMIN = "empresas.switch";
const UPLOADS_ROOT = path.resolve(__dirname, "..", "..", "uploads");

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

// El checkbox "activo" llega como boolean real en JSON pero como string
// ("true"/"false") cuando el formulario se envia como multipart (necesario
// para poder adjuntar la foto). Boolean("false") seria true por error, asi
// que se compara explicitamente contra el string.
function parseActivo(value) {
  if (value === undefined) return true;
  if (typeof value === "string") return value === "true";
  return Boolean(value);
}

async function eliminarFotoAnterior(fotoUrl) {
  if (!fotoUrl) return;
  try {
    await fs.unlink(path.join(UPLOADS_ROOT, fotoUrl.replace(/^\/uploads[\\/]/, "")));
  } catch (error) {
    // El archivo ya pudo haber sido borrado o movido; no bloquea la actualizacion.
  }
}

function toSafeUser(user) {
  return {
    id: user.id,
    nombre: user.nombre,
    email: user.email,
    rol: user.role_nombre || user.rol,
    role_id: user.role_id,
    activo: Boolean(user.activo),
    foto_url: user.foto_url || null,
    celular: user.celular || null,
    empresa_id: user.empresa_id,
    created_at: user.created_at,
    debe_cambiar_password: Boolean(user.debe_cambiar_password)
  };
}

// Solo digitos (permite que lo escriban con espacios/guiones/+); vacio queda
// como null. Sin validar longitud/pais especifico: el formato E.164 exacto
// que exige la API de WhatsApp se normaliza en notificaciones-whatsapp.channel.js
// al momento de enviar, no aqui.
function normalizeCelular(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits || null;
}

// Un rol inactivo ya no se puede asignar de cero, pero un usuario que ya lo
// tenia asignado (el rol se desactivo despues) debe poder seguir editandose
// -- ej. cambiarle el nombre o reactivarlo -- sin verse forzado a cambiar de
// rol solo para guardar. allowInactiveId permite esa excepcion puntual.
async function resolveRole(roleId, { allowInactiveId = null, callerPermisos = [] } = {}) {
  const role = await rolesRepository.findById(roleId);
  const esElMismoRolActual = allowInactiveId !== null && String(role?.id) === String(allowInactiveId);

  if (!role || (!role.activo && !esElMismoRolActual)) {
    throw new HttpError(400, "Rol inválido");
  }

  // Un rol que otorga "empresas.switch" rompe el aislamiento entre empresas
  // -- solo alguien que ya tiene ese permiso puede asignarlo a otro usuario
  // (o a si mismo editandose), para que un Administrador normal no pueda
  // promoverse a SuperAdministrador desde el panel de Usuarios.
  if (!callerPermisos.includes(PERMISO_SUPER_ADMIN)) {
    const permisosDelRol = await rolesRepository.findPermissionsByRoleId(role.id);
    if (permisosDelRol.some((permiso) => permiso.codigo === PERMISO_SUPER_ADMIN)) {
      throw new HttpError(403, "No tienes permiso para asignar este rol");
    }
  }

  return role;
}

async function validateUserPayload(payload, { isUpdate = false, existingRoleId = null, callerPermisos = [] } = {}) {
  const nombre = String(payload.nombre || "").trim();
  const email = normalizeEmail(payload.email);
  const password = String(payload.password || "");
  const roleId = Number(payload.role_id || payload.roleId || 0);

  if (!nombre || !email || !roleId) {
    throw new HttpError(400, "Nombre, correo y rol son obligatorios");
  }

  if (nombre.length < 4) {
    throw new HttpError(400, "El nombre debe tener al menos 4 caracteres");
  }

  const emailLocalPart = email.split("@")[0];
  if (emailLocalPart.length < 4) {
    throw new HttpError(400, "El usuario debe tener al menos 4 caracteres");
  }

  if (!isUpdate && password.length < 6) {
    throw new HttpError(400, "La contraseña debe tener al menos 6 caracteres");
  }

  if (isUpdate && password && password.length < 6) {
    throw new HttpError(400, "La contraseña debe tener al menos 6 caracteres");
  }

  const role = await resolveRole(roleId, { allowInactiveId: isUpdate ? existingRoleId : null, callerPermisos });

  return {
    nombre,
    email,
    password,
    role_id: role.id,
    rol: role.nombre,
    activo: parseActivo(payload.activo),
    celular: normalizeCelular(payload.celular)
  };
}

async function listUsers(empresaId) {
  const users = await usuariosRepository.findAll(empresaId);
  return users.map(toSafeUser);
}

// El email es unico en TODA la plataforma (decision de producto: una cuenta
// = una empresa, el login no pide elegir empresa), asi que la verificacion
// de unicidad de email es deliberadamente global, sin filtrar por empresaId.
async function createUser(payload, file, empresaId, callerPermisos = [], actorUserId = null) {
  const user = await validateUserPayload(payload, { callerPermisos });
  const existing = await usuariosRepository.findByEmail(user.email);

  if (existing) {
    throw new HttpError(409, "Ya existe un usuario con ese correo");
  }

  const created = await usuariosRepository.create({
    ...user,
    password_hash: await hashPassword(user.password),
    foto_url: file ? `/uploads/usuarios/${file.filename}` : null,
    empresa_id: empresaId
  });

  const safeUser = toSafeUser(created);

  notificacionesService.notificarUsuarioCreado(safeUser).catch((error) => {
    console.error("No fue posible notificar la creacion de usuario:", error.message);
  });

  registrarEventoUsuario({
    usuario_afectado_id: safeUser.id,
    actor_usuario_id: actorUserId,
    empresa_id: empresaId,
    evento: "creado",
    detalle: { rol: safeUser.rol }
  });

  return safeUser;
}

async function updateUser(id, payload, file, empresaId, callerPermisos = [], actorUserId = null) {
  const existing = await usuariosRepository.findById(id, empresaId);
  if (!existing) {
    throw new HttpError(404, "Usuario no encontrado");
  }

  const user = await validateUserPayload(payload, { isUpdate: true, existingRoleId: existing.role_id, callerPermisos });
  const sameEmailUser = await usuariosRepository.findByEmail(user.email);

  if (sameEmailUser && String(sameEmailUser.id) !== String(id)) {
    throw new HttpError(409, "Ya existe un usuario con ese correo");
  }

  const fotoUrl = file ? `/uploads/usuarios/${file.filename}` : existing.foto_url;

  const updated = await usuariosRepository.update(
    id,
    {
      ...user,
      foto_url: fotoUrl,
      password_hash: user.password ? await hashPassword(user.password) : null
    },
    empresaId
  );

  if (file && existing.foto_url) {
    await eliminarFotoAnterior(existing.foto_url);
  }

  const safeUser = toSafeUser(updated);

  if (String(existing.role_id) !== String(safeUser.role_id)) {
    notificacionesService.notificarPermisosActualizados(safeUser).catch((error) => {
      console.error("No fue posible notificar el cambio de permisos:", error.message);
    });

    registrarEventoUsuario({
      usuario_afectado_id: safeUser.id,
      actor_usuario_id: actorUserId,
      empresa_id: empresaId,
      evento: "rol_cambiado",
      detalle: { rol_anterior: existing.rol, rol_nuevo: safeUser.rol }
    });
  }

  const camposModificados = {};
  if (existing.nombre !== safeUser.nombre) camposModificados.nombre = { anterior: existing.nombre, nuevo: safeUser.nombre };
  if ((existing.celular || null) !== (safeUser.celular || null)) {
    camposModificados.celular = { anterior: existing.celular, nuevo: safeUser.celular };
  }
  if (Boolean(existing.activo) !== safeUser.activo) {
    camposModificados.activo = { anterior: Boolean(existing.activo), nuevo: safeUser.activo };
  }
  if (file) camposModificados.foto = { actualizada: true };

  if (Object.keys(camposModificados).length) {
    registrarEventoUsuario({
      usuario_afectado_id: safeUser.id,
      actor_usuario_id: actorUserId,
      empresa_id: empresaId,
      evento: "editado",
      detalle: camposModificados
    });
  }

  return safeUser;
}

async function setUserActive(id, active, currentUserId, empresaId) {
  if (String(id) === String(currentUserId) && !active) {
    throw new HttpError(400, "No puedes desactivar tu propio usuario");
  }

  const existing = await usuariosRepository.findById(id, empresaId);
  if (!existing) {
    throw new HttpError(404, "Usuario no encontrado");
  }

  const updated = await usuariosRepository.setActive(id, Boolean(active), empresaId);
  const safeUser = toSafeUser(updated);

  registrarEventoUsuario({
    usuario_afectado_id: safeUser.id,
    actor_usuario_id: currentUserId,
    empresa_id: empresaId,
    evento: active ? "activado" : "desactivado"
  });

  return safeUser;
}

module.exports = {
  listUsers,
  createUser,
  updateUser,
  setUserActive,
  toSafeUser
};
