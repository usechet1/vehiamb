const fs = require("fs/promises");
const automationDocumentosService = require("../services/automation-documentos.service");

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
