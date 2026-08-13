const crypto = require("crypto");
const HttpError = require("../errors/http-error");
const env = require("../config/env");

// Autenticacion separada del login humano (require-auth.js): un flujo de n8n
// corriendo desatendido no deberia tener que re-loguearse cada ~12h como una
// persona. No hay req.user ni permisos aqui -- req.empresaId se fija desde
// AUTOMATION_EMPRESA_ID porque no hay una sesion de la que derivarlo.
function requireAutomationKey(req, res, next) {
  const provided = req.headers["x-automation-key"];

  if (typeof provided !== "string" || !provided) {
    return next(new HttpError(401, "Clave de automatización requerida"));
  }

  const expected = Buffer.from(env.automationApiKey);
  const actual = Buffer.from(provided);

  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    return next(new HttpError(401, "Clave de automatización inválida"));
  }

  req.empresaId = env.automationEmpresaId;
  req.isAutomation = true;
  next();
}

module.exports = requireAutomationKey;
