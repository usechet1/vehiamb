const vehiculosService = require("../services/vehiculos.service");

exports.getVehiculos = async (req, res) => {
  const resultado = await vehiculosService.listVehiculos(req.query, req.empresaId);
  res.json(resultado);
};

exports.getMarcas = async (req, res) => {
  const marcas = await vehiculosService.getMarcas(req.empresaId);
  res.json(marcas);
};

exports.getVehiculosCatalogo = async (req, res) => {
  const vehiculos = await vehiculosService.listVehiculosSimple(req.empresaId);
  res.json(vehiculos);
};

exports.getVehiculoById = async (req, res) => {
  const vehiculo = await vehiculosService.getVehiculo(req.params.id, req.empresaId);
  res.json(vehiculo);
};

exports.createVehiculo = async (req, res) => {
  const vehiculo = await vehiculosService.createVehiculo(req.body, req.file, req.empresaId);
  res.status(201).json(vehiculo);
};

exports.updateVehiculo = async (req, res) => {
  const vehiculo = await vehiculosService.updateVehiculo(req.params.id, req.body, req.file, req.empresaId);
  res.json(vehiculo);
};

exports.updateEstadoVehiculo = async (req, res) => {
  const vehiculo = await vehiculosService.updateEstadoVehiculo(req.params.id, req.body.estado, req.empresaId);
  res.json(vehiculo);
};

exports.deleteVehiculo = async (req, res) => {
  await vehiculosService.deleteVehiculo(req.params.id, req.empresaId);
  res.status(204).send();
};

exports.getRepuestosSugeridos = async (req, res) => {
  const items = await vehiculosService.getRepuestosSugeridos(req.params.id, req.query.tipo, req.empresaId);
  res.json(items);
};

exports.updateRepuestosSugeridos = async (req, res) => {
  const items = await vehiculosService.updateRepuestosSugeridos(req.params.id, req.body.tipo_mantenimiento, req.body.items, req.empresaId);
  res.json(items);
};
