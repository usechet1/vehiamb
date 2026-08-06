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
// el dia consultado. Incluye el resumen del preoperacional de cada viaje
// (si se lleno y cuantos items quedaron en mal estado) en la misma
// consulta, para no tener que pedirlo aparte fila por fila.
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
        COUNT(pi.id) FILTER (WHERE pi.respuesta = 'no') AS preoperacional_items_mal
      FROM viajes v
      LEFT JOIN usuarios u ON u.id = v.usuario_id
      LEFT JOIN vehiculos veh ON veh.id = v.vehiculo_id
      LEFT JOIN preoperacionales p ON p.viaje_id = v.id
      LEFT JOIN preoperacional_items pi ON pi.preoperacional_id = p.id
      WHERE ${conditions.join(" AND ")}
      GROUP BY v.id, u.nombre, veh.placa, veh.marca, veh.modelo, p.id
      ORDER BY v.creado_en DESC
      ${sinFiltroDeFecha ? "LIMIT ?" : ""}
    `,
    values
  );
}

module.exports = { create, findById, findRecientesPorUsuario, findRecientesPorVehiculo, findRecientesPorEmpresa };
