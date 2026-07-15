const HttpError = require("../errors/http-error");
const vehiculosRepository = require("../repositories/vehiculos.repository");
const viajesRepository = require("../repositories/viajes.repository");

function toSafeViaje(viaje) {
  return {
    id: viaje.id,
    vehiculo_id: viaje.vehiculo_id,
    vehiculo_placa: viaje.vehiculo_placa,
    vehiculo_marca: viaje.vehiculo_marca,
    vehiculo_modelo: viaje.vehiculo_modelo,
    destino: viaje.destino,
    creado_en: viaje.creado_en
  };
}

async function crear(payload, currentUser) {
  const vehiculoId = payload.vehiculo_id;
  const vehiculo = await vehiculosRepository.findById(vehiculoId);
  if (!vehiculo) {
    throw new HttpError(404, "Vehículo no encontrado");
  }

  const destino = String(payload.destino || "").trim().slice(0, 300);
  if (!destino) {
    throw new HttpError(400, "Debes indicar a dónde vas a realizar el viaje");
  }

  const viaje = await viajesRepository.create({
    vehiculo_id: vehiculoId,
    usuario_id: currentUser?.id ?? null,
    destino
  });

  return toSafeViaje({
    ...viaje,
    vehiculo_placa: vehiculo.placa,
    vehiculo_marca: vehiculo.marca,
    vehiculo_modelo: vehiculo.modelo
  });
}

async function listarRecientes(currentUser) {
  const viajes = await viajesRepository.findRecientesPorUsuario(currentUser?.id ?? null);
  return viajes.map(toSafeViaje);
}

module.exports = { crear, listarRecientes };
