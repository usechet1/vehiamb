const HttpError = require("../errors/http-error");
const { MAX_ADJUNTOS_POR_CAMPO, agruparPorCampo, eliminarArchivosSubidos } = require("../utils/adjuntos");

// Para las rutas con multer.any() (inspeccion, entregas): multer no puede
// limitar cuantos archivos llegan en CADA campo, solo el total. Va justo
// despues de multer: si algun campo trae mas de max archivos se borran todos
// los recibidos (para no dejar huerfanos en /uploads) y se responde 400.
function limitarAdjuntosPorCampo(max = MAX_ADJUNTOS_POR_CAMPO) {
  return async function (req, res, next) {
    const archivos = Array.isArray(req.files) ? req.files : [];
    const excedido = [...agruparPorCampo(archivos).values()].some((lista) => lista.length > max);
    if (!excedido) return next();

    await eliminarArchivosSubidos(archivos);
    next(new HttpError(400, `Solo se permiten hasta ${max} fotos por campo`));
  };
}

module.exports = limitarAdjuntosPorCampo;
