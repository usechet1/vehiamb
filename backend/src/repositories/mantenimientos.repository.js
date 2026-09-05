const db = require("../database/query");

const MANTENIMIENTO_FIELDS = [
  "vehiculo_id",
  "fecha",
  "tipo",
  "descripcion",
  "autorizado_por",
  "hecho_por",
  "repuestos",
  "soporte_url",
  "soporte_nombre",
  "soporte_mime",
  "valor",
  "valor_mano_obra",
  "kilometraje",
  "proximo_cambio_km",
  "proximo_cambio_fecha",
  "creado_por_usuario_id",
  "estado",
  "vehiculo_varado",
  "empresa_id"
];

async function findAll(filters = {}, empresaId) {
  const conditions = ["m.empresa_id = ?"];
  const values = [empresaId];

  if (filters.tipo) {
    conditions.push("m.tipo = ?");
    values.push(filters.tipo);
  }

  if (filters.placa) {
    conditions.push("v.placa = ?");
    values.push(filters.placa);
  }

  if (filters.fechaDesde) {
    conditions.push("m.fecha >= ?");
    values.push(filters.fechaDesde);
  }

  if (filters.fechaHasta) {
    conditions.push("m.fecha <= ?");
    values.push(filters.fechaHasta);
  }

  const whereClause = `WHERE ${conditions.join(" AND ")}`;

  return db.all(
    `
      SELECT
        m.*,
        v.placa,
        v.marca,
        v.modelo
      FROM mantenimientos m
      INNER JOIN vehiculos v ON v.id = m.vehiculo_id
      ${whereClause}
      ORDER BY m.fecha DESC, m.id DESC
    `,
    values
  );
}

async function findByVehicle(vehiculoId, empresaId) {
  return db.all(
    `
      SELECT *
      FROM mantenimientos
      WHERE vehiculo_id = ? AND empresa_id = ?
      ORDER BY fecha DESC, id DESC
    `,
    [vehiculoId, empresaId]
  );
}

async function findById(id, empresaId) {
  return db.get("SELECT * FROM mantenimientos WHERE id = ? AND empresa_id = ?", [id, empresaId]);
}

async function findByIdWithVehiculo(id, empresaId) {
  return db.get(
    `
      SELECT
        m.*,
        v.placa,
        v.marca,
        v.modelo,
        v.intervalo_cambio_aceite_km
      FROM mantenimientos m
      INNER JOIN vehiculos v ON v.id = m.vehiculo_id
      WHERE m.id = ? AND m.empresa_id = ?
    `,
    [id, empresaId]
  );
}

async function updateEstado(id, estado, empresaId) {
  await db.run("UPDATE mantenimientos SET estado = ? WHERE id = ? AND empresa_id = ?", [estado, id, empresaId]);
  return findByIdWithVehiculo(id, empresaId);
}

// Reevalua si el vehiculo COMO UN TODO deberia quedar marcado "en
// reparacion" (vehiculos.estado, ver vehiculo-disponibilidad.service.js) --
// a proposito solo mira mantenimientos "pendientes" (sin resolver, de
// cualquier tipo: correctivo, cambio de aceite sin confirmar, o cualquier
// otro que haya requerido aprobacion por su valor), nunca uno de un solo dia
// ya completado. Un mantenimiento pendiente es un bloqueo abierto (no se
// sabe hasta cuando), asi que tiene sentido que deje el vehiculo entero
// fuera de servicio; uno de un solo dia (ver existeMantenimientoQueBloqueaEnFecha
// abajo) solo debe bloquear ESE dia puntual, nunca los demas -- por eso NO
// se refleja aca: si tambien marcara vehiculos.estado = "reparacion", el
// chequeo de arriba en asignaciones.service.js (vehiculo.estado !== "activo")
// bloquearia por error cualquier fecha futura hasta el proximo evento que
// reevalue el mantenimiento, no solo el dia real del mantenimiento.
async function existeMantenimientoQueBloquea(vehiculoId, empresaId) {
  const row = await db.get(
    "SELECT 1 FROM mantenimientos WHERE vehiculo_id = ? AND empresa_id = ? AND estado = ? AND fecha <= CURRENT_DATE LIMIT 1",
    [vehiculoId, empresaId, "pendiente"]
  );
  return Boolean(row);
}

