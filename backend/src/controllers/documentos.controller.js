const documentosService = require("../services/documentos.service");

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
