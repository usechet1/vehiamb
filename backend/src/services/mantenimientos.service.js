const HttpError = require("../errors/http-error");
const db = require("../database/query");
const mantenimientosRepository = require("../repositories/mantenimientos.repository");
const vehiculosRepository = require("../repositories/vehiculos.repository");
const repuestosRepository = require("../repositories/repuestos.repository");
const repuestosStockRepository = require("../repositories/repuestos-stock.repository");
const configuracionInventarioRepository = require("../repositories/configuracion-inventario.repository");
const notificacionesService = require("./notificaciones.service");

const TIPOS_VALIDOS = new Set([
  "revision",
  "preventivo",
  "correctivo",
  "cambio_aceite",
  "llantas",
  "frenos",
  "otro"
]);

const TIPOS_QUE_REQUIEREN_APROBACION = new Set(["correctivo"]);
const UMBRAL_APROBACION_VALOR = Number(process.env.MAINTENANCE_APPROVAL_THRESHOLD || 500000);

function toBoolean(value) {
  return value === true || value === "true" || value === "on" || value === "1" || value === 1;
}

function toNumberOrNull(value) {
  if (value === undefined || value === null || value === "") return null;
  let cleanValue = value;
  if (typeof value == "string") {
    cleanValue = value.replace(",", "."); 
  }
  const parsed = Number(cleanValue);
  return Number.isFinite(parsed) ? parsed : null;
}

// El formulario envia esto por separado del "repuestos" JSON legado (que no
// se toca): cada item trae el repuesto del catalogo elegido, la cantidad y,
// si el usuario sustituyo el sugerido original por una equivalencia, cual
// era ese sugerido y por que.
function parseRepuestosEstructurados(raw) {
  if (!raw) return [];

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return [];
  }

  if (!Array.isArray(parsed)) return [];

  return parsed
    .map((item) => ({
      repuesto_id: toNumberOrNull(item?.repuesto_id),
      repuesto_sugerido_id: toNumberOrNull(item?.repuesto_sugerido_id),
      motivo_sustitucion: item?.motivo_sustitucion ? String(item.motivo_sustitucion).trim() : null,
      cantidad: toNumberOrNull(item?.cantidad) > 0 ? toNumberOrNull(item.cantidad) : 1
    }))
    .filter((item) => item.repuesto_id);
}

function sumRepuestos(repuestosJson) {
  if (!repuestosJson) return 0;

  let repuestos;
  try {
    repuestos = JSON.parse(repuestosJson);
  } catch (error) {
    return 0;
  }

  if (!Array.isArray(repuestos)) return 0;

  return repuestos.reduce((sum, item) => sum + (toNumberOrNull(item?.valor) ?? 0), 0);
}

function normalizePayload(payload) {
  const repuestos = payload.repuestos ? String(payload.repuestos).trim() : null;
  const valorManoObra = toNumberOrNull(payload.valor_mano_obra) ?? 0;
  const totalRepuestos = sumRepuestos(repuestos);

  return {
    vehiculo_id: toNumberOrNull(payload.vehiculo_id),
    fecha: String(payload.fecha || "").trim(),
    tipo: String(payload.tipo || "").trim(),
    descripcion: payload.descripcion ? String(payload.descripcion).trim() : null,
    autorizado_por: payload.autorizado_por ? String(payload.autorizado_por).trim() : null,
    hecho_por: payload.hecho_por ? String(payload.hecho_por).trim() : null,
    repuestos,
    soporte_url: payload.soporte_url ? String(payload.soporte_url).trim() : null,
    soporte_nombre: payload.soporte_nombre ? String(payload.soporte_nombre).trim() : null,
    soporte_mime: payload.soporte_mime ? String(payload.soporte_mime).trim() : null,
    valor_mano_obra: valorManoObra,
    valor: valorManoObra + totalRepuestos,
    kilometraje: toNumberOrNull(payload.kilometraje),
    proximo_cambio_km: toNumberOrNull(payload.proximo_cambio_km),
    proximo_cambio_fecha: payload.proximo_cambio_fecha ? String(payload.proximo_cambio_fecha).trim() : null,
    creado_por_usuario_id: toNumberOrNull(payload.creado_por_usuario_id),
    vehiculo_varado: toBoolean(payload.vehiculo_varado)
  };
}

