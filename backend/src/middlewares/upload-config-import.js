const multer = require("multer");

// Se guarda en memoria: el archivo solo se parsea en el momento (importador
// bootstrap "de una vez", no queda como adjunto permanente).
const storage = multer.memoryStorage();

function fileFilter(req, file, cb) {
  const allowedTypes = new Set([
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel"
  ]);

  if (!allowedTypes.has(file.mimetype)) {
    return cb(new Error("Solo se permiten archivos Excel (.xlsx, .xls)"));
  }

  cb(null, true);
}

module.exports = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 15 * 1024 * 1024
  }
});
