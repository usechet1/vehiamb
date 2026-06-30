const HttpError = require("../errors/http-error");
const usuariosRepository = require("../repositories/usuarios.repository");
const { verifyPassword } = require("../utils/password");
const { createAuthToken, verifyAuthToken } = require("../utils/token");

function toSafeUser(user) {
  return {
    id: user.id,
    nombre: user.nombre,
    email: user.email,
    rol: user.role_nombre || user.rol,
    role_id: user.role_id,
    activo: Boolean(user.activo),
    permisos: user.permisos || []
  };
}

async function enrichUser(user) {
  const permisos = await usuariosRepository.findPermissionsByUserId(user.id);
  return toSafeUser({ ...user, permisos });
}

async function login(payload) {
  const email = String(payload.email || "").trim().toLowerCase();
  const password = String(payload.password || "");

  if (!email || !password) {
    throw new HttpError(400, "Correo y contrasena son obligatorios");
  }

  const user = await usuariosRepository.findByEmail(email);
  if (!user || !user.activo) {
    throw new HttpError(401, "Credenciales invalidas");
  }

  const validPassword = await verifyPassword(password, user.password_hash);
  if (!validPassword) {
    throw new HttpError(401, "Credenciales invalidas");
  }

  return {
    token: createAuthToken(user),
    user: await enrichUser(user)
  };
}

async function getCurrentUser(authToken) {
  const payload = verifyAuthToken(authToken);
  if (!payload?.sub) {
    throw new HttpError(401, "Sesion invalida o expirada");
  }

  const user = await usuariosRepository.findById(payload.sub);
  if (!user || !user.activo) {
    throw new HttpError(401, "Sesion invalida o expirada");
  }

  return enrichUser(user);
}

module.exports = {
  login,
  getCurrentUser
};
