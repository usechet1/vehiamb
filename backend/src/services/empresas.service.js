const fs = require("fs/promises");
const path = require("path");
const HttpError = require("../errors/http-error");
const db = require("../database/query");
const empresasRepository = require("../repositories/empresas.repository");

const UPLOADS_ROOT = path.resolve(__dirname, "..", "..", "uploads");

async function eliminarLogoAnterior(logoUrl) {
  if (!logoUrl) return;
  try {
    await fs.unlink(path.join(UPLOADS_ROOT, logoUrl.replace(/^\/uploads[\\/]/, "")));
  } catch (error) {
    // El archivo ya pudo haber sido borrado o movido; no bloquea la actualizacion.
  }
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Cada empresa nueva arranca con su propia bodega principal y su propia fila
// de configuracion de inventario, igual que la empresa por defecto que crea
// la migracion inicial (ver seedBodegaYConfigDefault en database/init.js).
async function seedDatosBaseEmpresa(empresaId) {
  await db.run(
    `
      INSERT INTO bodegas (nombre, codigo, empresa_id)
      VALUES ('Bodega Principal', 'PRINCIPAL', ?)
      ON CONFLICT (empresa_id, codigo) DO NOTHING
    `,
    [empresaId]
  );

  await db.run(
    `
      INSERT INTO configuracion_inventario (clave, valor, empresa_id)
      VALUES ('stock_insuficiente_bloquea', 'false', ?)
      ON CONFLICT (empresa_id, clave) DO NOTHING
    `,
    [empresaId]
  );
}

async function createEmpresa({ nombre, slug }) {
  const nombreLimpio = String(nombre || "").trim();
  if (!nombreLimpio) {
    throw new HttpError(400, "El nombre de la empresa es obligatorio");
  }

  const slugFinal = slugify(slug || nombreLimpio);
  if (!slugFinal) {
    throw new HttpError(400, "No se pudo generar un identificador (slug) valido para la empresa");
  }

  const existente = await empresasRepository.findBySlug(slugFinal);
  if (existente) {
    throw new HttpError(409, `Ya existe una empresa con el identificador "${slugFinal}"`);
  }

  const empresa = await empresasRepository.create({ nombre: nombreLimpio, slug: slugFinal });
  await seedDatosBaseEmpresa(empresa.id);

  return empresa;
}

async function listarTodas() {
  return empresasRepository.findAll();
}

async function obtenerEmpresa(empresaId) {
  const empresa = await empresasRepository.findById(empresaId);
  if (!empresa) {
    throw new HttpError(404, "Empresa no encontrada");
  }
  return empresa;
}

async function actualizarEmpresa(empresaId, { nombre, file }) {
  const existente = await obtenerEmpresa(empresaId);

  const nombreLimpio = String(nombre ?? existente.nombre ?? "").trim();
  if (!nombreLimpio) {
    throw new HttpError(400, "El nombre de la empresa es obligatorio");
  }

  const logoUrl = file ? `/uploads/empresas/${file.filename}` : existente.logo_url;

  const empresa = await empresasRepository.update(empresaId, { nombre: nombreLimpio, logo_url: logoUrl });

  if (file && existente.logo_url) {
    await eliminarLogoAnterior(existente.logo_url);
  }

  return empresa;
}

module.exports = {
  createEmpresa,
  slugify,
  listarTodas,
  obtenerEmpresa,
  actualizarEmpresa
};
