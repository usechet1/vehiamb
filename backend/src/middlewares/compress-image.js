const fs = require("fs/promises");
const { spawn } = require("child_process");
const sharp = require("sharp");
const HttpError = require("../errors/http-error");
const env = require("../config/env");

const COMPRESSIBLE_IMAGE_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const MAX_DIMENSION = 1920;
const MIN_SIZE_TO_COMPRESS = 300 * 1024;
const JPEG_QUALITY = 82;
const WEBP_QUALITY = 82;
const PNG_QUALITY = 85;

async function compressImageFile(file) {
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

function ejecutarGhostscript(args) {
  return new Promise((resolve, reject) => {
    const proceso = spawn(env.ghostscriptPath, args);
    let stderr = "";

    proceso.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    proceso.on("error", reject);

    proceso.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `Ghostscript termino con codigo ${code}`));
        return;
      }
      resolve();
    });
  });
}

// A diferencia de la compresion de imagenes (donde un archivo corrupto es un
// error real del usuario que debe rechazar la subida), Ghostscript es un
// binario opcional que puede no estar instalado en el servidor -- cualquier
// falla aca (no encontrado, PDF que no pudo procesar, etc.) se traga en
// silencio y el documento se guarda sin comprimir, nunca bloquea la subida.
// /ebook baja las imagenes incrustadas a ~150dpi: buena reduccion de tamano
// en escaneos de celular (que suelen venir a 300dpi+) sin verse pixelado al
// leerlo en pantalla.
async function compressPdfFile(file) {
  const originalStat = await fs.stat(file.path);
  if (originalStat.size <= MIN_SIZE_TO_COMPRESS) {
    return;
  }

  const outputPath = `${file.path}.gs-tmp.pdf`;
  try {
    await ejecutarGhostscript([
      "-sDEVICE=pdfwrite",
      "-dCompatibilityLevel=1.4",
      "-dPDFSETTINGS=/ebook",
      "-dNOPAUSE",
      "-dBATCH",
      "-dQUIET",
      "-dSAFER",
      `-sOutputFile=${outputPath}`,
      file.path
    ]);

    const compressedStat = await fs.stat(outputPath);
    if (compressedStat.size > 0 && compressedStat.size < originalStat.size) {
      await fs.rename(outputPath, file.path);
      file.size = compressedStat.size;
    }
  } catch (error) {
    console.error("No se pudo comprimir el PDF con Ghostscript (se guarda sin comprimir):", error.message);
  } finally {
    await fs.unlink(outputPath).catch(() => {});
  }
}

async function compressOne(file) {
  if (!file) return;

  if (COMPRESSIBLE_IMAGE_TYPES.has(file.mimetype)) {
    await compressImageFile(file);
    return;
  }

  if (file.mimetype === "application/pdf") {
    await compressPdfFile(file);
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
    next(new HttpError(400, "No se pudo procesar el archivo adjunto"));
  }
}

module.exports = compressImage;
