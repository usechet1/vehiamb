const fs = require("fs");
const path = require("path");
const multer = require("multer");

const uploadDir = path.resolve(__dirname, "..", "..", "uploads", "usuarios");
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
  // Un input de archivo vacio en un formulario igual se incluye en el FormData
  // (con nombre vacio); se ignora sin error para no bloquear envios sin foto.
  if (!file.originalname) {
    return cb(null, false);
  }

  const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

  if (!allowedTypes.has(file.mimetype)) {
    return cb(new Error("Solo se permiten imagenes PNG, JPG o WEBP"));
  }

  cb(null, true);
}

module.exports = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});
