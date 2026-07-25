const HttpError = require("../errors/http-error");
const vehiculosRepository = require("../repositories/vehiculos.repository");
const usuariosRepository = require("../repositories/usuarios.repository");
const entregasRepository = require("../repositories/entregas-recibidas.repository");
const itemsRepository = require("../repositories/entrega-items.repository");
const notificacionesService = require("./notificaciones.service");

// Catalogo fijo del checklist de entrega/recibida, mismo mecanismo de
// "radiografia" que inspecciones.service.js (hotspots x/y en % sobre el
// mismo diagrama del vehiculo), pero enfocado en dejar constancia del estado
// fisico (rayones, golpes, faltantes) al momento de cambiar de conductor,
// no en el equipo de seguridad obligatorio (eso ya lo cubre Inspecciones).
const ITEMS_CHECKLIST = [
  { codigo: "capo", label: "Capó / cofre", x: 50, y: 15 },
  { codigo: "techo", label: "Techo", x: 50, y: 50 },
  { codigo: "baul", label: "Baúl / platón", x: 50, y: 89 },
  { codigo: "parabrisas_delantero", label: "Parabrisas delantero", x: 50, y: 27 },
  { codigo: "parabrisas_trasero", label: "Vidrio trasero", x: 50, y: 73 },
  { codigo: "puerta_di", label: "Puerta delantera izquierda", x: 30, y: 44 },
  { codigo: "puerta_dd", label: "Puerta delantera derecha", x: 70, y: 44 },
  { codigo: "puerta_ti", label: "Puerta trasera izquierda", x: 30, y: 59 },
  { codigo: "puerta_td", label: "Puerta trasera derecha", x: 70, y: 59 },
  // Separados de las llantas delanteras (x:20/80, y:28) para que los iconos
  // circulares de 22px no se encimen en el diagrama: se suben hacia la zona
  // del parabrisas/puerta delantera (posicion real de un espejo) y se corren
  // un poco mas hacia afuera.
  { codigo: "espejo_izquierdo", label: "Espejo izquierdo", x: 14, y: 17 },
  { codigo: "espejo_derecho", label: "Espejo derecho", x: 86, y: 17 },
  { codigo: "faro_di", label: "Faro delantero izquierdo", x: 28, y: 9 },
  { codigo: "faro_dd", label: "Faro delantero derecho", x: 72, y: 9 },
  { codigo: "luz_ti", label: "Luz trasera izquierda", x: 28, y: 91 },
  { codigo: "luz_td", label: "Luz trasera derecha", x: 72, y: 91 },
  { codigo: "llanta_di", label: "Llanta delantera izquierda", x: 20, y: 28 },
  { codigo: "llanta_dd", label: "Llanta delantera derecha", x: 80, y: 28 },
  { codigo: "llanta_ti", label: "Llanta trasera izquierda", x: 20, y: 72 },
  { codigo: "llanta_td", label: "Llanta trasera derecha", x: 80, y: 72 },
  { codigo: "llanta_repuesto", label: "Llanta de repuesto", x: 50, y: 94 },
  {
    codigo: "elementos_seguridad",
    label: "Elementos y documentos",
    x: 50,
    y: 4,
    subItems: [
      { codigo: "elem_extintor", label: "Extintor" },
      { codigo: "elem_botiquin", label: "Botiquín de primeros auxilios" },
      { codigo: "elem_gato", label: "Gato" },
      { codigo: "elem_cruceta", label: "Cruceta / llave de ruedas" },
      { codigo: "elem_senales", label: "Señales de carretera" },
      { codigo: "elem_tapiceria", label: "Tapicería / interior" },
      { codigo: "elem_soat", label: "SOAT" },
      { codigo: "elem_tarjeta_propiedad", label: "Tarjeta de propiedad" }
    ]
  }
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
const MOTIVOS_VALIDOS = new Set(["cambio_conductor", "vacaciones", "retiro", "otro"]);

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

function toSafeEntrega(entrega) {
  return {
    id: entrega.id,
    vehiculo_id: entrega.vehiculo_id,
    usuario_id: entrega.usuario_id,
    usuario_nombre: entrega.usuario_nombre,
    usuario_entrega: entrega.usuario_entrega_id
      ? { id: entrega.usuario_entrega_id, nombre: entrega.usuario_entrega_nombre, email: entrega.usuario_entrega_email }
      : null,
    usuario_recibe: entrega.usuario_recibe_id
      ? { id: entrega.usuario_recibe_id, nombre: entrega.usuario_recibe_nombre, email: entrega.usuario_recibe_email }
      : null,
    motivo: entrega.motivo,
    kilometraje: entrega.kilometraje != null ? Number(entrega.kilometraje) : null,
    observaciones: entrega.observaciones,
    firma_entrega_url: entrega.firma_entrega_url,
    firma_recibe_url: entrega.firma_recibe_url,
    fecha: entrega.fecha,
    total_items: Number(entrega.total_items || 0),
    total_items_mal: Number(entrega.total_items_mal || 0)
  };
}

async function crear(vehiculoId, payload, archivos, currentUser) {
  const empresaId = currentUser.empresa_id;
  const vehiculo = await vehiculosRepository.findById(vehiculoId, empresaId);
  if (!vehiculo) {
    throw new HttpError(404, "Vehículo no encontrado");
  }

  if (!MOTIVOS_VALIDOS.has(payload.motivo)) {
    throw new HttpError(400, "El motivo del acta no es válido");
  }

  const usuarioEntregaId = payload.usuario_entrega_id || null;
  const usuarioRecibeId = payload.usuario_recibe_id || null;
  if (!usuarioEntregaId || !usuarioRecibeId) {
    throw new HttpError(400, "Debes indicar quién entrega y quién recibe el vehículo");
  }
  if (String(usuarioEntregaId) === String(usuarioRecibeId)) {
    throw new HttpError(400, "Quien entrega y quien recibe no pueden ser la misma persona");
  }

  const [usuarioEntrega, usuarioRecibe] = await Promise.all([
    usuariosRepository.findById(usuarioEntregaId, empresaId),
    usuariosRepository.findById(usuarioRecibeId, empresaId)
  ]);

  if (!usuarioEntrega) {
    throw new HttpError(400, "El usuario que entrega no existe o no pertenece a esta empresa");
  }
  if (!usuarioRecibe) {
    throw new HttpError(400, "El usuario que recibe no existe o no pertenece a esta empresa");
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
      foto_url: foto ? `/uploads/entregas/${foto.filename}` : null,
      foto_nombre: foto ? foto.originalname : null
    };
  });

  const kilometraje = payload.kilometraje !== undefined && payload.kilometraje !== "" ? Number(payload.kilometraje) : null;
  if (kilometraje !== null && (!Number.isFinite(kilometraje) || kilometraje < 0)) {
    throw new HttpError(400, "El kilometraje no es válido");
  }

  // El odometro no retrocede: mismo criterio que mantenimientos.service.js.
  const kilometrajeActual = Number(vehiculo.kilometraje_actual || 0);
  if (kilometraje !== null && kilometraje < kilometrajeActual) {
    await notificacionesService.notificarIncoherenciaKilometraje({ vehiculo, kilometrajeIntentado: kilometraje });
    throw new HttpError(400, `El kilometraje debe ser mayor o igual al actual del vehículo (${kilometrajeActual} km)`);
  }

  const firmaEntrega = archivosPorCampo.get("firma_entrega");
  const firmaRecibe = archivosPorCampo.get("firma_recibe");
  if (!firmaEntrega || !firmaRecibe) {
    throw new HttpError(400, "Se requiere la firma de quien entrega y de quien recibe el vehículo");
  }

  const entrega = await entregasRepository.create({
    vehiculo_id: vehiculoId,
    usuario_id: currentUser?.id ?? null,
    usuario_entrega_id: usuarioEntrega.id,
    usuario_recibe_id: usuarioRecibe.id,
    motivo: payload.motivo,
    kilometraje,
    observaciones: payload.observaciones ? String(payload.observaciones).trim().slice(0, 1000) : null,
    firma_entrega_url: `/uploads/entregas/${firmaEntrega.filename}`,
    firma_entrega_nombre: firmaEntrega.originalname,
    firma_recibe_url: `/uploads/entregas/${firmaRecibe.filename}`,
    firma_recibe_nombre: firmaRecibe.originalname,
    empresa_id: empresaId
  });

  const itemsCreados = await itemsRepository.bulkCreate(entrega.id, vehiculoId, itemsValidados, empresaId);
  const itemsMal = itemsCreados.filter((item) => item.estado === "mal");

  await notificacionesService.notificarUsuariosPorRol(
    ["Administrador", "Operador"],
    {
      tipo: "entrega_recibida_registrada",
      mensaje: `Se registró el acta de vehículo de ${vehiculo.marca} ${vehiculo.modelo} (${vehiculo.placa}) entre ${usuarioEntrega.nombre} y ${usuarioRecibe.nombre}${itemsMal.length ? `, con ${itemsMal.length} novedad${itemsMal.length === 1 ? "" : "es"} registrada${itemsMal.length === 1 ? "" : "s"}` : ""}.`,
      vehiculo_id: vehiculo.id,
      referencia_tipo: "entrega_recibida",
      referencia_id: entrega.id,
      accion: { tipo: "ver_vehiculo", payload: { vehiculo_id: vehiculo.id } }
    },
    empresaId
  );

  return {
    ...toSafeEntrega({
      ...entrega,
      usuario_nombre: currentUser?.nombre,
      usuario_entrega_nombre: usuarioEntrega.nombre,
      usuario_entrega_email: usuarioEntrega.email,
      usuario_recibe_nombre: usuarioRecibe.nombre,
      usuario_recibe_email: usuarioRecibe.email,
      total_items: itemsCreados.length,
      total_items_mal: itemsMal.length
    }),
    items: itemsCreados.map(toSafeItem)
  };
}

async function listarPorVehiculo(vehiculoId, empresaId) {
  const vehiculo = await vehiculosRepository.findById(vehiculoId, empresaId);
  if (!vehiculo) {
    throw new HttpError(404, "Vehículo no encontrado");
  }

  const entregas = await entregasRepository.findByVehiculo(vehiculoId, empresaId);
  return entregas.map(toSafeEntrega);
}

async function obtenerDetalle(entregaId, empresaId) {
  const entrega = await entregasRepository.findById(entregaId, empresaId);
  if (!entrega) {
    throw new HttpError(404, "Acta de vehículo no encontrada");
  }

  const items = await itemsRepository.findByEntrega(entregaId, empresaId);

  return {
    ...toSafeEntrega({
      ...entrega,
      total_items: items.length,
      total_items_mal: items.filter((item) => item.estado === "mal").length
    }),
    items: items.map(toSafeItem)
  };
}

async function listUsuariosDisponibles(empresaId) {
  return usuariosRepository.findAllActivosSimplificado(empresaId);
}

module.exports = {
  getCatalogo,
  crear,
  listarPorVehiculo,
  obtenerDetalle,
  listUsuariosDisponibles,
  MOTIVOS_VALIDOS
};
