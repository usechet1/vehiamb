const HttpError = require("../errors/http-error");
const vehiculosRepository = require("../repositories/vehiculos.repository");
const extintoresRepository = require("../repositories/extintores.repository");
const inspeccionesBotiquinRepository = require("../repositories/inspecciones-botiquin.repository");
const botiquinItemsRepository = require("../repositories/botiquin-items.repository");
const inspeccionesHerramientasRepository = require("../repositories/inspecciones-herramientas.repository");
const herramientasItemsRepository = require("../repositories/herramientas-items.repository");

// Catalogo fijo del "FORMATO INSPECCION DE BOTIQUINES VEHICULOS"
// (SG-SST-FT, version 001 del 21-10-2024). El orden de esta lista es el orden
// en que se muestran e imprimen los renglones, asi que respeta el del formato
// fisico. Agregar un insumo nuevo es una entrada mas aqui: el frontend, la
// validacion y el PDF salen todos de este mismo catalogo.
const ITEMS_BOTIQUIN = [
  { codigo: "algodon", label: "Algodón cotton softer 25g/088 oz" },
  { codigo: "venda_algodon_laminado", label: 'Venda de algodón laminado 3"x 5 yardas' },
  { codigo: "venda_elastica", label: 'Venda elástica 2"x 5 yardas' },
  { codigo: "inmovilizador_cuello", label: "Inmovilizador de cuello" },
  { codigo: "guantes_quirurgicos", label: "Guantes quirúrgicos desechables" },
  { codigo: "solucion_inyectable", label: "Solución inyectable 500 ml" },
  { codigo: "alcohol_antiseptico", label: "Alcohol antiséptico 70% - 120ml" },
  { codigo: "jeringa_desechable", label: "Jeringa desechable estéril 5ml" },
  { codigo: "bajalenguas", label: "Bajalenguas de madera paqx10" },
  { codigo: "hisopos", label: "Hisopos punta de algodón paqx10" },
  { codigo: "silbato", label: "Silbato" },
  { codigo: "esparadrapo", label: 'Esparadrapo de tela 1"x5 yardas' },
  { codigo: "gasa_no_tejida", label: 'Gasa no tejida 3"x3"' },
  { codigo: "tiras_adhesivas", label: "Tiras adhesivas (curitas)" },
  { codigo: "toallas_higienicas", label: "Toallas higiénicas" },
  { codigo: "parche_ojos", label: "Parche para ojos" },
  { codigo: "tijeras", label: "Tijeras" },
  { codigo: "sales_rehidratacion", label: "Sales de rehidratación oral 28.4g" },
  { codigo: "tapabocas", label: "Tapabocas desechables" },
  { codigo: "cinta_microporosa", label: "Cinta adhesiva microporosa" }
];

const ITEMS_POR_CODIGO = new Map(ITEMS_BOTIQUIN.map((item) => [item.codigo, item]));

// Los primeros 9 codigos ("kit_alicate", "kit_gato", etc.) son los mismos
// que ya existen como sub-items del grupo "kit_herramientas" dentro del
// checklist de la inspeccion preventiva (ver ITEMS_CHECKLIST en
// inspecciones.service.js) -- se copian los codigos/labels aca en vez de
// importarlos porque ese catalogo vive mezclado con el resto de items del
// chequeo de ruta (llantas, luces, etc.) y aca solo hace falta el
// subconjunto de herramientas, con su propio formato de inspeccion
// detallada. "kit_llanta_repuesto" es la excepcion: en la inspeccion
// preventiva la llanta de repuesto ya tiene su propio hotspot aparte
// (codigo "llanta_repuesto", fuera del grupo kit_herramientas), pero este
// modulo SG-SST no tenia ningun lugar donde registrarla -- a diferencia de
// botiquin y extintor, que sí tienen su propia pestaña aca mismo y por eso
// no se duplican en este catalogo. Los 9 items del kit exigido por el
// Articulo 30 de la Ley 769 de 2002 quedan cubiertos entre este catalogo y
// las pestañas de Botiquín y Extintor de esta misma página.
const ITEMS_HERRAMIENTAS = [
  { codigo: "kit_alicate", label: "Alicate" },
  { codigo: "kit_destornilladores", label: "Destornilladores" },
  { codigo: "kit_llave_expansion", label: "Llave de expansión" },
  { codigo: "kit_llaves_fijas", label: "Llaves fijas" },
  { codigo: "kit_gato", label: "Gato" },
  { codigo: "kit_cruceta", label: "Cruceta" },
  { codigo: "kit_senales", label: "Señales de carretera" },
  { codigo: "kit_tacos", label: "Tacos para bloquear el vehículo" },
  { codigo: "kit_llanta_repuesto", label: "Llanta de repuesto" },
  { codigo: "kit_linterna", label: "Linterna" }
];

