const HttpError = require("../errors/http-error");
const authService = require("../services/auth.service");
const empresasRepository = require("../repositories/empresas.repository");

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

    // Solo un usuario con "empresas.switch" (rol SuperAdministrador) puede
    // sobreescribir la empresa activa por request, mandando este header. Se
    // valida contra la tabla real de empresas -- nunca se confia en el id
    // solo porque el cliente lo mando.
    const empresaOverrideId = req.headers["x-empresa-id"];
    if (empresaOverrideId && user.permisos.includes("empresas.switch")) {
      const empresaActiva = await empresasRepository.findById(empresaOverrideId);
      if (!empresaActiva || !empresaActiva.activo) {
        return next(new HttpError(400, "Empresa inválida"));
      }
      req.empresaId = empresaActiva.id;
      req.user = {
        ...req.user,
        empresa_id: empresaActiva.id,
        empresa_nombre: empresaActiva.nombre,
        empresa_logo_url: empresaActiva.logo_url,
        empresa_home_id: user.empresa_id,
        permisos: authService.aplicarModulosDeshabilitados(user.permisos, empresaActiva.modulos_deshabilitados)
      };
    }

    next();
  } catch (error) {
    next(error);
  }
}

module.exports = requireAuth;