async function validateMantenimiento(mantenimiento, vehiculo) {
  if (!mantenimiento.vehiculo_id || !mantenimiento.fecha || !mantenimiento.tipo) {
    throw new HttpError(400, "Vehiculo, fecha y tipo son obligatorios");
  }

  if (!TIPOS_VALIDOS.has(mantenimiento.tipo)) {
    throw new HttpError(400, "Tipo de mantenimiento no valido");
  }

  if (mantenimiento.valor_mano_obra < 0) {
    throw new HttpError(400, "El valor de la mano de obra no puede ser negativo");
  }

  if (mantenimiento.kilometraje !== null && mantenimiento.kilometraje < 0) {
    throw new HttpError(400, "El kilometraje no puede ser negativo");
  }

  if (mantenimiento.tipo === "cambio_aceite") {
    if (mantenimiento.proximo_cambio_km === null || mantenimiento.proximo_cambio_km < 0) {
      throw new HttpError(400, "El proximo cambio de aceite (km) es obligatorio");
    }

    if (!mantenimiento.proximo_cambio_fecha) {
      throw new HttpError(400, "La proxima fecha de cambio de aceite es obligatoria");
    }
  }

  const kilometrajeActual = Number(vehiculo.kilometraje_actual || 0);
  if (mantenimiento.kilometraje !== null && mantenimiento.kilometraje < kilometrajeActual) {
    await notificacionesService.notificarIncoherenciaKilometraje({
      vehiculo,
      kilometrajeIntentado: mantenimiento.kilometraje
    });

    throw new HttpError(
      400,
      `El kilometraje debe ser mayor o igual al actual del vehiculo (${kilometrajeActual} km)`
    );
  }
}

async function listMantenimientos(filters = {}) {
  const tipo = filters.tipo && TIPOS_VALIDOS.has(filters.tipo) ? filters.tipo : null;

  return mantenimientosRepository.findAll({
    tipo,
    placa: filters.placa ? String(filters.placa).trim() : null,
    fechaDesde: filters.fecha_desde ? String(filters.fecha_desde).trim() : null,
    fechaHasta: filters.fecha_hasta ? String(filters.fecha_hasta).trim() : null
  });
}

async function listMantenimientosByVehicle(vehiculoId) {
  return mantenimientosRepository.findByVehicle(vehiculoId);
}

async function getRepuestosEstructurados(mantenimientoId) {
  return mantenimientosRepository.findRepuestosEstructurados(mantenimientoId);
}

async function getMantenimiento(id) {
  const mantenimiento = await mantenimientosRepository.findByIdWithVehiculo(id);
  if (!mantenimiento) {
    throw new HttpError(404, "Mantenimiento no encontrado");
  }
  return mantenimiento;
}

/**
 * Descuenta stock, registra el movimiento y el detalle normalizado para cada
 * repuesto del catalogo usado en el mantenimiento -- todo dentro de la misma
 * transaccion que crea el mantenimiento (atomico: si algo falla, no queda
 * stock descontado sin mantenimiento, ni mantenimiento sin su descuento).
 * Nunca bloquea por stock insuficiente salvo que
 * configuracion_inventario.stock_insuficiente_bloquea = 'true' (hoy siempre
 * 'false' -- solo se acumulan advertencias).
 */
