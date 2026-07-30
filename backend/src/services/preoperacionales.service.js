const HttpError = require("../errors/http-error");
const vehiculosRepository = require("../repositories/vehiculos.repository");
const preoperacionalesRepository = require("../repositories/preoperacionales.repository");
const itemsRepository = require("../repositories/preoperacional-items.repository");
const viajesRepository = require("../repositories/viajes.repository");

// Catalogo fijo del checklist preoperacional: preguntas si/no sobre el
// estado del conductor y los documentos minimos, formato estandar de
// transporte de carga en Colombia. A diferencia de la inspeccion preventiva
// (que es del vehiculo y admite foto), aqui no aplica evidencia fotografica.
const ITEMS_CHECKLIST = [
  { codigo: "descanso", label: "¿Descansaste al menos 8 horas antes de conducir?" },
  { codigo: "libre_sustancias", label: "¿Te encuentras libre de alcohol y sustancias psicoactivas?" },
  { codigo: "estado_salud", label: "¿Te sientes en buen estado de salud para conducir?" },
  { codigo: "licencia_conduccion", label: "¿Portas tu licencia de conducción vigente?" },
  { codigo: "cedula", label: "¿Portas tu cédula de ciudadanía?" },
  { codigo: "soat", label: "¿El vehículo cuenta con SOAT vigente?" },
  { codigo: "rtm", label: "¿El vehículo cuenta con Revisión Técnico-Mecánica vigente?" },
  { codigo: "conoce_ruta", label: "¿Conoces la ruta y el destino del viaje?" },
  { codigo: "celular_cargado", label: "¿Tienes tu celular cargado para comunicarte durante el viaje?" }
];

const ITEMS_POR_CODIGO = new Map(ITEMS_CHECKLIST.map((item) => [item.codigo, item]));
const RESPUESTAS_VALIDAS = new Set(["si", "no"]);

function getCatalogo() {
  return ITEMS_CHECKLIST;
}

function toSafeItem(item) {
  return {
    id: item.id,
    item_codigo: item.item_codigo,
    item_label: item.item_label,
    respuesta: item.respuesta,
    observacion: item.observacion
  };
}

function toSafePreoperacional(preoperacional) {
  return {
    id: preoperacional.id,
    vehiculo_id: preoperacional.vehiculo_id,
    usuario_id: preoperacional.usuario_id,
    usuario_nombre: preoperacional.usuario_nombre,
    viaje_id: preoperacional.viaje_id,
    destino: preoperacional.viaje_destino,
    fecha: preoperacional.fecha,
    total_items: Number(preoperacional.total_items || 0),
    total_items_no: Number(preoperacional.total_items_no || 0)
  };
}

async function crear(vehiculoId, payload, currentUser) {
  const empresaId = currentUser.empresa_id;
  const vehiculo = await vehiculosRepository.findById(vehiculoId, empresaId);
  if (!vehiculo) {
    throw new HttpError(404, "Vehículo no encontrado");
  }

  const items = Array.isArray(payload.items) ? payload.items : null;
  if (!items || items.length !== ITEMS_CHECKLIST.length) {
    throw new HttpError(400, "Debes responder todas las preguntas del preoperacional");
  }

  const itemsValidados = items.map((item) => {
    const codigo = String(item.item_codigo || "");
    const catalogoItem = ITEMS_POR_CODIGO.get(codigo);
    if (!catalogoItem) {
      throw new HttpError(400, `Pregunta de preoperacional inválida: ${codigo}`);
    }

    const respuesta = String(item.respuesta || "");
    if (!RESPUESTAS_VALIDAS.has(respuesta)) {
      throw new HttpError(400, `Respuesta inválida para "${catalogoItem.label}"`);
    }

    const observacion = item.observacion ? String(item.observacion).trim().slice(0, 500) : null;
    if (respuesta === "no" && !observacion) {
      throw new HttpError(400, `Debes explicar por qué respondiste "No" a: "${catalogoItem.label}"`);
    }

    return {
      item_codigo: catalogoItem.codigo,
      item_label: catalogoItem.label,
      respuesta,
      observacion
    };
  });

  // El viaje_id llega como query param desde home.js (se crea justo antes de
  // entrar al wizard), igual que en inspecciones.service.js. Si no es de este
  // mismo vehiculo/empresa se ignora en silencio en vez de bloquear el
  // guardado.
  let viajeId = null;
  if (payload.viaje_id) {
    const viaje = await viajesRepository.findById(payload.viaje_id, empresaId);
    if (viaje && String(viaje.vehiculo_id) === String(vehiculoId)) {
      viajeId = viaje.id;
    }
  }

  const preoperacional = await preoperacionalesRepository.create({
    vehiculo_id: vehiculoId,
    usuario_id: currentUser?.id ?? null,
    viaje_id: viajeId,
    empresa_id: empresaId
  });

  const itemsCreados = await itemsRepository.bulkCreate(preoperacional.id, vehiculoId, itemsValidados, empresaId);

  return {
    ...toSafePreoperacional({
      ...preoperacional,
      total_items: itemsCreados.length,
      total_items_no: itemsCreados.filter((item) => item.respuesta === "no").length
    }),
    items: itemsCreados.map(toSafeItem)
  };
}

async function listarPorVehiculo(vehiculoId, empresaId) {
  const vehiculo = await vehiculosRepository.findById(vehiculoId, empresaId);
  if (!vehiculo) {
    throw new HttpError(404, "Vehículo no encontrado");
  }

  const preoperacionales = await preoperacionalesRepository.findByVehiculo(vehiculoId, empresaId);
  return preoperacionales.map(toSafePreoperacional);
}

async function obtenerDetalle(preoperacionalId, empresaId) {
  const preoperacional = await preoperacionalesRepository.findById(preoperacionalId, empresaId);
  if (!preoperacional) {
    throw new HttpError(404, "Preoperacional no encontrado");
  }

  const items = await itemsRepository.findByPreoperacional(preoperacionalId, empresaId);

  return {
    ...toSafePreoperacional({
      ...preoperacional,
      total_items: items.length,
      total_items_no: items.filter((item) => item.respuesta === "no").length
    }),
    items: items.map(toSafeItem)
  };
}

module.exports = {
  getCatalogo,
  crear,
  listarPorVehiculo,
  obtenerDetalle
};
