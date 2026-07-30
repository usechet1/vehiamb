const fs = require("fs/promises");
const path = require("path");

function sanitize(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}

function fechaCorta() {
  return new Date().toISOString().slice(0, 10);
}

// Multer guarda cada adjunto con un nombre interno aleatorio (ver
// upload-*.js) para evitar colisiones. Este middleware lo renombra despues,
// ya con los datos de la peticion disponibles, a algo legible (ej.
// "ABC123_SOAT_2026-07-30.pdf") para que al abrir/descargar el adjunto desde
// el navegador el usuario vea un nombre con sentido en vez del hash interno.
// Debe ir DESPUES de validateUpload (que ya corrigio la extension segun el
// contenido real detectado).
function renameUpload(construirPartes) {
  return async function (req, res, next) {
    try {
      const archivos = [];
      if (req.file) archivos.push(req.file);
      if (Array.isArray(req.files)) archivos.push(...req.files);

      for (const file of archivos) {
        const partes = (await construirPartes(req, file)) || [];
        const base = partes.filter(Boolean).map(sanitize).join("_") || "ARCHIVO";
        const extension = path.extname(file.filename);
        const nuevoNombre = `${base}_${Date.now()}_${Math.round(Math.random() * 1e6)}${extension}`;
        const nuevaRuta = path.join(path.dirname(file.path), nuevoNombre);

        await fs.rename(file.path, nuevaRuta);
        file.filename = nuevoNombre;
        file.path = nuevaRuta;
        file.originalname = nuevoNombre;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = { renameUpload, fechaCorta };
