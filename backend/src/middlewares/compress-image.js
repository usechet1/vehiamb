const fs = require("fs/promises");
const sharp = require("sharp");
const HttpError = require("../errors/http-error");

const COMPRESSIBLE_MIME_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const MAX_DIMENSION = 1920;
const MIN_SIZE_TO_COMPRESS = 300 * 1024;
const JPEG_QUALITY = 82;
const WEBP_QUALITY = 82;
const PNG_QUALITY = 85;

async function compressOne(file) {
  if (!file || !COMPRESSIBLE_MIME_TYPES.has(file.mimetype)) {
    return;
  }

  const originalBuffer = await fs.readFile(file.path);

  if (originalBuffer.length <= MIN_SIZE_TO_COMPRESS) {
    return;
  }

  const metadata = await sharp(originalBuffer).metadata();
  let pipeline = sharp(originalBuffer).rotate();

  if ((metadata.width || 0) > MAX_DIMENSION || (metadata.height || 0) > MAX_DIMENSION) {
    pipeline = pipeline.resize({
      width: MAX_DIMENSION,
      height: MAX_DIMENSION,
      fit: "inside",
      withoutEnlargement: true
    });
  }

  if (file.mimetype === "image/png") {
    pipeline = pipeline.png({ quality: PNG_QUALITY, compressionLevel: 8 });
  } else if (file.mimetype === "image/webp") {
    pipeline = pipeline.webp({ quality: WEBP_QUALITY });
  } else {
    pipeline = pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true });
  }

  const compressedBuffer = await pipeline.toBuffer();

  if (compressedBuffer.length < originalBuffer.length) {
    await sharp(compressedBuffer).metadata();
    await fs.writeFile(file.path, compressedBuffer);
    file.size = compressedBuffer.length;
  }
}

// Soporta tanto uploads de un solo archivo (req.file, via multer.single) como
// de varios (req.files, via multer.any/array) -- este segundo caso lo usa el
// checklist de inspecciones, donde puede llegar una foto de evidencia por
// item marcado.
async function compressImage(req, res, next) {
  try {
    if (req.file) {
      await compressOne(req.file);
    }

    if (Array.isArray(req.files)) {
      for (const file of req.files) {
        await compressOne(file);
      }
    }

    next();
  } catch (error) {
    next(new HttpError(400, "No se pudo procesar la imagen adjunta"));
  }
}

module.exports = compressImage;
