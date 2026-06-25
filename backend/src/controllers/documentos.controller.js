const documentosService = require("../services/documentos.service");

exports.getDocumentos = async (req, res) => {
  const documentos = await documentosService.listDocumentos();
  res.json(documentos);
};

exports.getDocumentosByVehicle = async (req, res) => {
  const documentos = await documentosService.listDocumentosByVehicle(req.params.vehiculoId);
  res.json(documentos);
};

exports.createDocumento = async (req, res) => {
  const documento = await documentosService.createDocumento(req.body);
  res.status(201).json(documento);
};