const ITEMS_HERRAMIENTAS_POR_CODIGO = new Map(ITEMS_HERRAMIENTAS.map((item) => [item.codigo, item]));

const ESTADOS_VALIDOS = new Set(["bueno", "malo", "no_tiene"]);

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

function getCatalogoBotiquin() {
  return ITEMS_BOTIQUIN;
}

function getCatalogoHerramientas() {
  return ITEMS_HERRAMIENTAS;
}

function texto(valor, maximo = 200) {
  if (valor === undefined || valor === null) return null;
  const limpio = String(valor).trim();
  return limpio ? limpio.slice(0, maximo) : null;
}

function fechaObligatoria(valor, campo) {
  const fecha = texto(valor, 10);
  if (!fecha || !FECHA_ISO.test(fecha)) {
    throw new HttpError(400, `${campo} es obligatoria y debe tener el formato AAAA-MM-DD`);
  }
  return fecha;
}

function fechaOpcional(valor, campo) {
  const fecha = texto(valor, 10);
  if (!fecha) return null;
  if (!FECHA_ISO.test(fecha)) {
    throw new HttpError(400, `${campo} debe tener el formato AAAA-MM-DD`);
  }
  return fecha;
}

async function asegurarVehiculo(vehiculoId, empresaId) {
  if (!vehiculoId) {
    throw new HttpError(400, "El vehículo es obligatorio");
  }

  const vehiculo = await vehiculosRepository.findById(vehiculoId, empresaId);
  if (!vehiculo) {
    throw new HttpError(404, "Vehículo no encontrado");
  }

  return vehiculo;
}

// ───────────────────────────── Extintores ─────────────────────────────

function normalizarExtintor(payload) {
  const codigo = texto(payload.codigo, 60);
  if (!codigo) {
    throw new HttpError(400, "El código del extintor es obligatorio");
  }

  const libras = Number(payload.libras);
  if (!Number.isFinite(libras) || libras <= 0) {
    throw new HttpError(400, "Las libras del extintor deben ser un número mayor a cero");
  }

  return {
    vehiculo_id: payload.vehiculo_id ? Number(payload.vehiculo_id) : null,
    codigo,
    libras,
    fecha_vencimiento: fechaObligatoria(payload.fecha_vencimiento, "La fecha de vencimiento")
  };
}

async function listarExtintores(empresaId) {
  return extintoresRepository.findAll(empresaId);
}

async function crearExtintor(payload, currentUser) {
  const empresaId = currentUser.empresa_id;
  const extintor = normalizarExtintor(payload);
  await asegurarVehiculo(extintor.vehiculo_id, empresaId);

  // El consecutivo lo calcula el servicio, nunca lo manda el formulario --
  // ver findSiguienteConsecutivo en extintores.repository.js.
  const consecutivo = await extintoresRepository.findSiguienteConsecutivo(empresaId);

  return extintoresRepository.create({
    ...extintor,
    consecutivo,
    usuario_id: currentUser?.id ?? null,
    empresa_id: empresaId
  });
}

async function actualizarExtintor(id, payload, empresaId) {
  const existente = await extintoresRepository.findById(id, empresaId);
  if (!existente) {
    throw new HttpError(404, "Extintor no encontrado");
  }

  const extintor = normalizarExtintor(payload);
  await asegurarVehiculo(extintor.vehiculo_id, empresaId);

  return extintoresRepository.update(id, extintor, empresaId);
}

async function eliminarExtintor(id, empresaId) {
  const existente = await extintoresRepository.findById(id, empresaId);
  if (!existente) {
    throw new HttpError(404, "Extintor no encontrado");
  }

  await extintoresRepository.remove(id, empresaId);
}

// ─────────────────────── Inspecciones de botiquín ───────────────────────

