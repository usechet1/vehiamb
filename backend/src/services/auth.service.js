const HttpError = require("../errors/http-error");
const usuariosRepository = require("../repositories/usuarios.repository");
const { verifyPassword } = require("../utils/password");
const { createAuthToken, verifyAuthToken } = require("../utils/token");

function toSafeUser(user) {
  return {
    id: user.id,
    nombre: user.nombre,
    email: user.email,
    rol: user.rol,
    activo: Boolean(user.activo)
  };
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
    user: toSafeUser(user)
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

  return toSafeUser(user);
}

module.exports = {
  login,
  getCurrentUser
};
