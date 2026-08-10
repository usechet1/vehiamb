const seguridadService = require("../services/seguridad.service");

exports.getCatalogoBotiquin = async (req, res) => {
  res.json(seguridadService.getCatalogoBotiquin());
};

exports.getExtintores = async (req, res) => {
  const extintores = await seguridadService.listarExtintores(req.empresaId);
  res.json(extintores);
};

exports.createExtintor = async (req, res) => {
  const extintor = await seguridadService.crearExtintor(req.body, req.user);
  res.status(201).json(extintor);
};

exports.updateExtintor = async (req, res) => {
  const extintor = await seguridadService.actualizarExtintor(req.params.id, req.body, req.empresaId);
  res.json(extintor);
};

exports.deleteExtintor = async (req, res) => {
  await seguridadService.eliminarExtintor(req.params.id, req.empresaId);
  res.status(204).send();
};

exports.getInspeccionesBotiquin = async (req, res) => {
  const inspecciones = await seguridadService.listarInspecciones(
    {
      vehiculoId: req.query.vehiculo_id || null,
      fechaDesde: req.query.fecha_desde || null,
      fechaHasta: req.query.fecha_hasta || null
    },
    req.empresaId
  );
  res.json(inspecciones);
};

exports.getInspeccionBotiquin = async (req, res) => {
  const inspeccion = await seguridadService.obtenerInspeccion(req.params.id, req.empresaId);
  res.json(inspeccion);
};

exports.createInspeccionBotiquin = async (req, res) => {
  const inspeccion = await seguridadService.crearInspeccion(req.body, req.user);
  res.status(201).json(inspeccion);
};

exports.deleteInspeccionBotiquin = async (req, res) => {
  await seguridadService.eliminarInspeccion(req.params.id, req.empresaId);
  res.status(204).send();
};

exports.getCatalogoHerramientas = async (req, res) => {
  res.json(seguridadService.getCatalogoHerramientas());
};

exports.getInspeccionesHerramientas = async (req, res) => {
  const inspecciones = await seguridadService.listarInspeccionesHerramientas(
    {
      vehiculoId: req.query.vehiculo_id || null,
      fechaDesde: req.query.fecha_desde || null,
      fechaHasta: req.query.fecha_hasta || null
    },
    req.empresaId
  );
  res.json(inspecciones);
};

exports.getInspeccionHerramientas = async (req, res) => {
  const inspeccion = await seguridadService.obtenerInspeccionHerramientas(req.params.id, req.empresaId);
  res.json(inspeccion);
};

exports.createInspeccionHerramientas = async (req, res) => {
  const inspeccion = await seguridadService.crearInspeccionHerramientas(req.body, req.user);
  res.status(201).json(inspeccion);
};

exports.deleteInspeccionHerramientas = async (req, res) => {
  await seguridadService.eliminarInspeccionHerramientas(req.params.id, req.empresaId);
  res.status(204).send();
};
