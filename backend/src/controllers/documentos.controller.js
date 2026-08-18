const documentosService = require("../services/documentos.service");
const extraccionDocumentosService = require("../services/extraccion-documentos.service");
const HttpError = require("../errors/http-error");

exports.getDocumentos = async (req, res) => {
  const documentos = await documentosService.listDocumentos(req.empresaId);
  res.json(documentos);
};

exports.getDocumentosByVehicle = async (req, res) => {
  const documentos = await documentosService.listDocumentosByVehicle(req.params.vehiculoId, req.empresaId);
  res.json(documentos);
};

exports.createDocumento = async (req, res) => {
  const documento = await documentosService.createDocumento(req.body, req.file, req.empresaId);
  res.status(201).json(documento);
};

exports.updateDocumento = async (req, res) => {
  const documento = await documentosService.updateDocumento(req.params.id, req.body, req.file, req.empresaId);
  res.json(documento);
};

exports.deleteDocumento = async (req, res) => {
  await documentosService.deleteDocumento(req.params.id, req.empresaId);
  res.status(204).send();
};

// Solo extrae y responde -- no guarda nada, eso lo hace createDocumento/
// updateDocumento arriba, llamado despues desde el frontend una vez el
// usuario confirma (o se autoenvia el formulario) con los campos ya
// llenos. Misma extraccion que ya usa la automatizacion de n8n
// (automation.controller.js), solo que bajo el permiso humano de
// documents.create en vez de la clave de automatizacion.
exports.extraerDatos = async (req, res) => {
  if (!req.file) {
    throw new HttpError(400, "Debes adjuntar el archivo");
  }

  const tipo = String(req.body.tipo || "");
  if (tipo === "soat") {
    return res.json(await extraccionDocumentosService.extraerDesdeSoatPdf(req.file.buffer));
  }
  if (tipo === "tecnomecanica") {
    return res.json(await extraccionDocumentosService.extraerDesdeTecnomecanicaImagen(req.file.buffer));
  }

  throw new HttpError(400, "Solo se puede autocompletar SOAT o tecnomecánica");
};
