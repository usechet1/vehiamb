const HttpError = require("../errors/http-error");
const vehiculosRepository = require("../repositories/vehiculos.repository");
const viajesRepository = require("../repositories/viajes.repository");
const documentosRepository = require("../repositories/documentos.repository");
const conductoresRepository = require("../repositories/conductores.repository");
const conductorLicenciasRepository = require("../repositories/conductor-licencias.repository");
const inspeccionesRepository = require("../repositories/inspecciones-preventivas.repository");
const itemsRepository = require("../repositories/inspeccion-items.repository");
const preoperacionalesRepository = require("../repositories/preoperacionales.repository");
const preoperacionalItemsRepository = require("../repositories/preoperacional-items.repository");
const asignacionesRepository = require("../repositories/asignaciones.repository");
const notificacionComentariosRepository = require("../repositories/notificacion-comentarios.repository");
const usuariosRepository = require("../repositories/usuarios.repository");
const { hoyIso, mananaIso } = require("../utils/fecha-negocio");

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

  // Mismo criterio que asignaciones.service.js: un vehiculo que no esta
  // "activo" (en reparacion, fuera de servicio o dado de baja) no puede
  // usarse para iniciar un viaje. El selector de vehiculo del conductor
  // (home.js) ya lo deja ver pero deshabilitado -- esta es la validacion
  // real, por si llega una peticion directa a la API.
  if (vehiculo.estado !== "activo") {
    throw new HttpError(409, `El vehículo ${vehiculo.placa} no está disponible (estado: ${vehiculo.estado}).`);
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

  // Si el conductor ya habia preparado la inspeccion de esta asignacion el
  // dia anterior (ver home.js "preinspeccion"), esa inspeccion quedo sin
  // viaje_id porque el viaje todavia no existia -- se vincula ahora que si
  // existe, para que su resumen la encuentre (ver bug reportado: "aparece
  // no registrada" pese a que el conductor si la hizo).
  if (payload.asignacion_id) {
    await inspeccionesRepository.vincularViaje(payload.asignacion_id, viaje.id, currentUser.empresa_id);
  }

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

  const licencias = conductor
    ? await conductorLicenciasRepository.findByConductor(conductor.id, empresaId)
    : [];

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
          licencias: licencias.map((licencia) => ({
            categoria: licencia.categoria,
            fecha_vencimiento: licencia.fecha_vencimiento,
            archivo_url: licencia.archivo_url,
            archivo_nombre: licencia.archivo_nombre
          }))
        }
      : null
  };
}

// Asignacion de "Asignacion de rutas" (calendario de Bogota) para el
// conductor logueado, para una fecha puntual (hoy o mañana) -- permite que
// la pantalla de inicio del conductor (home.js inicializarConductorHome)
// muestre directamente su vehiculo/ruta en vez de que tenga que elegirlos a
// mano. Devuelve null si el conductor no esta vinculado a un usuario, si no
// hay asignacion para esa fecha, o si la asignacion no tiene vehiculo
// cargado -- en cualquiera de esos casos el frontend cae al flujo manual de
// siempre. Tambien agrega si ya existe una inspeccion preparada de antemano
// para esa asignacion (ver inspecciones.service.js, modo "preinspeccion"), y
// si el viaje de hoy ya quedo totalmente cerrado (inspeccion + preoperacional
// + firma) -- sin esto ultimo, un conductor que ya termino su unica ruta del
// dia volvia a ver la tarjeta "Iniciar viaje" en Inicio y podia arrancar un
// viaje duplicado sobre la misma asignacion.
async function resolverAsignacionParaFecha(currentUser, fecha) {
  const conductor = await conductoresRepository.findByUsuarioId(currentUser.id, currentUser.empresa_id);
  if (!conductor) return null;

  const asignacion = await asignacionesRepository.findByConductorYFecha(conductor.id, fecha, currentUser.empresa_id);
  if (!asignacion || !asignacion.vehiculo_id) return null;

  const inspeccionPrevia = await inspeccionesRepository.findByAsignacionId(asignacion.id, currentUser.empresa_id);
  const preoperacionalPrevio = inspeccionPrevia?.viaje_id
    ? await preoperacionalesRepository.findByViajeId(inspeccionPrevia.viaje_id, currentUser.empresa_id)
    : null;

  return {
    id: asignacion.id,
    fecha: asignacion.fecha,
    ruta_nombre: asignacion.ruta_nombre,
    inspeccion_completada: Boolean(inspeccionPrevia),
    viaje_completado: Boolean(preoperacionalPrevio),
    vehiculo: {
      id: asignacion.vehiculo_id,
      placa: asignacion.vehiculo_placa,
      marca: asignacion.vehiculo_marca,
      modelo: asignacion.vehiculo_modelo,
      imagen_url: asignacion.vehiculo_imagen_url
    }
  };
}

