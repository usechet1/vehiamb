const db = require("../database/query");

async function create({ vehiculo_id, usuario_id, destino, empresa_id }) {
  return db.get(
    `INSERT INTO viajes (vehiculo_id, usuario_id, destino, empresa_id) VALUES (?, ?, ?, ?) RETURNING *`,
    [vehiculo_id, usuario_id, destino, empresa_id]
  );
}

async function findById(id, empresaId) {
  return db.get("SELECT * FROM viajes WHERE id = ? AND empresa_id = ?", [id, empresaId]);
}

// Ultimos viajes de un conductor, con los datos del vehiculo ya resueltos
// para no tener que pedirlos aparte al pintar "Tus ultimos viajes". Ya viene
// implicitamente acotado a una sola empresa via usuario_id (un usuario
// pertenece a una unica empresa).
async function findRecientesPorUsuario(usuarioId, { limit = 10 } = {}) {
  return db.all(
    `
      SELECT
        v.*,
        veh.placa AS vehiculo_placa,
        veh.marca AS vehiculo_marca,
        veh.modelo AS vehiculo_modelo
      FROM viajes v
      LEFT JOIN vehiculos veh ON veh.id = v.vehiculo_id
      WHERE v.usuario_id = ?
      ORDER BY v.creado_en DESC
      LIMIT ?
    `,
    [usuarioId, limit]
  );
}

// Historial de viajes de un vehiculo especifico (de cualquier conductor que
// lo haya usado), para la seccion "Ultimos viajes" en la hoja de vida del
// vehiculo. Ya acotado a la empresa via el propio vehiculo.
async function findRecientesPorVehiculo(vehiculoId, empresaId, { limit = 10 } = {}) {
  return db.all(
    `
      SELECT
        v.*,
        u.nombre AS usuario_nombre
      FROM viajes v
      LEFT JOIN usuarios u ON u.id = v.usuario_id
      WHERE v.vehiculo_id = ? AND v.empresa_id = ?
      ORDER BY v.creado_en DESC
      LIMIT ?
    `,
    [vehiculoId, empresaId, limit]
  );
}

// Ultimos viajes de toda la empresa, sin importar el conductor ni el
// vehiculo -- para que Administrador/Operador vean de un vistazo la
// actividad reciente de todos los conductores desde "Mi ultimo viaje", y
// para el exportable PDF/Excel de esa misma pantalla. Sin fechaDesde/
// fechaHasta se limita a los mas recientes (vista rapida); con alguna de
// las dos, se trae todo el rango sin tope, para poder "exportar completo"
// el dia consultado.
//
// Trae tambien el detalle item por item del preoperacional y la inspeccion
// preventiva de cada viaje (no solo el conteo), para el exportable. Un
// viaje puede tener mas de una inspeccion/preoperacional asociada en datos
// reales (sin restriccion de unicidad en la BD) -- se usa LEFT JOIN LATERAL
// para quedarse solo con la mas reciente de cada una, igual que ya hacen
// inspeccionesRepository.findByViajeId/preoperacionalesRepository.findByViajeId
// (ORDER BY id DESC LIMIT 1), y asi evitar que un viaje aparezca duplicado.
async function findRecientesPorEmpresa(empresaId, { fechaDesde, fechaHasta, limit = 20 } = {}) {
  const conditions = ["v.empresa_id = ?"];
  const values = [empresaId];

  if (fechaDesde) {
    conditions.push("v.creado_en >= ?");
    values.push(`${fechaDesde} 00:00:00`);
  }

  if (fechaHasta) {
    conditions.push("v.creado_en <= ?");
    values.push(`${fechaHasta} 23:59:59`);
  }

  const sinFiltroDeFecha = !fechaDesde && !fechaHasta;
  if (sinFiltroDeFecha) values.push(limit);

  return db.all(
    `
      SELECT
        v.*,
        u.nombre AS usuario_nombre,
        veh.placa AS vehiculo_placa,
        veh.marca AS vehiculo_marca,
        veh.modelo AS vehiculo_modelo,
        p.id AS preoperacional_id,
        (
          SELECT COALESCE(json_agg(jsonb_build_object('item_label', pi.item_label, 'respuesta', pi.respuesta, 'observacion', pi.observacion) ORDER BY pi.id), '[]'::json)
          FROM preoperacional_items pi
          WHERE pi.preoperacional_id = p.id
        ) AS preoperacional_items,
        insp.id AS inspeccion_id,
        (
          SELECT COALESCE(json_agg(jsonb_build_object('item_label', ii.item_label, 'estado', ii.estado, 'comentario', ii.comentario) ORDER BY ii.id), '[]'::json)
          FROM inspeccion_items ii
          WHERE ii.inspeccion_id = insp.id
        ) AS inspeccion_items
      FROM viajes v
      LEFT JOIN usuarios u ON u.id = v.usuario_id
      LEFT JOIN vehiculos veh ON veh.id = v.vehiculo_id
      LEFT JOIN LATERAL (
        SELECT pp.id FROM preoperacionales pp WHERE pp.viaje_id = v.id ORDER BY pp.id DESC LIMIT 1
      ) p ON true
      LEFT JOIN LATERAL (
        SELECT ip.id FROM inspecciones_preventivas ip WHERE ip.viaje_id = v.id ORDER BY ip.id DESC LIMIT 1
      ) insp ON true
      WHERE ${conditions.join(" AND ")}
      ORDER BY v.creado_en DESC
      ${sinFiltroDeFecha ? "LIMIT ?" : ""}
    `,
    values
  );
}

// Viaje que corresponde a una asignacion de ruta puntual, correlacionado por
// usuario+vehiculo+fecha porque "viajes" no tiene una FK directa a
// asignaciones_ruta (la asignacion es el plan; el viaje es lo que el
// conductor efectivamente registro al salir, si es que salio). Usado por el
// reporte diario de asignaciones (ver asignaciones.service.js) para saber si
// el conductor completo el preoperacional de su ruta -- ese solo se ata a un
// viaje, nunca a una asignacion (a diferencia de la inspeccion preventiva,
// que si puede hacerse de antemano sobre la asignacion misma).
async function findByUsuarioVehiculoYFecha(usuarioId, vehiculoId, fecha, empresaId) {
  return db.get(
    `
      SELECT * FROM viajes
      WHERE usuario_id = ? AND vehiculo_id = ? AND empresa_id = ?
        AND creado_en >= ? AND creado_en <= ?
      ORDER BY creado_en DESC
      LIMIT 1
    `,
    [usuarioId, vehiculoId, empresaId, `${fecha} 00:00:00`, `${fecha} 23:59:59`]
  );
}

module.exports = {
  create,
  findById,
  findRecientesPorUsuario,
  findRecientesPorVehiculo,
  findRecientesPorEmpresa,
  findByUsuarioVehiculoYFecha
};
