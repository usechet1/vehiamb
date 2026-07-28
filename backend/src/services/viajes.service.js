const HttpError = require("../errors/http-error");
const vehiculosRepository = require("../repositories/vehiculos.repository");
const viajesRepository = require("../repositories/viajes.repository");
const documentosRepository = require("../repositories/documentos.repository");
const conductoresRepository = require("../repositories/conductores.repository");

// Documentos relevantes para un control de transito en carretera. "otro" se
// deja afuera a proposito -- ahi cae de todo (misceláneo) y no es lo primero
// que pide un agente de transito.
const TIPOS_DOCUMENTO_CONTROL = ["soat", "tecnomecanica", "seguro", "licencia_transito"];

function toSafeDocumentoControl(documento) {
  return {
    id: documento.id,
    tipo: documento.tipo,
    numero_documento: documento.numero_documento,
    fecha_expedicion: documento.fecha_expedicion,
    fecha_vencimiento: documento.fecha_vencimiento,
    archivo_url: documento.archivo_url,
    archivo_nombre: documento.archivo_nombre,
    propietario_tipo_identificacion: documento.propietario_tipo_identificacion,
    propietario_numero_identificacion: documento.propietario_numero_identificacion,
    propietario_nombre: documento.propietario_nombre
  };
}

function toSafeViaje(viaje) {
  return {
    id: viaje.id,
    vehiculo_id: viaje.vehiculo_id,
    vehiculo_placa: viaje.vehiculo_placa,
    vehiculo_marca: viaje.vehiculo_marca,
    vehiculo_modelo: viaje.vehiculo_modelo,
    usuario_nombre: viaje.usuario_nombre,
    destino: viaje.destino,
    creado_en: viaje.creado_en
  };
}

async function crear(payload, currentUser) {
  const vehiculoId = payload.vehiculo_id;
  const vehiculo = await vehiculosRepository.findById(vehiculoId, currentUser.empresa_id);
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
    destino,
    empresa_id: currentUser.empresa_id
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

// Historial de viajes de un vehiculo (para la seccion "Ultimos viajes" en su
// hoja de vida), sin importar que conductor lo haya usado cada vez.
async function listarPorVehiculo(vehiculoId, empresaId) {
  const vehiculo = await vehiculosRepository.findById(vehiculoId, empresaId);
  if (!vehiculo) {
    throw new HttpError(404, "Vehículo no encontrado");
  }

  const viajes = await viajesRepository.findRecientesPorVehiculo(vehiculoId, empresaId);
  return viajes.map(toSafeViaje);
}

// Pantalla de solo lectura para un control de transito: el ultimo viaje
// registrado por el conductor, con los documentos vigentes del vehiculo y su
// propia licencia, todo en una sola consulta para poder mostrarlo rapido.
async function obtenerUltimoViajeControl(currentUser) {
  const empresaId = currentUser.empresa_id;
  const [ultimoViaje] = await viajesRepository.findRecientesPorUsuario(currentUser?.id ?? null, { limit: 1 });

  if (!ultimoViaje) {
    return null;
  }

  const [vehiculo, documentos, conductor] = await Promise.all([
    vehiculosRepository.findById(ultimoViaje.vehiculo_id, empresaId),
    documentosRepository.findByVehicle(ultimoViaje.vehiculo_id, empresaId),
    conductoresRepository.findByUsuarioId(currentUser.id, empresaId)
  ]);

  return {
    viaje: toSafeViaje({
      ...ultimoViaje,
      vehiculo_placa: vehiculo?.placa,
      vehiculo_marca: vehiculo?.marca,
      vehiculo_modelo: vehiculo?.modelo
    }),
    vehiculo: vehiculo
      ? {
          id: vehiculo.id,
          placa: vehiculo.placa,
          marca: vehiculo.marca,
          modelo: vehiculo.modelo,
          imagen_url: vehiculo.imagen_url,
          kilometraje_actual: vehiculo.kilometraje_actual
        }
      : null,
    documentos: documentos
      .filter((documento) => TIPOS_DOCUMENTO_CONTROL.includes(documento.tipo))
      .map(toSafeDocumentoControl),
    conductor: conductor
      ? {
          nombres: conductor.nombres,
          apellidos: conductor.apellidos,
          cedula: conductor.cedula,
          licencia_categoria: conductor.licencia_categoria,
          licencia_archivo_url: conductor.licencia_archivo_url,
          licencia_archivo_nombre: conductor.licencia_archivo_nombre
        }
      : null
  };
}

module.exports = { crear, listarRecientes, listarPorVehiculo, obtenerUltimoViajeControl };
