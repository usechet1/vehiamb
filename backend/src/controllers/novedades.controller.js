const novedadesService = require("../services/novedades.service");

exports.getNovedades = async (req, res) => {
  const novedades = await novedadesService.listNovedades(req.query, req.empresaId);
  res.json(novedades);
};

exports.getNovedadesByVehicle = async (req, res) => {
  const novedades = await novedadesService.listNovedadesByVehicle(req.params.vehiculoId, req.empresaId);
  res.json(novedades);
};

exports.createNovedad = async (req, res) => {
  const novedad = await novedadesService.createNovedad(req.body, req.file, req.user);
  res.status(201).json(novedad);
};

exports.deleteNovedad = async (req, res) => {
  await novedadesService.deleteNovedad(req.params.id, req.user);
  res.status(204).send();
};

exports.getComentarios = async (req, res) => {
  const comentarios = await novedadesService.listarComentariosNovedad(req.params.id, req.user);
  res.json(comentarios);
};