// Compartida entre botiquin y kit de herramientas: la validacion de cada
// renglon del checklist es identica en los dos (mismas reglas de estado/
// cantidad), solo cambia de que catalogo sale el item_codigo valido, como se
// llama el modulo en los mensajes de error, y el campo extra propio de cada
// uno (botiquin vence, herramientas no -- ver normalizarExtra).
function normalizarItemsChecklist(itemsPayload, itemsPorCodigo, nombreModulo, normalizarExtra) {
  if (!Array.isArray(itemsPayload) || !itemsPayload.length) {
    throw new HttpError(400, `Debes diligenciar el checklist de ${nombreModulo}`);
  }

  return itemsPayload.map((item) => {
    const codigo = String(item.item_codigo || "");
    const catalogoItem = itemsPorCodigo.get(codigo);
    if (!catalogoItem) {
      throw new HttpError(400, `Ítem de ${nombreModulo} inválido: ${codigo}`);
    }

    const estado = String(item.estado || "");
    if (!ESTADOS_VALIDOS.has(estado)) {
      throw new HttpError(400, `Debes marcar bueno, malo o no tiene para "${catalogoItem.label}"`);
    }

    // La cantidad es opcional (el formato la deja en blanco cuando no aplica),
    // pero si viene tiene que ser un entero no negativo.
    let cantidad = null;
    if (item.cantidad !== undefined && item.cantidad !== null && item.cantidad !== "") {
      cantidad = Number(item.cantidad);
      if (!Number.isInteger(cantidad) || cantidad < 0) {
        throw new HttpError(400, `La cantidad de "${catalogoItem.label}" debe ser un número entero positivo`);
      }
    }

    return {
      item_codigo: catalogoItem.codigo,
      item_label: catalogoItem.label,
      estado,
      cantidad,
      ...normalizarExtra(item, catalogoItem)
    };
  });
}

function toSafeItem(item) {
  return {
    id: item.id,
    item_codigo: item.item_codigo,
    item_label: item.item_label,
    estado: item.estado,
    cantidad: item.cantidad != null ? Number(item.cantidad) : null,
    fecha_vencimiento: item.fecha_vencimiento ?? null,
    codigo: item.codigo ?? null
  };
}

function toSafeInspeccion(inspeccion) {
  return {
    id: inspeccion.id,
    vehiculo_id: inspeccion.vehiculo_id,
    placa: inspeccion.placa,
    marca: inspeccion.marca,
    modelo: inspeccion.modelo,
    fecha: inspeccion.fecha,
    inspeccionado_por_nombres: inspeccion.inspeccionado_por_nombres,
    inspeccionado_por_apellidos: inspeccion.inspeccionado_por_apellidos,
    inspeccionado_por_cargo: inspeccion.inspeccionado_por_cargo,
    revisado_por_nombres: inspeccion.revisado_por_nombres,
    revisado_por_apellidos: inspeccion.revisado_por_apellidos,
    revisado_por_cargo: inspeccion.revisado_por_cargo,
    observaciones: inspeccion.observaciones,
    total_items: Number(inspeccion.total_items || 0),
    total_items_malos: Number(inspeccion.total_items_malos || 0),
    creado_en: inspeccion.creado_en
  };
}

async function listarInspecciones(filtros, empresaId) {
  const inspecciones = await inspeccionesBotiquinRepository.findAll(filtros, empresaId);
  return inspecciones.map(toSafeInspeccion);
}

async function obtenerInspeccion(id, empresaId) {
  const inspeccion = await inspeccionesBotiquinRepository.findById(id, empresaId);
  if (!inspeccion) {
    throw new HttpError(404, "Inspección de botiquín no encontrada");
  }

  const items = await botiquinItemsRepository.findByInspeccion(id, empresaId);

  return { ...toSafeInspeccion(inspeccion), items: items.map(toSafeItem) };
}

async function crearInspeccion(payload, currentUser) {
  const empresaId = currentUser.empresa_id;
  const vehiculoId = payload.vehiculo_id ? Number(payload.vehiculo_id) : null;
  await asegurarVehiculo(vehiculoId, empresaId);

  const nombres = texto(payload.inspeccionado_por_nombres, 80);
  const apellidos = texto(payload.inspeccionado_por_apellidos, 80);
  if (!nombres || !apellidos) {
    throw new HttpError(400, "Los nombres y apellidos de quien inspecciona son obligatorios");
  }

  const items = normalizarItemsChecklist(payload.items, ITEMS_POR_CODIGO, "botiquín", (item, catalogoItem) => ({
    fecha_vencimiento: fechaOpcional(item.fecha_vencimiento, `La fecha de vencimiento de "${catalogoItem.label}"`)
  }));

  const inspeccion = await inspeccionesBotiquinRepository.create({
    vehiculo_id: vehiculoId,
    fecha: fechaObligatoria(payload.fecha, "La fecha de la inspección"),
    inspeccionado_por_nombres: nombres,
    inspeccionado_por_apellidos: apellidos,
    inspeccionado_por_cargo: texto(payload.inspeccionado_por_cargo, 80),
    revisado_por_nombres: texto(payload.revisado_por_nombres, 80),
    revisado_por_apellidos: texto(payload.revisado_por_apellidos, 80),
    revisado_por_cargo: texto(payload.revisado_por_cargo, 80),
    observaciones: texto(payload.observaciones, 1000),
    usuario_id: currentUser?.id ?? null,
    empresa_id: empresaId
  });

  const itemsCreados = await botiquinItemsRepository.bulkCreate(inspeccion.id, items, empresaId);

  return {
    ...toSafeInspeccion({
      ...inspeccion,
      total_items: itemsCreados.length,
      total_items_malos: itemsCreados.filter((item) => item.estado === "malo").length
    }),
    items: itemsCreados.map(toSafeItem)
  };
}

