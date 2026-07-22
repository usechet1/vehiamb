const HttpError = require("../errors/http-error");
const vehiculosRepository = require("../repositories/vehiculos.repository");
const inspeccionesRepository = require("../repositories/inspecciones-preventivas.repository");
const itemsRepository = require("../repositories/inspeccion-items.repository");
const viajesRepository = require("../repositories/viajes.repository");
const notificacionesService = require("./notificaciones.service");

// Catalogo fijo del checklist "radiografia". x/y son coordenadas porcentuales
// sobre el diagrama del carro (0-100), consumidas por el frontend para
// posicionar cada hotspot sin duplicar las coordenadas en el HTML.
//
// "kit_herramientas" es un item agrupador: no se marca directamente, sino
// que expone subItems con el equipo de carretera minimo del Articulo 30 de
// la Ley 769 de 2002, excepto botiquin y extintor (ya son hotspots propios)
// y la llanta de repuesto (tambien aparte). El frontend muestra un solo
// hotspot en el diagrama para el grupo, pero el checklist dentro del panel
// marca cada subItem por separado; cada uno se guarda como una fila
// independiente de inspeccion_items (mismo tratamiento que cualquier otro
// item del catalogo).
const ITEMS_CHECKLIST = [
  { codigo: "llanta_di", label: "Llanta delantera izquierda", x: 20, y: 28 },
  { codigo: "llanta_dd", label: "Llanta delantera derecha", x: 80, y: 28 },
  { codigo: "llanta_ti", label: "Llanta trasera izquierda", x: 20, y: 72 },
  { codigo: "llanta_td", label: "Llanta trasera derecha", x: 80, y: 72 },
  { codigo: "llanta_repuesto", label: "Llanta de repuesto", x: 50, y: 94 },
  { codigo: "aceite", label: "Nivel de aceite", x: 50, y: 16 },
  {
    codigo: "kit_herramientas",
    label: "Kit de herramientas",
    x: 50,
    y: 84,
    subItems: [
      { codigo: "kit_alicate", label: "Alicate" },
      { codigo: "kit_destornilladores", label: "Destornilladores" },
      { codigo: "kit_llave_expansion", label: "Llave de expansión" },
      { codigo: "kit_llaves_fijas", label: "Llaves fijas" },
      { codigo: "kit_gato", label: "Gato" },
      { codigo: "kit_cruceta", label: "Cruceta" },
      { codigo: "kit_senales", label: "Señales de carretera" },
      { codigo: "kit_tacos", label: "Tacos para bloquear el vehículo" },
      { codigo: "kit_linterna", label: "Linterna" }
    ]
  },
  { codigo: "luces", label: "Luces", x: 50, y: 6 },
  { codigo: "extintor", label: "Extintor", x: 30, y: 50 },
  { codigo: "botiquin", label: "Botiquín de primeros auxilios", x: 70, y: 50 }
];

const ITEMS_POR_CODIGO = new Map();
for (const item of ITEMS_CHECKLIST) {
  if (item.subItems) {
    for (const subItem of item.subItems) {
      ITEMS_POR_CODIGO.set(subItem.codigo, subItem);
    }
    continue;
  }
  ITEMS_POR_CODIGO.set(item.codigo, item);
}

const ESTADOS_VALIDOS = new Set(["bien", "mal"]);

function parseCoordenada(valor, min, max) {
  if (valor === undefined || valor === null || valor === "") return null;
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero < min || numero > max) {
    throw new HttpError(400, "Las coordenadas de ubicación son inválidas");
  }
  return numero;
}

function getCatalogo() {
  return ITEMS_CHECKLIST;
}

function getTotalItemsCatalogo() {
  return ITEMS_CHECKLIST.reduce((total, item) => total + (item.subItems ? item.subItems.length : 1), 0);
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
    viaje_id: inspeccion.viaje_id,
    destino: inspeccion.viaje_destino,
    fecha: inspeccion.fecha,
    observaciones: inspeccion.observaciones,
    latitud: inspeccion.latitud != null ? Number(inspeccion.latitud) : null,
    longitud: inspeccion.longitud != null ? Number(inspeccion.longitud) : null,
    ubicacion_precision: inspeccion.ubicacion_precision != null ? Number(inspeccion.ubicacion_precision) : null,
    total_items: Number(inspeccion.total_items || 0),
    total_items_mal: Number(inspeccion.total_items_mal || 0)
  };
}

async function crear(vehiculoId, payload, archivos, currentUser) {
  const empresaId = currentUser.empresa_id;
  const vehiculo = await vehiculosRepository.findById(vehiculoId, empresaId);
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

  const latitud = parseCoordenada(payload.latitud, -90, 90);
  const longitud = parseCoordenada(payload.longitud, -180, 180);
  const ubicacionPrecision = parseCoordenada(payload.ubicacion_precision, 0, 1000000);

  // El viaje_id llega como query param desde home.js (se crea justo antes de
  // entrar al wizard). Si no es de este mismo vehiculo/empresa se ignora en
  // silencio en vez de bloquear el guardado -- es solo el dato de "punto de
  // llegada", nunca debe impedir registrar la inspeccion.
  let viajeId = null;
  if (payload.viaje_id) {
    const viaje = await viajesRepository.findById(payload.viaje_id, empresaId);
    if (viaje && String(viaje.vehiculo_id) === String(vehiculoId)) {
      viajeId = viaje.id;
    }
  }

  const inspeccion = await inspeccionesRepository.create({
    vehiculo_id: vehiculoId,
    usuario_id: currentUser?.id ?? null,
    viaje_id: viajeId,
    observaciones: payload.observaciones ? String(payload.observaciones).trim().slice(0, 1000) : null,
    latitud,
    longitud,
    ubicacion_precision: ubicacionPrecision,
    empresa_id: empresaId
  });

  const itemsCreados = await itemsRepository.bulkCreate(inspeccion.id, vehiculoId, itemsValidados, empresaId);

  await notificacionesService.evaluarNotificacionInspeccion({
    inspeccion,
    vehiculo,
    currentUser,
    totalItemsFaltantes: getTotalItemsCatalogo() - itemsCreados.length,
    totalItemsMal: itemsCreados.filter((item) => item.estado === "mal").length,
    itemsMal: itemsCreados.filter((item) => item.estado === "mal").map(toSafeItem)
  });

  return {
    ...toSafeInspeccion({
      ...inspeccion,
      total_items: itemsCreados.length,
      total_items_mal: itemsCreados.filter((item) => item.estado === "mal").length
    }),
    items: itemsCreados.map(toSafeItem)
  };
}

async function listarPorVehiculo(vehiculoId, empresaId) {
  const vehiculo = await vehiculosRepository.findById(vehiculoId, empresaId);
  if (!vehiculo) {
    throw new HttpError(404, "Vehículo no encontrado");
  }

  const inspecciones = await inspeccionesRepository.findByVehiculo(vehiculoId, empresaId);
  return inspecciones.map(toSafeInspeccion);
}

async function obtenerDetalle(inspeccionId, empresaId) {
  const inspeccion = await inspeccionesRepository.findById(inspeccionId, empresaId);
  if (!inspeccion) {
    throw new HttpError(404, "Inspección no encontrada");
  }

  const items = await itemsRepository.findByInspeccion(inspeccionId, empresaId);

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
