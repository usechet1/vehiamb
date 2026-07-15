const empresasService = require("../services/empresas.service");

exports.getMiEmpresa = async (req, res) => {
  const empresa = await empresasService.obtenerEmpresa(req.empresaId);
  res.json(empresa);
};

exports.updateMiEmpresa = async (req, res) => {
  const empresa = await empresasService.actualizarEmpresa(req.empresaId, {
    nombre: req.body.nombre,
    file: req.file
  });
  res.json(empresa);
};