async function obtenerAsignacionHoy(currentUser) {
  return resolverAsignacionParaFecha(currentUser, hoyIso());
}

// Ruta asignada para el dia siguiente -- permite que el conductor prepare la
// inspeccion del vehiculo la tarde/noche anterior (ver home.js, tarjeta
// "Prepara tu inspeccion de mañana").
async function obtenerAsignacionManana(currentUser) {
  return resolverAsignacionParaFecha(currentUser, mananaIso());
}

// Viajes recientes de toda la empresa (todos los conductores), para el rol
// que no es Conductor dentro de "Mi ultimo viaje" -- ver mi-viaje.js. Con
// filtros de fecha, ademas alimenta el exportable PDF/Excel de esa misma
// pantalla (mi-viaje-export.js), por eso cada viaje trae tambien el detalle
// item por item de su preoperacional e inspeccion preventiva (no solo si se
// hizo o no).
async function listarRecientesEmpresa(empresaId, { fechaDesde, fechaHasta, conductorId, placa } = {}) {
  const viajes = await viajesRepository.findRecientesPorEmpresa(empresaId, { fechaDesde, fechaHasta, conductorId, placa });
  return viajes.map((viaje) => {
    const preoperacionalItems = viaje.preoperacional_items || [];
    const inspeccionItems = viaje.inspeccion_items || [];

    return {
      ...toSafeViaje(viaje),
      preoperacional_realizado: viaje.preoperacional_id !== null && viaje.preoperacional_id !== undefined,
      preoperacional_fecha: viaje.preoperacional_fecha || null,
      preoperacional_observaciones: viaje.preoperacional_observaciones || null,
      preoperacional_items: preoperacionalItems,
      preoperacional_items_mal: preoperacionalItems.filter((item) => item.respuesta === "no").length,
      inspeccion_realizada: viaje.inspeccion_id !== null && viaje.inspeccion_id !== undefined,
      inspeccion_fecha: viaje.inspeccion_fecha || null,
      inspeccion_observaciones: viaje.inspeccion_observaciones || null,
      inspeccion_items: inspeccionItems,
      inspeccion_items_mal: inspeccionItems.filter((item) => item.estado === "mal").length
    };
  });
}

// ── Resumen del dia (boton "Resumen del dia" de Viajes recientes) ──────────
//
// Agrupa los hallazgos de la jornada por TIPO (no item por item) para
// responder "que esta fallando" sin abrir viaje por viaje. Un hallazgo es un
// item de la inspeccion preventiva en estado "mal" o una pregunta del
// preoperacional respondida "no" (ver los catalogos en inspecciones.service.js
// y preoperacionales.service.js). Severidad: "critica" = impide operar
// (llantas, luces, liquidos, condicion del conductor); "atencion" = hay que
// resolverlo pero no detiene el vehiculo (kit, equipo, documentacion, etc.).
const GRUPOS_HALLAZGO = {
  llantas: { tipo: "Llantas", corto: "llantas", severidad: "critica" },
  luces: { tipo: "Luces", corto: "luces", severidad: "critica" },
  liquidos: { tipo: "Nivel de líquidos", corto: "líquidos", severidad: "critica" },
  conductor: { tipo: "Condición del conductor", corto: "conductor", severidad: "critica" },
  kit: { tipo: "Kit de herramientas", corto: "kit", severidad: "atencion" },
  extintor: { tipo: "Extintor", corto: "extintor", severidad: "atencion" },
  botiquin: { tipo: "Botiquín", corto: "botiquín", severidad: "atencion" },
  documentacion: { tipo: "Documentación", corto: "documentos", severidad: "atencion" },
  ruta: { tipo: "Conocimiento de la ruta", corto: "ruta", severidad: "atencion" },
  comunicacion: { tipo: "Celular cargado", corto: "celular", severidad: "atencion" },
  limpieza: { tipo: "Limpieza y orden", corto: "limpieza", severidad: "atencion" }
};

