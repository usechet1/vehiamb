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
    empresa_id: user.empresa_id,
    empresa_nombre: user.empresa_nombre,
    empresa_logo_url: user.empresa_logo_url,
    permisos: user.permisos || []
  };
}

// Los modulos deshabilitados son un ajuste POR EMPRESA (no por rol, que es
// catalogo global): permiten venderle a una empresa un subconjunto de la app
// sin duplicar roles. Se restan de los permisos ya resueltos por rol, asi
// que tanto el sidebar (oculta el boton) como cada requirePermission() del
// backend (bloquea el endpoint) quedan protegidos con este unico filtro.
function aplicarModulosDeshabilitados(permisos, modulosDeshabilitados) {
  if (!Array.isArray(modulosDeshabilitados) || !modulosDeshabilitados.length) return permisos;
  const deshabilitados = new Set(modulosDeshabilitados);
  return permisos.filter((codigo) => !deshabilitados.has(codigo));
}

async function enrichUser(user) {
  const permisosDelRol = await usuariosRepository.findPermissionsByUserId(user.id);
  const permisos = aplicarModulosDeshabilitados(permisosDelRol, user.empresa_modulos_deshabilitados);
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
    throw new HttpError(401, "Sesión inválida o expirada");
  }

  const user = await usuariosRepository.findById(payload.sub);
  if (!user || !user.activo) {
    throw new HttpError(401, "Sesión inválida o expirada");
  }

  return enrichUser(user);
}

module.exports = {
  login,
  getCurrentUser,
  aplicarModulosDeshabilitados
};
