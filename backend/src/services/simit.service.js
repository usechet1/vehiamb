const HttpError = require("../errors/http-error");
const db = require("../database/query");
const simitConsultasRepository = require("../repositories/simit-consultas.repository");
const simitComparendosRepository = require("../repositories/simit-comparendos.repository");
const vehiculosRepository = require("../repositories/vehiculos.repository");
const conductoresRepository = require("../repositories/conductores.repository");
const notificacionesService = require("../services/notificaciones.service");
const comparendoMatcher = require("./comparendo-conductor-matcher");
const simitScraper = require("../scrapers/simit/simit-scraper");
const scraperConfig = require("../scrapers/simit/simit-scraper.config");

const DESTINATARIO_PERMISSION = "simit.view";
const HORAS_SIN_DUPLICAR_FALLO = 24;
const BULK_DELAY_MS = scraperConfig.BULK_DELAY_MS;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatCurrency(value) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

// Compara los comparendos de la consulta recien guardada contra los de la
// consulta inmediatamente anterior del mismo vehiculo, usando numero_comparendo
// como llave. Devuelve los comparendos que aparecen por primera vez y los que
// ya existian pero cambiaron de estado (ej. paso de pendiente a cobro coactivo).
function compararComparendos(anteriores, actuales) {
  const mapaAnteriores = new Map(anteriores.map((item) => [item.numero_comparendo, item]));

  const nuevos = actuales.filter((item) => !mapaAnteriores.has(item.numero_comparendo));
  const cambiosEstado = actuales.filter((item) => {
    const previo = mapaAnteriores.get(item.numero_comparendo);
    return previo && previo.estado !== item.estado;
  });

  return { nuevos, cambiosEstado };
}

async function notificarNovedades({ vehiculo, consulta, nuevos, cambiosEstado, empresaId }) {
  if (!nuevos.length && !cambiosEstado.length) return;

  const vehiculoLabel = `${vehiculo.marca} ${vehiculo.modelo} (${vehiculo.placa})`;
  const partes = [];

  if (nuevos.length) {
    const valorNuevos = nuevos.reduce((sum, item) => sum + Number(item.valor || 0), 0);
    partes.push(`${nuevos.length} comparendo(s) nuevo(s) por ${formatCurrency(valorNuevos)}`);
  }

  if (cambiosEstado.length) {
    partes.push(`${cambiosEstado.length} comparendo(s) cambiaron de estado`);
  }

  // Detalle de cada comparendo afectado (numero + fecha + descripcion +
  // valor) para que el canal de WhatsApp pueda listarlos en el mensaje --
  // ver notificaciones-whatsapp.channel.js construirMensajeWhatsapp().
  const detalleComparendos = [...nuevos, ...cambiosEstado].map((item) => ({
    numero_comparendo: item.numero_comparendo,
    fecha_infraccion: item.fecha_infraccion,
    descripcion: item.descripcion,
    valor: item.valor
  }));

  await notificacionesService.notificarUsuariosConPermiso(DESTINATARIO_PERMISSION, {
    tipo: nuevos.length ? "simit_multa_detectada" : "simit_estado_cambiado",
    mensaje: `SIMIT: el vehiculo ${vehiculoLabel} tiene novedades - ${partes.join(", ")}.`,
    vehiculo_id: vehiculo.id,
    referencia_tipo: "simit_consulta",
    referencia_id: consulta.id,
    accion: { tipo: "ver_simit", payload: { vehiculo_id: vehiculo.id, detalle_comparendos: detalleComparendos } }
  }, empresaId);
}

async function notificarFallo({ vehiculo, consulta, empresaId }) {
  // referencia_tipo propio ("simit_consulta_fallo") para no compartir el
  // deduplicador con otras notificaciones que tambien usan referencia_tipo
  // "vehiculo" (ej. vehiculo_fuera_servicio, kilometraje_incoherente).
  const yaNotificado = await notificacionesService.existsRecentByReferencia(
    "simit_consulta_fallo",
    vehiculo.id,
    HORAS_SIN_DUPLICAR_FALLO,
    empresaId
  );
  if (yaNotificado) return;

  const vehiculoLabel = `${vehiculo.marca} ${vehiculo.modelo} (${vehiculo.placa})`;
  const motivo = consulta.estado_consulta === "bloqueado"
    ? "el portal SIMIT presento un CAPTCHA"
    : "ocurrio un error al consultar el portal SIMIT";

  await notificacionesService.notificarUsuariosConPermiso(DESTINATARIO_PERMISSION, {
    tipo: "simit_consulta_fallo",
    mensaje: `No fue posible actualizar el estado SIMIT del vehiculo ${vehiculoLabel}: ${motivo}.`,
    vehiculo_id: vehiculo.id,
    referencia_tipo: "simit_consulta_fallo",
    referencia_id: vehiculo.id,
    accion: { tipo: "ver_simit", payload: { vehiculo_id: vehiculo.id } }
  }, empresaId);
}

