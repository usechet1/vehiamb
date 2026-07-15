const HttpError = require("../errors/http-error");
const authService = require("../services/auth.service");

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";

  if (!header.startsWith("Bearer ")) {
    return next(new HttpError(401, "Autenticacion requerida"));
  }

  try {
    const token = header.slice("Bearer ".length);
    const user = await authService.getCurrentUser(token);
    if (!user.empresa_id) {
      return next(new HttpError(401, "Sesión inválida o expirada"));
    }
    req.user = user;
    req.empresaId = user.empresa_id;
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = requireAuth;
