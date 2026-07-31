const conductorLicenciasService = require("../services/conductor-licencias.service");

exports.getLicencias = async (req, res) => {
  const licencias = await conductorLicenciasService.listLicencias(req.params.conductorId, req.empresaId);
  res.json(licencias);
};

exports.createLicencia = async (req, res) => {
  const licencia = await conductorLicenciasService.createLicencia(req.params.conductorId, req.body, req.file, req.empresaId);
  res.status(201).json(licencia);
};

exports.updateLicencia = async (req, res) => {
  const licencia = await conductorLicenciasService.updateLicencia(req.params.id, req.body, req.file, req.empresaId);
  res.json(licencia);
};

exports.deleteLicencia = async (req, res) => {
  await conductorLicenciasService.deleteLicencia(req.params.id, req.empresaId);
  res.status(204).send();
};