async function consultarVehiculo(vehiculoId, empresaId, { origen = "manual" } = {}) {
  const vehiculo = await vehiculosRepository.findById(vehiculoId, empresaId);
  if (!vehiculo) {
    throw new HttpError(404, "Vehículo no encontrado");
  }

  if (!vehiculo.placa) {
    throw new HttpError(400, "El vehículo no tiene placa registrada");
  }

  const resultado = await simitScraper.scrapePlaca(vehiculo.placa);

  // Cruza cada comparendo nuevo contra el catalogo de conductores de la
  // empresa (ver comparendo-conductor-matcher.js): solo se vincula
  // automaticamente cuando cedula + nombre completo coinciden y el
  // candidato es unico, para no atribuirle mal una infraccion legal a
  // alguien por una coincidencia parcial.
  const conductoresEmpresa = await conductoresRepository.findAllParaMatching(empresaId);
  const comparendosConConductor = (resultado.comparendos || []).map((comparendo) => ({
    ...comparendo,
    conductor_id: comparendoMatcher.encontrarConductorCoincidente(comparendo, conductoresEmpresa)?.id || null
  }));

  const { consulta, comparendos } = await db.withTransaction(async (dbTx) => {
    const consultaCreada = await simitConsultasRepository.create(
      {
        vehiculo_id: vehiculo.id,
        placa: vehiculo.placa,
        origen,
        estado_consulta: resultado.estado_consulta,
        estado_cartera: resultado.estado_cartera,
        total_comparendos: resultado.total_comparendos,
        valor_total: resultado.valor_total,
        mensaje_error: resultado.mensaje_error,
        resultado_raw: JSON.stringify(resultado.comparendos || []),
        empresa_id: empresaId
      },
      dbTx
    );

    const comparendosCreados = await simitComparendosRepository.bulkCreate(
      consultaCreada.id,
      vehiculo.id,
      comparendosConConductor,
      empresaId,
      dbTx
    );

    return { consulta: consultaCreada, comparendos: comparendosCreados };
  });

  if (consulta.estado_consulta !== "ok") {
    await notificarFallo({ vehiculo, consulta, empresaId }).catch((error) => {
      console.error("No fue posible notificar el fallo de consulta SIMIT:", error.message);
    });

    return { ...consulta, comparendos };
  }

  const anterior = await simitConsultasRepository.findAnteriorByVehiculo(vehiculo.id, consulta.id, empresaId);
  const comparendosAnteriores = anterior ? await simitComparendosRepository.findByConsulta(anterior.id, empresaId) : [];
  const { nuevos, cambiosEstado } = compararComparendos(comparendosAnteriores, comparendos);

  await notificarNovedades({ vehiculo, consulta, nuevos, cambiosEstado, empresaId }).catch((error) => {
    console.error("No fue posible notificar novedades de SIMIT:", error.message);
  });

  return { ...consulta, comparendos, novedades: { nuevos: nuevos.length, cambiosEstado: cambiosEstado.length } };
}

