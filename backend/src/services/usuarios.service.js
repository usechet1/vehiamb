const HttpError = require("../errors/http-error");
const rolesRepository = require("../repositories/roles.repository");
const usuariosRepository = require("../repositories/usuarios.repository");
const { hashPassword } = require("../utils/password");
const notificacionesService = require("./notificaciones.service");

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
    created_at: user.created_at
  };
}

// Un rol inactivo ya no se puede asignar de cero, pero un usuario que ya lo
// tenia asignado (el rol se desactivo despues) debe poder seguir editandose
// -- ej. cambiarle el nombre o reactivarlo -- sin verse forzado a cambiar de
// rol solo para guardar. allowInactiveId permite esa excepcion puntual.
async function resolveRole(roleId, { allowInactiveId = null } = {}) {
  const role = await rolesRepository.findById(roleId);
  const esElMismoRolActual = allowInactiveId !== null && String(role?.id) === String(allowInactiveId);

  if (!role || (!role.activo && !esElMismoRolActual)) {
    throw new HttpError(400, "Rol inválido");
  }

  return role;
}

async function validateUserPayload(payload, { isUpdate = false, existingRoleId = null } = {}) {
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

  const role = await resolveRole(roleId, { allowInactiveId: isUpdate ? existingRoleId : null });

  return {
    nombre,
    email,
    password,
    role_id: role.id,
    rol: role.nombre,
    activo: payload.activo === undefined ? true : Boolean(payload.activo)
  };
}

async function listUsers() {
  const users = await usuariosRepository.findAll();
  return users.map(toSafeUser);
}

async function createUser(payload) {
  const user = await validateUserPayload(payload);
  const existing = await usuariosRepository.findByEmail(user.email);

  if (existing) {
    throw new HttpError(409, "Ya existe un usuario con ese correo");
  }

  const created = await usuariosRepository.create({
    ...user,
    password_hash: await hashPassword(user.password)
  });

  const safeUser = toSafeUser(created);

  notificacionesService.notificarUsuarioCreado(safeUser).catch((error) => {
    console.error("No fue posible notificar la creacion de usuario:", error.message);
  });

  return safeUser;
}

async function updateUser(id, payload) {
  const existing = await usuariosRepository.findById(id);
  if (!existing) {
    throw new HttpError(404, "Usuario no encontrado");
  }

  const user = await validateUserPayload(payload, { isUpdate: true, existingRoleId: existing.role_id });
  const sameEmailUser = await usuariosRepository.findByEmail(user.email);

  if (sameEmailUser && String(sameEmailUser.id) !== String(id)) {
    throw new HttpError(409, "Ya existe un usuario con ese correo");
  }

  const updated = await usuariosRepository.update(id, {
    ...user,
    password_hash: user.password ? await hashPassword(user.password) : null
  });

  const safeUser = toSafeUser(updated);

  if (String(existing.role_id) !== String(safeUser.role_id)) {
    notificacionesService.notificarPermisosActualizados(safeUser).catch((error) => {
      console.error("No fue posible notificar el cambio de permisos:", error.message);
    });
  }

  return safeUser;
}

async function setUserActive(id, active, currentUserId) {
  if (String(id) === String(currentUserId) && !active) {
    throw new HttpError(400, "No puedes desactivar tu propio usuario");
  }

  const existing = await usuariosRepository.findById(id);
  if (!existing) {
    throw new HttpError(404, "Usuario no encontrado");
  }

  const updated = await usuariosRepository.setActive(id, Boolean(active));
  return toSafeUser(updated);
}

module.exports = {
  listUsers,
  createUser,
  updateUser,
  setUserActive,
  toSafeUser
};
