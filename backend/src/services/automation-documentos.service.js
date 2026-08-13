const HttpError = require("../errors/http-error");
const documentosRepository = require("../repositories/documentos.repository");
const documentosService = require("./documentos.service");
const vehiculosRepository = require("../repositories/vehiculos.repository");

// Unico subconjunto de TIPOS_VALIDOS (documentos.service.js) habilitado para
// este endpoint: es lo unico en alcance de esta fase del proyecto (SOAT y
// tecnomecanica). seguro/licencia_transito/otro se rechazan aqui aunque el
// servicio general los acepte.
const TIPOS_AUTOMATION = new Set(["soat", "tecnomecanica"]);

// Actualiza el documento existente para ese vehiculo+tipo si ya hay uno
// (findByVehicleAndTipo), o crea uno nuevo si no -- sin esto, cada renovacion
// enviada por WhatsApp duplicaria el registro en vez de reemplazarlo, que es
// como ya se comporta el formulario humano al editar.
async function upsertDocumento(payload, file, empresaId) {
  const tipo = String(payload.tipo || "").trim();
  if (!tipo) {
    throw new HttpError(400, "El tipo de documento es obligatorio");
  }
  if (!TIPOS_AUTOMATION.has(tipo)) {
    throw new HttpError(400, "Tipo de documento no soportado por automatización (solo soat o tecnomecanica)");
  }

  const placa = String(payload.placa || "").trim();
  if (!placa) {
    throw new HttpError(400, "La placa es obligatoria");
  }

  const vehiculo = await vehiculosRepository.findByPlaca(placa, empresaId);
  if (!vehiculo) {
    throw new HttpError(404, `No se encontró un vehículo con placa ${placa}`);
  }

  const existente = await documentosRepository.findByVehicleAndTipo(vehiculo.id, tipo, empresaId);
  const documentoPayload = { ...payload, vehiculo_id: vehiculo.id, tipo };

  const documento = existente
    ? await documentosService.updateDocumento(existente.id, documentoPayload, file, empresaId)
    : await documentosService.createDocumento(documentoPayload, file, empresaId);

  return {
    accion: existente ? "actualizado" : "creado",
    documento_id: documento.id,
    vehiculo: { id: vehiculo.id, placa: vehiculo.placa, marca: vehiculo.marca, modelo: vehiculo.modelo },
    tipo: documento.tipo,
    numero_documento: documento.numero_documento,
    fecha_vencimiento: documento.fecha_vencimiento,
    archivo_url: documento.archivo_url
  };
}

module.exports = { upsertDocumento, TIPOS_AUTOMATION };