const GRUPO_POR_CODIGO_INSPECCION = {
  aceite: "liquidos",
  luces: "luces",
  luces_traseras: "luces",
  extintor: "extintor",
  botiquin: "botiquin"
};

const GRUPO_POR_CODIGO_PREOPERACIONAL = {
  descanso: "conductor",
  libre_sustancias: "conductor",
  estado_salud: "conductor",
  licencia_conduccion: "documentacion",
  cedula: "documentacion",
  soat: "documentacion",
  rtm: "documentacion",
  conoce_ruta: "ruta",
  celular_cargado: "comunicacion",
  limpieza_orden: "limpieza"
};

const FECHA_ISO_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function sumarDias(fechaIso, dias) {
  const fecha = new Date(`${fechaIso}T00:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

function diasEntre(desde, hasta) {
  return Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86400000);
}

// Sin filtro de fecha el resumen es el de HOY (calendario de Bogota). Con
// solo "Desde" va hasta hoy; con solo "Hasta" se toma ese unico dia -- un
// resumen "desde siempre" no tiene sentido para esta vista.
function resolverRangoResumen({ fechaDesde, fechaHasta }) {
  [fechaDesde, fechaHasta].forEach((fecha) => {
    if (fecha && !FECHA_ISO_REGEX.test(fecha)) {
      throw new HttpError(400, "Formato de fecha inválido (se espera AAAA-MM-DD)");
    }
  });

  const hoy = hoyIso();
  const desde = fechaDesde || fechaHasta || hoy;
  const hasta = fechaHasta || (desde > hoy ? desde : hoy);
  if (desde > hasta) {
    throw new HttpError(400, "La fecha 'Desde' no puede ser posterior a 'Hasta'");
  }
  return { desde, hasta };
}

// Item de un catalogo que ya no existe (o de datos viejos sin codigo): se
// agrupa solo, con su propio texto, en vez de perderse.
function grupoFueraDeCatalogo(fuente, item) {
  const etiqueta = item.item_label || item.item_codigo || "Otro";
  return { clave: `${fuente}:${item.item_codigo || etiqueta}`, tipo: etiqueta, corto: etiqueta.toLowerCase(), severidad: "atencion" };
}

function grupoDeInspeccion(item) {
  const codigo = String(item.item_codigo || "");
  const clave = codigo.startsWith("llanta_")
    ? "llantas"
    : codigo.startsWith("kit_")
      ? "kit"
      : GRUPO_POR_CODIGO_INSPECCION[codigo];
  return clave ? { clave, ...GRUPOS_HALLAZGO[clave] } : grupoFueraDeCatalogo("inspeccion", item);
}

function grupoDePreoperacional(item) {
  const clave = GRUPO_POR_CODIGO_PREOPERACIONAL[String(item.item_codigo || "")];
  return clave ? { clave, ...GRUPOS_HALLAZGO[clave] } : grupoFueraDeCatalogo("preoperacional", item);
}

// Un mismo item malo reportado en dos viajes del mismo vehiculo dentro del
// rango cuenta UNA vez (es el mismo problema, no dos) -- por eso los
// hallazgos se indexan por vehiculo + item, no por viaje.
function consolidarViajes(viajes) {
  const vehiculos = new Map();
  const conductores = new Set();
  const viajesSinPreoperacional = [];
  let preoperacionalesHechos = 0;

  for (const viaje of viajes) {
    if (viaje.usuario_id !== null && viaje.usuario_id !== undefined) conductores.add(String(viaje.usuario_id));

    const tienePreoperacional = viaje.preoperacional_id !== null && viaje.preoperacional_id !== undefined;
    const tieneInspeccion = viaje.inspeccion_id !== null && viaje.inspeccion_id !== undefined;
    if (tienePreoperacional) {
      preoperacionalesHechos += 1;
    } else {
      viajesSinPreoperacional.push(viaje.id);
    }

    const vehiculoKey = String(viaje.vehiculo_id);
    if (!vehiculos.has(vehiculoKey)) {
      vehiculos.set(vehiculoKey, { vehiculoId: viaje.vehiculo_id, placa: viaje.vehiculo_placa || null, conRegistro: false, hallazgos: new Map() });
    }
    const vehiculo = vehiculos.get(vehiculoKey);
    if (tienePreoperacional || tieneInspeccion) vehiculo.conRegistro = true;

    (viaje.inspeccion_items || [])
      .filter((item) => item.estado === "mal")
      .forEach((item) => vehiculo.hallazgos.set(`inspeccion:${item.item_codigo || item.item_label}`, grupoDeInspeccion(item)));

    (viaje.preoperacional_items || [])
      .filter((item) => item.respuesta === "no")
      .forEach((item) => vehiculo.hallazgos.set(`preoperacional:${item.item_codigo || item.item_label}`, grupoDePreoperacional(item)));
  }

  const porTipo = new Map();
  const afectados = [];

  for (const vehiculo of vehiculos.values()) {
    if (!vehiculo.hallazgos.size) continue;

    const gruposVehiculo = new Map();
    for (const grupo of vehiculo.hallazgos.values()) {
      const actual = gruposVehiculo.get(grupo.clave) || { ...grupo, cantidad: 0 };
      actual.cantidad += 1;
      gruposVehiculo.set(grupo.clave, actual);

      const tipo = porTipo.get(grupo.clave) || { ...grupo, vehiculos: new Set(), hallazgos: 0 };
      tipo.vehiculos.add(String(vehiculo.vehiculoId));
      tipo.hallazgos += 1;
      porTipo.set(grupo.clave, tipo);
    }

    const grupos = [...gruposVehiculo.values()].sort((a, b) =>
      (a.severidad === "critica" ? 0 : 1) - (b.severidad === "critica" ? 0 : 1) || b.cantidad - a.cantidad
    );

    afectados.push({
      vehiculoId: vehiculo.vehiculoId,
      placa: vehiculo.placa,
      tipos: grupos.map((grupo) => grupo.corto),
      total: vehiculo.hallazgos.size,
      severidad: grupos.some((grupo) => grupo.severidad === "critica") ? "critica" : "atencion",
      kitIncompleto: gruposVehiculo.has("kit")
    });
  }

  afectados.sort((a, b) => b.total - a.total || String(a.placa || "").localeCompare(String(b.placa || "")));

  const hallazgosPorTipo = [...porTipo.values()]
    .map((tipo) => ({
      codigo: tipo.clave,
      tipo: tipo.tipo,
      corto: tipo.corto,
      severidad: tipo.severidad,
      vehiculos: tipo.vehiculos.size,
      hallazgos: tipo.hallazgos
    }))
    .sort((a, b) =>
      b.vehiculos - a.vehiculos ||
      b.hallazgos - a.hallazgos ||
      (a.severidad === "critica" ? 0 : 1) - (b.severidad === "critica" ? 0 : 1) ||
      a.tipo.localeCompare(b.tipo)
    );

  const listaVehiculos = [...vehiculos.values()];
  const sinNovedad = listaVehiculos.filter((vehiculo) => vehiculo.conRegistro && !vehiculo.hallazgos.size);
  const kitIncompleto = afectados.filter((vehiculo) => vehiculo.kitIncompleto);

  return {
    totales: {
      viajes: viajes.length,
      conductores: conductores.size,
      preoperacionalesHechos,
      preoperacionalesEsperados: viajes.length,
      hallazgos: afectados.reduce((total, vehiculo) => total + vehiculo.total, 0),
      vehiculos: listaVehiculos.length,
      vehiculosConHallazgos: afectados.length,
      vehiculosKitIncompleto: kitIncompleto.length,
      vehiculosSinNovedad: sinNovedad.length,
      // Viajes sin inspeccion NI preoperacional: no son "sin novedad" (no
      // hay con que afirmarlo) ni tienen hallazgos -- se reportan aparte.
      vehiculosSinRegistro: listaVehiculos.filter((vehiculo) => !vehiculo.conRegistro).length
    },
    hallazgosPorTipo,
    vehiculosAfectados: afectados,
    // Ids para que cada metrica del panel filtre la lista de viajes.
    filtros: {
      conHallazgos: afectados.map((vehiculo) => vehiculo.vehiculoId),
      kitIncompleto: kitIncompleto.map((vehiculo) => vehiculo.vehiculoId),
      sinNovedad: sinNovedad.map((vehiculo) => vehiculo.vehiculoId),
      sinPreoperacional: viajesSinPreoperacional
    }
  };
}

// Consolidado de la jornada (o del rango filtrado) para Administrador/
// Operador. Respeta tambien los filtros de conductor/placa activos en la
// pantalla, y compara contra el periodo inmediatamente anterior de la misma
// duracion (ayer, si el rango es un solo dia).
async function obtenerResumenDia(empresaId, currentUser, { fechaDesde, fechaHasta, conductorId, placa } = {}) {
  if (currentUser?.rol === "Conductor") {
    throw new HttpError(403, "No tienes permiso para ver el resumen de la empresa");
  }

  const { desde, hasta } = resolverRangoResumen({ fechaDesde, fechaHasta });
  const anteriorHasta = sumarDias(desde, -1);
  const anteriorDesde = sumarDias(anteriorHasta, -diasEntre(desde, hasta));

  const [viajes, viajesAnteriores, asignaciones] = await Promise.all([
    viajesRepository.findRecientesPorEmpresa(empresaId, { fechaDesde: desde, fechaHasta: hasta, conductorId, placa }),
    viajesRepository.findRecientesPorEmpresa(empresaId, { fechaDesde: anteriorDesde, fechaHasta: anteriorHasta, conductorId, placa }),
    asignacionesRepository.findConPreoperacionalPorRango(empresaId, { fechaDesde: desde, fechaHasta: hasta, conductorUsuarioId: conductorId, placa })
  ]);

  const actual = consolidarViajes(viajes);
  const anterior = consolidarViajes(viajesAnteriores);

  // El "esperado" de preoperacionales es lo que se programo en Asignacion de
  // rutas para el rango, no los viajes que alcanzaron a iniciarse (un
  // conductor que nunca arranco tambien debe contar como faltante). Sin
  // asignaciones cargadas no hay contra que comparar: esperados queda null
  // y "hechos" cae a los viajes con preoperacional.
  if (asignaciones.length) {
    const pendientes = asignaciones.filter((asignacion) => !asignacion.preoperacional_realizado);
    actual.totales.preoperacionalesEsperados = asignaciones.length;
    actual.totales.preoperacionalesHechos = asignaciones.length - pendientes.length;
    actual.asignacionesPendientes = pendientes.map((asignacion) => ({
      asignacionId: asignacion.id,
      fecha: asignacion.fecha,
      placa: asignacion.vehiculo_placa || null,
      conductorNombres: asignacion.conductor_nombres || null,
      conductorApellidos: asignacion.conductor_apellidos || null,
      ruta: asignacion.ruta_nombre || null
    }));
  } else {
    actual.totales.preoperacionalesEsperados = null;
    actual.asignacionesPendientes = [];
  }

  return {
    rango: { desde, hasta, esHoy: desde === hasta && hasta === hoyIso() },
    ...actual,
    periodoAnterior: {
      desde: anteriorDesde,
      hasta: anteriorHasta,
      viajes: anterior.totales.viajes,
      hallazgos: anterior.totales.hallazgos,
      vehiculos: anterior.totales.vehiculosConHallazgos
    }
  };
}

async function listarConductoresConViajes(empresaId) {
  return viajesRepository.findConductoresConViajes(empresaId);
}

// Resumen de un viaje puntual para el drawer de "Viajes recientes"
// (Administrador/Operador): vehiculo, conductor, documentos vigentes e
// inspeccion preventiva (si el conductor la lleno al iniciar el viaje). Todo
// en una sola consulta para no forzar al usuario a salir a la hoja de vida
// del vehiculo solo para ver este detalle. Un Conductor tambien puede pedir
// este resumen (para revisar sus propios viajes en "Mi ultimo viaje"), pero
// solo del suyo -- trips.view por si solo no distingue de quien es el viaje,
// asi que la restriccion de dueño se hace aca.
async function obtenerResumen(viajeId, currentUser) {
  const viaje = await viajesRepository.findById(viajeId, currentUser.empresa_id);
  if (!viaje) {
    throw new HttpError(404, "Viaje no encontrado");
  }
  if (currentUser.rol === "Conductor" && String(viaje.usuario_id) !== String(currentUser.id)) {
    throw new HttpError(403, "No tienes permiso para ver este viaje");
  }

  const empresaId = currentUser.empresa_id;
  const [vehiculo, documentos, conductor, usuarioConductor, inspeccion, preoperacional] = await Promise.all([
    vehiculosRepository.findById(viaje.vehiculo_id, empresaId),
    documentosRepository.findByVehicle(viaje.vehiculo_id, empresaId),
    conductoresRepository.findByUsuarioId(viaje.usuario_id, empresaId),
    usuariosRepository.findById(viaje.usuario_id, empresaId),
    inspeccionesRepository.findByViajeId(viajeId, empresaId),
    preoperacionalesRepository.findByViajeId(viajeId, empresaId)
  ]);

  const itemsInspeccion = inspeccion ? await itemsRepository.findByInspeccion(inspeccion.id, empresaId) : [];
  const itemsPreoperacional = preoperacional
    ? await preoperacionalItemsRepository.findByPreoperacional(preoperacional.id, empresaId)
    : [];
  const licencias = conductor
    ? await conductorLicenciasRepository.findByConductor(conductor.id, empresaId)
    : [];

  return {
    viaje: toSafeViaje({
      ...viaje,
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
          imagen_url: vehiculo.imagen_url
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
          foto_url: usuarioConductor?.foto_url || null,
          foto_posicion: usuarioConductor?.foto_posicion || "50% 50%",
          licencias: licencias.map((licencia) => ({
            categoria: licencia.categoria,
            fecha_vencimiento: licencia.fecha_vencimiento
          }))
        }
      : null,
    inspeccion: inspeccion
      ? {
          id: inspeccion.id,
          fecha: inspeccion.fecha,
          observaciones: inspeccion.observaciones,
          total_items: itemsInspeccion.length,
          total_items_mal: itemsInspeccion.filter((item) => item.estado === "mal").length,
          items: itemsInspeccion.map((item) => ({
            item_label: item.item_label,
            estado: item.estado,
            comentario: item.comentario,
            foto_url: item.foto_url
          }))
        }
      : null,
    preoperacional: preoperacional
      ? {
          id: preoperacional.id,
          fecha: preoperacional.fecha,
          observaciones: preoperacional.observaciones,
          total_items: itemsPreoperacional.length,
          total_items_no: itemsPreoperacional.filter((item) => item.respuesta === "no").length,
          items: itemsPreoperacional.map((item) => ({
            item_label: item.item_label,
            respuesta: item.respuesta,
            observacion: item.observacion
          }))
        }
      : null
  };
}

// Hilo de comentarios de un viaje, en solo lectura para quien lo pide --
// escribir sigue yendo por /notificaciones/referencia/viaje/:id/comentarios
// (permiso notificaciones.comentar, Administrador/Operador). Reutiliza la
// misma tabla generica por referencia_tipo/referencia_id, con la misma
// restriccion de dueño que obtenerResumen para que un Conductor solo vea el
// hilo de sus propios viajes.
async function listarComentariosViaje(viajeId, currentUser) {
  const viaje = await viajesRepository.findById(viajeId, currentUser.empresa_id);
  if (!viaje) {
    throw new HttpError(404, "Viaje no encontrado");
  }
  if (currentUser.rol === "Conductor" && String(viaje.usuario_id) !== String(currentUser.id)) {
    throw new HttpError(403, "No tienes permiso para ver este viaje");
  }

  return notificacionComentariosRepository.findByReferencia("viaje", viajeId, currentUser.empresa_id);
}

// Solo Administrador (permiso trips.delete) -- ver "Viajes recientes" en
// Mi último viaje. No hace falta revertir nada mas: inspecciones_preventivas
// y preoperacionales asociados quedan huerfanos de viaje (ON DELETE SET
// NULL, ver viajes.repository.js#remove) en vez de borrarse, para no perder
// esos registros.
async function eliminar(id, currentUser) {
  const viaje = await viajesRepository.findById(id, currentUser.empresa_id);
  if (!viaje) {
    throw new HttpError(404, "Viaje no encontrado");
  }

  await viajesRepository.remove(id, currentUser.empresa_id);
}

module.exports = {
  crear,
  listarRecientes,
  listarPorVehiculo,
  listarRecientesEmpresa,
  obtenerResumenDia,
  listarConductoresConViajes,
  obtenerUltimoViajeControl,
  obtenerAsignacionHoy,
  obtenerAsignacionManana,
  obtenerResumen,
  listarComentariosViaje,
  eliminar
};