async function consumirRepuestos(mantenimientoId, repuestosEstructurados, currentUser, trx) {
  const advertencias = [];
  const bodega = await repuestosStockRepository.findBodegaPrincipal(trx);
  const bloquear = await configuracionInventarioRepository.getBooleano("stock_insuficiente_bloquea", false);

  for (const item of repuestosEstructurados) {
    const repuesto = await repuestosRepository.findById(item.repuesto_id);
    if (!repuesto) continue; // el catalogo pudo cambiar entre que el usuario armo el formulario y guardo

    const stockRow = await repuestosStockRepository.findByRepuestoIdForUpdate(item.repuesto_id, bodega.id, trx);
    const stockFisicoActual = Number(stockRow?.stock_fisico ?? 0);
    const stockDisponible = stockFisicoActual - Number(stockRow?.stock_comprometido ?? 0);

    if (stockDisponible < item.cantidad) {
      const mensaje = `Stock insuficiente para "${repuesto.nombre}": disponible ${stockDisponible}, solicitado ${item.cantidad}`;

      if (bloquear) {
        throw new HttpError(400, mensaje);
      }

      advertencias.push(mensaje);
    }

    await repuestosStockRepository.decrementarStock(item.repuesto_id, bodega.id, item.cantidad, trx);

    await repuestosStockRepository.insertMovimiento(
      {
        repuestoId: item.repuesto_id,
        bodegaId: bodega.id,
        tipoMovimiento: "salida",
        cantidad: -item.cantidad,
        stockResultante: stockFisicoActual - item.cantidad,
        motivo: `Consumo en mantenimiento #${mantenimientoId}`,
        referenciaTipo: "mantenimiento",
        referenciaId: mantenimientoId,
        usuarioId: currentUser?.id ?? null
      },
      trx
    );

    const valorUnitario = Number(repuesto.valor_promedio || 0);

    await mantenimientosRepository.createRepuestoDetalle(
      mantenimientoId,
      {
        repuesto_id: item.repuesto_id,
        repuesto_sugerido_id: item.repuesto_sugerido_id,
        motivo_sustitucion: item.motivo_sustitucion,
        cantidad: item.cantidad,
        valor_unitario: valorUnitario,
        valor_total: valorUnitario * item.cantidad
      },
      trx
    );
  }

  return advertencias;
}

async function createMantenimiento(payload, file, currentUser) {
  const mantenimiento = normalizePayload({
    ...payload,
    creado_por_usuario_id: currentUser?.id ?? null,
    soporte_url: file ? `/uploads/mantenimientos/${file.filename}` : null,
    soporte_nombre: file?.originalname || null,
    soporte_mime: file?.mimetype || null
  });

  const repuestosEstructurados = parseRepuestosEstructurados(payload.repuestos_estructurados);

  const vehiculo = await vehiculosRepository.findById(mantenimiento.vehiculo_id);
  if (!vehiculo) {
    throw new HttpError(404, "Vehiculo no encontrado");
  }

  await validateMantenimiento(mantenimiento, vehiculo);

  const requiereAprobacion =
    TIPOS_QUE_REQUIEREN_APROBACION.has(mantenimiento.tipo) || mantenimiento.valor > UMBRAL_APROBACION_VALOR;
  mantenimiento.estado = requiereAprobacion ? "pendiente" : "completado";

  let advertenciasStock = [];

  const creado = await db.withTransaction(async (trx) => {
    const mantenimientoCreado = await mantenimientosRepository.create(mantenimiento, trx);

    if (repuestosEstructurados.length) {
      advertenciasStock = await consumirRepuestos(mantenimientoCreado.id, repuestosEstructurados, currentUser, trx);
    }

    return mantenimientoCreado;
  });

  await notificacionesService.evaluarNotificacionesMantenimiento({
    mantenimiento: creado,
    vehiculo,
    requiereAprobacion
  });

  return { ...creado, advertenciasStock };
}

module.exports = {
  listMantenimientos,
  listMantenimientosByVehicle,
  getRepuestosEstructurados,
  getMantenimiento,
  createMantenimiento
};
