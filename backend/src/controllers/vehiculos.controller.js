const vehiculosService = require("../services/vehiculos.service");

exports.getVehiculos = async (req, res) => {
  const vehiculos = await vehiculosService.listVehiculos();
  res.json(vehiculos);
};

exports.getVehiculoById = async (req, res) => {
  const vehiculo = await vehiculosService.getVehiculo(req.params.id);
  res.json(vehiculo);
};

exports.createVehiculo = async (req, res) => {
  const vehiculo = await vehiculosService.createVehiculo(req.body);
  res.status(201).json(vehiculo);
};

exports.deleteVehiculo = async (req, res) => {
  await vehiculosService.deleteVehiculo(req.params.id);
  res.status(204).send();
};
