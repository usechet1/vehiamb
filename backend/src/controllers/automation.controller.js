const fs = require("fs/promises");
const HttpError = require("../errors/http-error");
const automationDocumentosService = require("../services/automation-documentos.service");
const extraccionDocumentosService = require("../services/extraccion-documentos.service");

// A diferencia del formulario humano (que elige placa/tipo de un dropdown),
// una placa inexistente o un tipo invalido son casos esperados y frecuentes
// viniendo de n8n -- si el servicio rechaza la operacion despues de que
// multer ya escribio el archivo a disco, se borra para no acumular huerfanos
// en uploads/documentos en cada rechazo rutinario.
exports.upsertDocumento = async (req, res, next) => {
  try {
    const resultado = await automationDocumentosService.upsertDocumento(req.body, req.file, req.empresaId);
    res.status(200).json(resultado);
  } catch (error) {
    if (req.file?.path) {
      await fs.unlink(req.file.path).catch(() => {});
    }
    next(error);
  }
};

// Estos dos solo extraen y responden -- no guardan nada, ese sigue siendo
// trabajo de upsertDocumento (arriba). Si algun campo no se pudo leer se
// responde 200 igual, con ese campo en null y listado en campos_faltantes,
// para que n8n pueda avisarle al remitente exactamente que falta en vez de
// fallar en seco. Solo se responde error real si el archivo ni siquiera se
// pudo procesar (ver extraccion-documentos.service.js).
exports.extraerSoat = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new HttpError(400, "Debes adjuntar el archivo del SOAT");
    }
    const campos = await extraccionDocumentosService.extraerDesdeSoatPdf(req.file.buffer);
    res.status(200).json(campos);
  } catch (error) {
    next(error);
  }
};

exports.extraerTecnomecanica = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new HttpError(400, "Debes adjuntar el archivo de la RTM");
    }
    // Algunos CDA la mandan como PDF (texto real) en vez de foto -- ambos
    // formatos se aceptan aqui, elige el lector segun lo que haya llegado.
    const campos = req.file.mimetype === "application/pdf"
      ? await extraccionDocumentosService.extraerDesdeTecnomecanicaPdf(req.file.buffer)
      : await extraccionDocumentosService.extraerDesdeTecnomecanicaImagen(req.file.buffer);
    res.status(200).json(campos);
  } catch (error) {
    next(error);
  }
};