// Bloqueo especifico de UN DIA puntual, sin tocar vehiculos.estado: bloquea
// si hay un mantenimiento programado exactamente para esa fecha (salvo que ya
// se haya resuelto como "aprobado"/"rechazado" -- ver mas abajo por que), o
// uno "pendiente" (sin resolver) desde esa fecha o antes -- ver el
// comentario de existeMantenimientoQueBloquea arriba sobre por que esto vive
// separado del chequeo de vehiculos.estado. Usado por asignaciones.service.js
// para bloquear la asignacion de un vehiculo en el dia exacto de un
// mantenimiento programado, sin depender de que vehiculos.estado ya se haya
// actualizado.
//
// "aprobado"/"rechazado" quedan afuera del bloqueo por fecha exacta a
// proposito: son los dos estados finales del tramite de aprobacion (ver
// resolverAprobacionMantenimiento en notificaciones.service.js), y el pedido
// del usuario fue que el vehiculo quede disponible para asignar rutas de
// inmediato al aprobar/rechazar, incluso el mismo dia del mantenimiento --
// no solo desde el dia siguiente. "completado" (revision/preventivo del dia,
// que nunca pasa por aprobacion) si sigue bloqueando su propio dia: ese
// vehiculo realmente estuvo en el taller esa fecha.
async function existeMantenimientoQueBloqueaEnFecha(vehiculoId, fecha, empresaId) {
  const row = await db.get(
    `
      SELECT 1 FROM mantenimientos
      WHERE vehiculo_id = ? AND empresa_id = ?
        AND ((fecha = ? AND estado NOT IN (?, ?)) OR (estado = ? AND fecha <= ?))
      LIMIT 1
    `,
    [vehiculoId, empresaId, fecha, "aprobado", "rechazado", "pendiente", fecha]
  );
  return Boolean(row);
}

// Igual criterio que existeMantenimientoQueBloqueaEnFecha, pero trae TODOS
// los vehiculos bloqueados de una vez (no uno por uno) -- usado por
// asignaciones.js para marcar en el selector, apenas se elige la fecha,
// cuales vehiculos ya tienen un mantenimiento programado ese dia, sin
// esperar a que fallen al guardar.
async function findVehiculosBloqueadosEnFecha(fecha, empresaId) {
  return db.all(
    `
      SELECT DISTINCT vehiculo_id FROM mantenimientos
      WHERE empresa_id = ?
        AND ((fecha = ? AND estado NOT IN (?, ?)) OR (estado = ? AND fecha <= ?))
    `,
    [empresaId, fecha, "aprobado", "rechazado", "pendiente", fecha]
  );
}

async function updateSalidaInventario(id, { url, nombre, mime }, empresaId) {
  await db.run(
    "UPDATE mantenimientos SET salida_inventario_url = ?, salida_inventario_nombre = ?, salida_inventario_mime = ? WHERE id = ? AND empresa_id = ?",
    [url, nombre, mime, id, empresaId]
  );
  return findById(id, empresaId);
}

// "dbClient" es opcional: por defecto usa el modulo de BD normal, pero
// createMantenimiento en el service lo invoca dentro de una transaccion
// (withTransaction) cuando hay repuestos que descontar de stock, para que la
// creacion del mantenimiento y el movimiento de stock sean atomicos.
async function create(mantenimiento, dbClient = db) {
  const placeholders = MANTENIMIENTO_FIELDS.map(() => "?").join(", ");
  const values = MANTENIMIENTO_FIELDS.map((field) => mantenimiento[field] ?? null);

  return dbClient.get(
    `INSERT INTO mantenimientos (${MANTENIMIENTO_FIELDS.join(", ")}) VALUES (${placeholders}) RETURNING *`,
    values
  );
}

async function createRepuestoDetalle(mantenimientoId, detalle, empresaId, dbClient = db) {
  return dbClient.run(
    `
      INSERT INTO mantenimiento_repuestos
        (mantenimiento_id, repuesto_id, repuesto_sugerido_id, motivo_sustitucion, cantidad, valor_unitario, valor_total, empresa_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      mantenimientoId,
      detalle.repuesto_id,
      detalle.repuesto_sugerido_id ?? null,
      detalle.motivo_sustitucion ?? null,
      detalle.cantidad,
      detalle.valor_unitario,
      detalle.valor_total,
      empresaId
    ]
  );
}

async function findRepuestosEstructurados(mantenimientoId, empresaId) {
  return db.all(
    `
      SELECT mr.*, r.codigo_interno, r.nombre, r.categoria, r.unidad_medida,
             rs.codigo_interno AS sugerido_codigo_interno, rs.nombre AS sugerido_nombre
      FROM mantenimiento_repuestos mr
      INNER JOIN repuestos r ON r.id = mr.repuesto_id
      LEFT JOIN repuestos rs ON rs.id = mr.repuesto_sugerido_id
      WHERE mr.mantenimiento_id = ? AND mr.empresa_id = ?
      ORDER BY mr.id ASC
    `,
    [mantenimientoId, empresaId]
  );
}

// mantenimiento_repuestos tiene ON DELETE CASCADE hacia mantenimientos, asi
// que borra solo tambien sus filas de detalle -- el reverso de stock (ver
// mantenimientos.service.js#deleteMantenimiento) se hace ANTES de llamar
// esto, leyendo ese detalle mientras todavia existe.
async function remove(id, empresaId, dbClient = db) {
  await dbClient.run("DELETE FROM mantenimientos WHERE id = ? AND empresa_id = ?", [id, empresaId]);
}

module.exports = {
  findAll,
  findByVehicle,
  findById,
  findByIdWithVehiculo,
  create,
  createRepuestoDetalle,
  findRepuestosEstructurados,
  updateEstado,
  updateSalidaInventario,
  existeMantenimientoQueBloquea,
  existeMantenimientoQueBloqueaEnFecha,
  findVehiculosBloqueadosEnFecha,
  remove
};