async function eliminarInspeccion(id, empresaId) {
  const existente = await inspeccionesBotiquinRepository.findById(id, empresaId);
  if (!existente) {
    throw new HttpError(404, "Inspección de botiquín no encontrada");
  }

  // botiquin_items tiene ON DELETE CASCADE, asi que los renglones se van con
  // la cabecera sin borrarlos a mano.
  await inspeccionesBotiquinRepository.remove(id, empresaId);
}

// ─────────────────────── Inspecciones de kit de herramientas ───────────────────────
// Mismo par cabecera+items, misma validacion (normalizarItemsChecklist) y
// mismos toSafeItem/toSafeInspeccion que botiquin -- lo unico que cambia es
// el catalogo de items y el repositorio de destino.

async function listarInspeccionesHerramientas(filtros, empresaId) {
  const inspecciones = await inspeccionesHerramientasRepository.findAll(filtros, empresaId);
  return inspecciones.map(toSafeInspeccion);
}

async function obtenerInspeccionHerramientas(id, empresaId) {
  const inspeccion = await inspeccionesHerramientasRepository.findById(id, empresaId);
  if (!inspeccion) {
    throw new HttpError(404, "Inspección de kit de herramientas no encontrada");
  }

  const items = await herramientasItemsRepository.findByInspeccion(id, empresaId);

  return { ...toSafeInspeccion(inspeccion), items: items.map(toSafeItem) };
}

async function crearInspeccionHerramientas(payload, currentUser) {
  const empresaId = currentUser.empresa_id;
  const vehiculoId = payload.vehiculo_id ? Number(payload.vehiculo_id) : null;
  await asegurarVehiculo(vehiculoId, empresaId);

  const nombres = texto(payload.inspeccionado_por_nombres, 80);
  const apellidos = texto(payload.inspeccionado_por_apellidos, 80);
  if (!nombres || !apellidos) {
    throw new HttpError(400, "Los nombres y apellidos de quien inspecciona son obligatorios");
  }

  const items = normalizarItemsChecklist(payload.items, ITEMS_HERRAMIENTAS_POR_CODIGO, "kit de herramientas", (item) => ({
    codigo: texto(item.codigo, 60)
  }));

  const inspeccion = await inspeccionesHerramientasRepository.create({
    vehiculo_id: vehiculoId,
    fecha: fechaObligatoria(payload.fecha, "La fecha de la inspección"),
    inspeccionado_por_nombres: nombres,
    inspeccionado_por_apellidos: apellidos,
    inspeccionado_por_cargo: texto(payload.inspeccionado_por_cargo, 80),
    revisado_por_nombres: texto(payload.revisado_por_nombres, 80),
    revisado_por_apellidos: texto(payload.revisado_por_apellidos, 80),
    revisado_por_cargo: texto(payload.revisado_por_cargo, 80),
    observaciones: texto(payload.observaciones, 1000),
    usuario_id: currentUser?.id ?? null,
    empresa_id: empresaId
  });

  const itemsCreados = await herramientasItemsRepository.bulkCreate(inspeccion.id, items, empresaId);

  return {
    ...toSafeInspeccion({
      ...inspeccion,
      total_items: itemsCreados.length,
      total_items_malos: itemsCreados.filter((item) => item.estado === "malo").length
    }),
    items: itemsCreados.map(toSafeItem)
  };
}

async function eliminarInspeccionHerramientas(id, empresaId) {
  const existente = await inspeccionesHerramientasRepository.findById(id, empresaId);
  if (!existente) {
    throw new HttpError(404, "Inspección de kit de herramientas no encontrada");
  }

  // herramientas_items tiene ON DELETE CASCADE, asi que los renglones se van
  // con la cabecera sin borrarlos a mano.
  await inspeccionesHerramientasRepository.remove(id, empresaId);
}

module.exports = {
  getCatalogoBotiquin,
  getCatalogoHerramientas,
  listarExtintores,
  crearExtintor,
  actualizarExtintor,
  eliminarExtintor,
  listarInspecciones,
  obtenerInspeccion,
  crearInspeccion,
  eliminarInspeccion,
  listarInspeccionesHerramientas,
  obtenerInspeccionHerramientas,
  crearInspeccionHerramientas,
  eliminarInspeccionHerramientas
};
