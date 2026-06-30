const HttpError = require("../errors/http-error");
const rolesRepository = require("../repositories/roles.repository");
const usuariosRepository = require("../repositories/usuarios.repository");
const { hashPassword } = require("../utils/password");

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

async function resolveRole(roleId) {
  const role = await rolesRepository.findById(roleId);
  if (!role || !role.activo) {
    throw new HttpError(400, "Rol invalido");
  }

  return role;
}

async function validateUserPayload(payload, { isUpdate = false } = {}) {
  const nombre = String(payload.nombre || "").trim();
  const email = normalizeEmail(payload.email);
  const password = String(payload.password || "");
  const roleId = Number(payload.role_id || payload.roleId || 0);

  if (!nombre || !email || !roleId) {
    throw new HttpError(400, "Nombre, correo y rol son obligatorios");
  }

  if (!isUpdate && password.length < 6) {
    throw new HttpError(400, "La contrasena debe tener al menos 6 caracteres");
  }

  if (isUpdate && password && password.length < 6) {
    throw new HttpError(400, "La contrasena debe tener al menos 6 caracteres");
  }

  const role = await resolveRole(roleId);

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

  return toSafeUser(created);
}

async function updateUser(id, payload) {
  const existing = await usuariosRepository.findById(id);
  if (!existing) {
    throw new HttpError(404, "Usuario no encontrado");
  }

  const user = await validateUserPayload(payload, { isUpdate: true });
  const sameEmailUser = await usuariosRepository.findByEmail(user.email);

  if (sameEmailUser && String(sameEmailUser.id) !== String(id)) {
    throw new HttpError(409, "Ya existe un usuario con ese correo");
  }

  const updated = await usuariosRepository.update(id, {
    ...user,
    password_hash: user.password ? await hashPassword(user.password) : null
  });

  return toSafeUser(updated);
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
