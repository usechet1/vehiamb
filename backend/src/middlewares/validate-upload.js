const fs = require("fs/promises");
const path = require("path");
const HttpError = require("../errors/http-error");

// El fileFilter de multer solo confia en el Content-Type declarado por el
// cliente en el multipart -- un atacante puede declarar "image/png" y subir
// cualquier contenido (por ejemplo HTML/SVG con script). La extension del
// archivo guardado tampoco es confiable: sale de "originalname", tambien
// controlado por el cliente, e independiente del mimetype declarado. Esta
// validacion revisa los primeros bytes reales del archivo (magic numbers) y
// fuerza que la extension guardada corresponda al tipo real detectado, para
// que /uploads (servido sin autenticacion, ver app.js) nunca pueda terminar
// sirviendo un archivo ejecutable disfrazado de imagen o PDF.
const FIRMAS = [
  { tipo: "image/png", extension: ".png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { tipo: "image/jpeg", extension: ".jpg", bytes: [0xff, 0xd8, 0xff] },
  { tipo: "application/pdf", extension: ".pdf", bytes: [0x25, 0x50, 0x44, 0x46] }
];

function esWebp(buffer) {
  return (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  );
}

async function detectarTipoReal(filePath) {
  const fd = await fs.open(filePath, "r");
  try {
    const buffer = Buffer.alloc(12);
    await fd.read(buffer, 0, 12, 0);

    if (esWebp(buffer)) return { tipo: "image/webp", extension: ".webp" };

    for (const firma of FIRMAS) {
      const coincide = firma.bytes.every((byte, index) => buffer[index] === byte);
      if (coincide) return { tipo: firma.tipo, extension: firma.extension };
    }

    return null;
  } finally {
    await fd.close();
  }
}

async function validarArchivo(file) {
  const detectado = await detectarTipoReal(file.path);

  if (!detectado || detectado.tipo !== file.mimetype) {
    await fs.unlink(file.path).catch(() => {});
    throw new HttpError(400, "El archivo adjunto no corresponde a un tipo permitido (contenido no coincide con su formato declarado)");
  }

  // La extension guardada por multer sale del nombre original del cliente;
  // se reemplaza por la del tipo real detectado para que nunca quede un
  // archivo con extension ejecutable (.html, .svg, etc.) sirviendo contenido
  // que en realidad si es una imagen/PDF valido pero con nombre falseado.
  const extensionActual = path.extname(file.path).toLowerCase();
  if (extensionActual !== detectado.extension) {
    const nuevaRuta = file.path.slice(0, -extensionActual.length || undefined) + detectado.extension;
    await fs.rename(file.path, nuevaRuta);
    file.path = nuevaRuta;
    file.filename = path.basename(nuevaRuta);
  }
}

async function validateUpload(req, res, next) {
  try {
    const archivos = [];
    if (req.file) archivos.push(req.file);
    if (Array.isArray(req.files)) archivos.push(...req.files);

    for (const file of archivos) {
      await validarArchivo(file);
    }

    next();
  } catch (error) {
    next(error);
  }
}

module.exports = validateUpload;
