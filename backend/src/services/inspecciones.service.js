const HttpError = require("../errors/http-error");
const vehiculosRepository = require("../repositories/vehiculos.repository");
const inspeccionesRepository = require("../repositories/inspecciones-preventivas.repository");
const itemsRepository = require("../repositories/inspeccion-items.repository");

// Catalogo fijo del checklist "radiografia". x/y son coordenadas porcentuales
// sobre el diagrama del carro (0-100), consumidas por el frontend para
// posicionar cada hotspot sin duplicar las coordenadas en el HTML.
const ITEMS_CHECKLIST = [
  { codigo: "llanta_di", label: "Llanta delantera izquierda", x: 20, y: 28 },
  { codigo: "llanta_dd", label: "Llanta delantera derecha", x: 80, y: 28 },
  { codigo: "llanta_ti", label: "Llanta trasera izquierda", x: 20, y: 72 },
  { codigo: "llanta_td", label: "Llanta trasera derecha", x: 80, y: 72 },
  { codigo: "llanta_repuesto", label: "Llanta de repuesto", x: 50, y: 94 },
  { codigo: "aceite", label: "Nivel de aceite", x: 50, y: 16 },
  { codigo: "kit_herramientas", label: "Kit de herramientas", x: 50, y: 84 },
  { codigo: "luces", label: "Luces", x: 50, y: 6 },
  { codigo: "extintor", label: "Extintor", x: 30, y: 50 },
  { codigo: "botiquin", label: "Botiquín / señales", x: 70, y: 50 }
];

const ITEMS_POR_CODIGO = new Map(ITEMS_CHECKLIST.map((item) => [item.codigo, item]));
const ESTADOS_VALIDOS = new Set(["bien", "mal"]);

function getCatalogo() {
  return ITEMS_CHECKLIST;
}

function toSafeItem(item) {
  return {
    id: item.id,
    item_codigo: item.item_codigo,
    item_label: item.item_label,
    estado: item.estado,
    comentario: item.comentario,
    foto_url: item.foto_url,
    foto_nombre: item.foto_nombre
  };
}

function toSafeInspeccion(inspeccion) {
  return {
    id: inspeccion.id,
    vehiculo_id: inspeccion.vehiculo_id,
    usuario_id: inspeccion.usuario_id,
    usuario_nombre: inspeccion.usuario_nombre,
    fecha: inspeccion.fecha,
    observaciones: inspeccion.observaciones,
    total_items: Number(inspeccion.total_items || 0),
    total_items_mal: Number(inspeccion.total_items_mal || 0)
  };
}

async function crear(vehiculoId, payload, archivos, currentUser) {
  const vehiculo = await vehiculosRepository.findById(vehiculoId);
  if (!vehiculo) {
    throw new HttpError(404, "Vehículo no encontrado");
  }

  let items;
  try {
    items = JSON.parse(payload.items);
  } catch (error) {
    throw new HttpError(400, "El listado de ítems del checklist es inválido");
  }

  if (!Array.isArray(items) || !items.length) {
    throw new HttpError(400, "Debes marcar al menos un ítem del checklist");
  }

  const archivosPorCampo = new Map((archivos || []).map((file) => [file.fieldname, file]));

  const itemsValidados = items.map((item) => {
    const codigo = String(item.item_codigo || "");
    const catalogoItem = ITEMS_POR_CODIGO.get(codigo);
    if (!catalogoItem) {
      throw new HttpError(400, `Ítem de checklist inválido: ${codigo}`);
    }

    const estado = String(item.estado || "");
    if (!ESTADOS_VALIDOS.has(estado)) {
      throw new HttpError(400, `Estado inválido para "${catalogoItem.label}"`);
    }

    const foto = archivosPorCampo.get(`foto_${codigo}`);

    return {
      item_codigo: catalogoItem.codigo,
      item_label: catalogoItem.label,
      estado,
      comentario: item.comentario ? String(item.comentario).trim().slice(0, 500) : null,
      foto_url: foto ? `/uploads/inspecciones/${foto.filename}` : null,
      foto_nombre: foto ? foto.originalname : null
    };
  });

  const inspeccion = await inspeccionesRepository.create({
    vehiculo_id: vehiculoId,
    usuario_id: currentUser?.id ?? null,
    observaciones: payload.observaciones ? String(payload.observaciones).trim().slice(0, 1000) : null
  });

  const itemsCreados = await itemsRepository.bulkCreate(inspeccion.id, vehiculoId, itemsValidados);

  return {
    ...toSafeInspeccion({
      ...inspeccion,
      total_items: itemsCreados.length,
      total_items_mal: itemsCreados.filter((item) => item.estado === "mal").length
    }),
    items: itemsCreados.map(toSafeItem)
  };
}

async function listarPorVehiculo(vehiculoId) {
  const vehiculo = await vehiculosRepository.findById(vehiculoId);
  if (!vehiculo) {
    throw new HttpError(404, "Vehículo no encontrado");
  }

  const inspecciones = await inspeccionesRepository.findByVehiculo(vehiculoId);
  return inspecciones.map(toSafeInspeccion);
}

async function obtenerDetalle(inspeccionId) {
  const inspeccion = await inspeccionesRepository.findById(inspeccionId);
  if (!inspeccion) {
    throw new HttpError(404, "Inspección no encontrada");
  }

  const items = await itemsRepository.findByInspeccion(inspeccionId);

  return {
    ...toSafeInspeccion({
      ...inspeccion,
      total_items: items.length,
      total_items_mal: items.filter((item) => item.estado === "mal").length
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
