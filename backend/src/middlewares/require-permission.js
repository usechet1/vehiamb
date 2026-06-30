const HttpError = require("../errors/http-error");

function requirePermission(permission) {
  return (req, res, next) => {
    const permissions = req.user?.permisos || [];

    if (!permissions.includes(permission)) {
      return next(new HttpError(403, "No tienes permiso para realizar esta accion"));
    }

    next();
  };
}

module.exports = requirePermission;
