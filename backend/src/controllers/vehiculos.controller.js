const vehiculosService = require("../services/vehiculos.service");

exports.getVehiculos = async (req, res) => {
  const resultado = await vehiculosService.listVehiculos(req.query);
  res.json(resultado);
};

exports.getMarcas = async (req, res) => {
  const marcas = await vehiculosService.getMarcas();
  res.json(marcas);
};

exports.getVehiculosCatalogo = async (req, res) => {
  const vehiculos = await vehiculosService.listVehiculosSimple();
  res.json(vehiculos);
};

exports.getVehiculoById = async (req, res) => {
  const vehiculo = await vehiculosService.getVehiculo(req.params.id);
  res.json(vehiculo);
};

exports.createVehiculo = async (req, res) => {
  const vehiculo = await vehiculosService.createVehiculo(req.body, req.file);
  res.status(201).json(vehiculo);
};

exports.updateVehiculo = async (req, res) => {
  const vehiculo = await vehiculosService.updateVehiculo(req.params.id, req.body, req.file);
  res.json(vehiculo);
};

exports.updateEstadoVehiculo = async (req, res) => {
  const vehiculo = await vehiculosService.updateEstadoVehiculo(req.params.id, req.body.estado);
  res.json(vehiculo);
};

exports.deleteVehiculo = async (req, res) => {
  await vehiculosService.deleteVehiculo(req.params.id);
  res.status(204).send();
};
