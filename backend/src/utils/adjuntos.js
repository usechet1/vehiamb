// Varias fotos/adjuntos por campo en los modulos de evidencia (inspeccion
// preventiva, entregas, novedades, mantenimientos y comentarios). Se guardan
// como una lista JSON [{ url, nombre, mime }] en una columna de texto (ej.
// inspeccion_items.fotos_json), mismo criterio que
// entregas_recibidas.fotos_generales_json. El limite real por campo lo
// aplica limitarAdjuntosPorCampo (middlewares/limit-adjuntos.js) antes de
// llegar al servicio; aca solo se arma y se lee la lista.
const fs = require("fs/promises");

const MAX_ADJUNTOS_POR_CAMPO = 5;

// Al rechazar una peticion despues de que multer ya guardo los archivos, se
// borran para no dejar huerfanos en /uploads.
async function eliminarArchivosSubidos(archivos) {
  await Promise.all((archivos || []).map((file) => fs.unlink(file.path).catch(() => {})));
}

function agruparPorCampo(archivos) {
  const grupos = new Map();
  for (const file of archivos || []) {
    if (!grupos.has(file.fieldname)) grupos.set(file.fieldname, []);
    grupos.get(file.fieldname).push(file);
  }
  return grupos;
}

function aAdjuntos(archivos, carpeta) {
  return (archivos || []).map((file) => ({
    url: `/uploads/${carpeta}/${file.filename}`,
    nombre: file.originalname,
    mime: file.mimetype || null
  }));
}

function serializarAdjuntos(adjuntos) {
  return adjuntos && adjuntos.length ? JSON.stringify(adjuntos) : null;
}

// Registros anteriores a fotos_json solo tienen la columna de un archivo
// (foto_url, soporte_url, ...): se devuelven como lista de uno para que el
// frontend lea siempre la misma forma.
function parseAdjuntos(json, legado = {}) {
  if (json) {
    try {
      const adjuntos = JSON.parse(json);
      if (Array.isArray(adjuntos) && adjuntos.length) return adjuntos;
    } catch (error) {
      // JSON corrupto: se cae al archivo unico de abajo.
    }
  }

  return legado.url ? [{ url: legado.url, nombre: legado.nombre || null, mime: legado.mime || null }] : [];
}

module.exports = {
  MAX_ADJUNTOS_POR_CAMPO,
  eliminarArchivosSubidos,
  agruparPorCampo,
  aAdjuntos,
  serializarAdjuntos,
  parseAdjuntos
};
