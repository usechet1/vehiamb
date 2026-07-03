const HttpError = require("../errors/http-error");
const db = require("../database/query");
const simitConsultasRepository = require("../repositories/simit-consultas.repository");
const simitComparendosRepository = require("../repositories/simit-comparendos.repository");
const vehiculosRepository = require("../repositories/vehiculos.repository");
const notificacionesService = require("../services/notificaciones.service");
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

async function notificarNovedades({ vehiculo, consulta, nuevos, cambiosEstado }) {
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

  await notificacionesService.notificarUsuariosConPermiso(DESTINATARIO_PERMISSION, {
    tipo: nuevos.length ? "simit_multa_detectada" : "simit_estado_cambiado",
    mensaje: `SIMIT: el vehiculo ${vehiculoLabel} tiene novedades - ${partes.join(", ")}.`,
    vehiculo_id: vehiculo.id,
    referencia_tipo: "simit_consulta",
    referencia_id: consulta.id,
    accion: { tipo: "ver_simit", payload: { vehiculo_id: vehiculo.id } }
  });
}

async function notificarFallo({ vehiculo, consulta }) {
  // referencia_tipo propio ("simit_consulta_fallo") para no compartir el
  // deduplicador con otras notificaciones que tambien usan referencia_tipo
  // "vehiculo" (ej. vehiculo_fuera_servicio, kilometraje_incoherente).
  const yaNotificado = await notificacionesService.existsRecentByReferencia(
    "simit_consulta_fallo",
    vehiculo.id,
    HORAS_SIN_DUPLICAR_FALLO
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
  });
}

async function consultarVehiculo(vehiculoId, { origen = "manual" } = {}) {
  const vehiculo = await vehiculosRepository.findById(vehiculoId);
  if (!vehiculo) {
    throw new HttpError(404, "Vehiculo no encontrado");
  }

  if (!vehiculo.placa) {
    throw new HttpError(400, "El vehiculo no tiene placa registrada");
  }

  const resultado = await simitScraper.scrapePlaca(vehiculo.placa);

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
        resultado_raw: JSON.stringify(resultado.comparendos || [])
      },
      dbTx
    );

    const comparendosCreados = await simitComparendosRepository.bulkCreate(
      consultaCreada.id,
      vehiculo.id,
      resultado.comparendos || [],
      dbTx
    );

    return { consulta: consultaCreada, comparendos: comparendosCreados };
  });

  if (consulta.estado_consulta !== "ok") {
    await notificarFallo({ vehiculo, consulta }).catch((error) => {
      console.error("No fue posible notificar el fallo de consulta SIMIT:", error.message);
    });

    return { ...consulta, comparendos };
  }

  const anterior = await simitConsultasRepository.findAnteriorByVehiculo(vehiculo.id, consulta.id);
  const comparendosAnteriores = anterior ? await simitComparendosRepository.findByConsulta(anterior.id) : [];
  const { nuevos, cambiosEstado } = compararComparendos(comparendosAnteriores, comparendos);

  await notificarNovedades({ vehiculo, consulta, nuevos, cambiosEstado }).catch((error) => {
    console.error("No fue posible notificar novedades de SIMIT:", error.message);
  });

  return { ...consulta, comparendos, novedades: { nuevos: nuevos.length, cambiosEstado: cambiosEstado.length } };
}

async function actualizarFlota() {
  const vehiculos = (await vehiculosRepository.findAllSimple()).filter((vehiculo) => vehiculo.placa);

  const resumen = { total: vehiculos.length, ok: 0, con_novedades: 0, error: 0, bloqueado: 0 };

  for (const vehiculo of vehiculos) {
    try {
      const resultado = await consultarVehiculo(vehiculo.id, { origen: "masivo" });

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

async function listarEstadoFlota(filters = {}) {
  return simitConsultasRepository.findUltimoEstadoPorFlota(filters);
}

async function listarHistorialVehiculo(vehiculoId) {
  const vehiculo = await vehiculosRepository.findById(vehiculoId);
  if (!vehiculo) {
    throw new HttpError(404, "Vehiculo no encontrado");
  }

  return simitConsultasRepository.findByVehiculo(vehiculoId);
}

async function obtenerConsultaDetalle(consultaId) {
  const consulta = await simitConsultasRepository.findById(consultaId);
  if (!consulta) {
    throw new HttpError(404, "Consulta SIMIT no encontrada");
  }

  const comparendos = await simitComparendosRepository.findByConsulta(consultaId);
  return { ...consulta, comparendos };
}

module.exports = {
  consultarVehiculo,
  actualizarFlota,
  listarEstadoFlota,
  listarHistorialVehiculo,
  obtenerConsultaDetalle
};