// Cron/bulk: recorre TODOS los vehiculos de TODAS las empresas (findAllParaCron,
// sin scopear), usando el empresa_id propio de cada fila para la consulta y
// las notificaciones -- a diferencia de consultarVehiculo llamado desde un
// request autenticado, aqui no hay un "empresaId actual" unico. Si se pasa
// empresaId (disparo manual desde POST /api/simit/actualizar-flota), se filtra
// a solo esa empresa: un usuario autenticado no deberia poder disparar la
// actualizacion de la flota de otras empresas.
async function actualizarFlota(empresaId = null) {
  let vehiculos = (await vehiculosRepository.findAllParaCron()).filter((vehiculo) => vehiculo.placa);
  if (empresaId !== null) {
    vehiculos = vehiculos.filter((vehiculo) => String(vehiculo.empresa_id) === String(empresaId));
  }

  const resumen = { total: vehiculos.length, ok: 0, con_novedades: 0, error: 0, bloqueado: 0 };

  for (const vehiculo of vehiculos) {
    try {
      const resultado = await consultarVehiculo(vehiculo.id, vehiculo.empresa_id, { origen: "masivo" });

      if (resultado.estado_consulta === "ok") {
        resumen.ok += 1;
        if (resultado.novedades && (resultado.novedades.nuevos > 0 || resultado.novedades.cambiosEstado > 0)) {
          resumen.con_novedades += 1;
        }
      } else if (resultado.estado_consulta === "bloqueado") {
        resumen.bloqueado += 1;
      } else {
        resumen.error += 1;
      }
    } catch (error) {
      resumen.error += 1;
      console.error(`Error consultando SIMIT para el vehiculo ${vehiculo.placa}:`, error.message);
    }

    await sleep(BULK_DELAY_MS);
  }

  return resumen;
}

async function listarEstadoFlota(filters = {}, empresaId) {
  return simitConsultasRepository.findUltimoEstadoPorFlota(filters, empresaId);
}

async function obtenerValorHistorico(empresaId, dias = 30) {
  return simitConsultasRepository.sumValorTotalHaceDias(dias, empresaId);
}

// Junta, dentro de una misma cedula_infractor, las filas cuyo nombre es una
// variante compatible entre si (ver nombresCompatibles) -- ej. SIMIT
// devolviendo "MAI*** ES*** MART****" en una consulta y "MAI*** ES***
// MART**** QUI****" en otra para la misma persona. Filas con nombres
// incompatibles bajo la misma cedula (indicio de que dos personas reales
// distintas comparten el mismo prefijo de cedula enmascarado) quedan como
// grupos separados, cada una con su propio total.
function agruparInfractoresPorIdentidad(conteos) {
  const porCedula = new Map();
  conteos.forEach((fila) => {
    const lista = porCedula.get(fila.cedula_infractor) || [];
    lista.push(fila);
    porCedula.set(fila.cedula_infractor, lista);
  });

  const grupos = [];
  porCedula.forEach((filas) => {
    const pendientes = [...filas];

    while (pendientes.length) {
      const base = pendientes.shift();
      const compatibles = [base];

      for (let i = pendientes.length - 1; i >= 0; i -= 1) {
        if (comparendoMatcher.nombresCompatibles(base.nombre_infractor, pendientes[i].nombre_infractor)) {
          compatibles.push(...pendientes.splice(i, 1));
        }
      }

      const nombreRepresentativo = compatibles.reduce((mejor, actual) =>
        String(actual.nombre_infractor).length > String(mejor.nombre_infractor).length ? actual : mejor
      );

      grupos.push({
        cedula_infractor: base.cedula_infractor,
        nombre_infractor: nombreRepresentativo.nombre_infractor,
        total_comparendos: compatibles.reduce((suma, fila) => suma + Number(fila.total_comparendos), 0)
      });
    }
  });

  return grupos.sort((a, b) => b.total_comparendos - a.total_comparendos);
}

async function obtenerTopInfractores(empresaId, limite = 5) {
  const conteos = await simitComparendosRepository.findConteosInfractores(empresaId);
  return agruparInfractoresPorIdentidad(conteos).slice(0, limite);
}

async function listarHistorialVehiculo(vehiculoId, empresaId) {
  const vehiculo = await vehiculosRepository.findById(vehiculoId, empresaId);
  if (!vehiculo) {
    throw new HttpError(404, "Vehículo no encontrado");
  }

  return simitConsultasRepository.findByVehiculo(vehiculoId, empresaId);
}

async function obtenerConsultaDetalle(consultaId, empresaId) {
  const consulta = await simitConsultasRepository.findById(consultaId, empresaId);
  if (!consulta) {
    throw new HttpError(404, "Consulta SIMIT no encontrada");
  }

  const comparendos = await simitComparendosRepository.findByConsulta(consultaId, empresaId);
  return { ...consulta, comparendos };
}

module.exports = {
  consultarVehiculo,
  actualizarFlota,
  listarEstadoFlota,
  listarHistorialVehiculo,
  obtenerConsultaDetalle,
  obtenerValorHistorico,
  obtenerTopInfractores
};
