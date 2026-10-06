const fs = require("fs");
const path = require("path");
const multer = require("multer");

const uploadDir = path.resolve(__dirname, "..", "..", "uploads", "inspecciones");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, uploadDir);
  },
  filename(req, file, cb) {
    const extension = path.extname(file.originalname || "").toLowerCase();
    const safeName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`;
    cb(null, safeName);
  }
});

function fileFilter(req, file, cb) {
  const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

  if (!allowedTypes.has(file.mimetype)) {
    return cb(new Error("Las fotos de evidencia solo pueden ser PNG, JPG o WEBP"));
  }

  cb(null, true);
}

module.exports = multer({
  storage,
  fileFilter,
  limits: {
    // Fotos de evidencia tomadas con la camara del celular del conductor en
    // el momento, sin pasar por ningun editor que las achique -- 5MB se
    // quedaba corto para una foto de camara trasera a resolucion completa
    // (varios conductores lo reportaron fallando seguido durante la
    // inspeccion). Se comprimen de todas formas despues (ver compressImage
    // en inspecciones.routes.js), esto solo evita rechazar el archivo de
    // entrada antes de llegar a esa compresion.
    fileSize: 15 * 1024 * 1024
  }
});
