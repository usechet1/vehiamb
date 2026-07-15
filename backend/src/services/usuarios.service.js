const HttpError = require("../errors/http-error");
const rolesRepository = require("../repositories/roles.repository");
const usuariosRepository = require("../repositories/usuarios.repository");
const { hashPassword } = require("../utils/password");
const notificacionesService = require("./notificaciones.service");

const PERMISO_SUPER_ADMIN = "empresas.switch";

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function toSafeUser(user) {
  return {
    id: user.id,
    nombre: user.nombre,
    email: user.email,
    rol: user.role_nombre || user.rol,
    role_id: user.role_id,
    activo: Boolean(user.activo),
    empresa_id: user.empresa_id,
    created_at: user.created_at
  };
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
    activo: payload.activo === undefined ? true : Boolean(payload.activo)
  };
}

async function listUsers(empresaId) {
  const users = await usuariosRepository.findAll(empresaId);
  return users.map(toSafeUser);
}

// El email es unico en TODA la plataforma (decision de producto: una cuenta
// = una empresa, el login no pide elegir empresa), asi que la verificacion
// de unicidad de email es deliberadamente global, sin filtrar por empresaId.
async function createUser(payload, empresaId, callerPermisos = []) {
  const user = await validateUserPayload(payload, { callerPermisos });
  const existing = await usuariosRepository.findByEmail(user.email);

  if (existing) {
    throw new HttpError(409, "Ya existe un usuario con ese correo");
  }

  const created = await usuariosRepository.create({
    ...user,
    password_hash: await hashPassword(user.password),
    empresa_id: empresaId
  });

  const safeUser = toSafeUser(created);

  notificacionesService.notificarUsuarioCreado(safeUser).catch((error) => {
    console.error("No fue posible notificar la creacion de usuario:", error.message);
  });

  return safeUser;
}

async function updateUser(id, payload, empresaId, callerPermisos = []) {
  const existing = await usuariosRepository.findById(id, empresaId);
  if (!existing) {
    throw new HttpError(404, "Usuario no encontrado");
  }

  const user = await validateUserPayload(payload, { isUpdate: true, existingRoleId: existing.role_id, callerPermisos });
  const sameEmailUser = await usuariosRepository.findByEmail(user.email);

  if (sameEmailUser && String(sameEmailUser.id) !== String(id)) {
    throw new HttpError(409, "Ya existe un usuario con ese correo");
  }

  const updated = await usuariosRepository.update(
    id,
    {
      ...user,
      password_hash: user.password ? await hashPassword(user.password) : null
    },
    empresaId
  );

  const safeUser = toSafeUser(updated);

  if (String(existing.role_id) !== String(safeUser.role_id)) {
    notificacionesService.notificarPermisosActualizados(safeUser).catch((error) => {
      console.error("No fue posible notificar el cambio de permisos:", error.message);
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
  return toSafeUser(updated);
}

module.exports = {
  listUsers,
  createUser,
  updateUser,
  setUserActive,
  toSafeUser
};
