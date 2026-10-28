const db = require("../database/query");

const CREATE_FIELDS = ["fecha", "conductor_id", "vehiculo_id", "ruta_id", "destinos", "telefono", "observaciones", "usuario_id", "empresa_id"];

// destinos es JSONB (arreglo de { departamento, municipio } en el orden del
// recorrido) -- se guarda ademas de ruta_id/ruta_nombre para poder
// reconstruir el formulario tal cual al editar, sin depender de parsear el
// texto compuesto.
function serializarDestinos(destinos) {
  return destinos ? JSON.stringify(destinos) : null;
}

const SELECT_JOIN = `
  SELECT
    ar.*,
    c.nombres AS conductor_nombres,
    c.apellidos AS conductor_apellidos,
    v.placa AS vehiculo_placa,
    v.marca AS vehiculo_marca,
    v.modelo AS vehiculo_modelo,
    v.imagen_url AS vehiculo_imagen_url,
    r.nombre AS ruta_nombre
  FROM asignaciones_ruta ar
  LEFT JOIN conductores c ON c.id = ar.conductor_id
  LEFT JOIN vehiculos v ON v.id = ar.vehiculo_id
  LEFT JOIN rutas r ON r.id = ar.ruta_id
`;

async function create(asignacion) {
  const values = CREATE_FIELDS.map((field) =>
    field === "destinos" ? serializarDestinos(asignacion.destinos) : asignacion[field] ?? null
  );
  const placeholders = CREATE_FIELDS.map(() => "?").join(", ");

  const creada = await db.get(
    `INSERT INTO asignaciones_ruta (${CREATE_FIELDS.join(", ")}) VALUES (${placeholders}) RETURNING id`,
    values
  );

  return findById(creada.id, asignacion.empresa_id);
}

async function update(id, asignacion, empresaId) {
  const campos = ["fecha", "conductor_id", "vehiculo_id", "ruta_id", "destinos", "telefono", "observaciones"];
  const assignments = campos.map((field) => `${field} = ?`).join(", ");
  const values = campos.map((field) =>
    field === "destinos" ? serializarDestinos(asignacion.destinos) : asignacion[field] ?? null
  );

  await db.run(`UPDATE asignaciones_ruta SET ${assignments} WHERE id = ? AND empresa_id = ?`, [...values, id, empresaId]);
  return findById(id, empresaId);
}

async function findById(id, empresaId) {
  return db.get(`${SELECT_JOIN} WHERE ar.id = ? AND ar.empresa_id = ?`, [id, empresaId]);
}

// Orden de creacion (id ASC) para que coincida con el numero de fila (#) del
// reporte impreso -- se van agregando en el orden en que salen los vehiculos.
async function findByFecha(fecha, empresaId) {
  return db.all(`${SELECT_JOIN} WHERE ar.empresa_id = ? AND ar.fecha = ? ORDER BY ar.id ASC`, [empresaId, fecha]);
}

async function remove(id, empresaId) {
  return db.run("DELETE FROM asignaciones_ruta WHERE id = ? AND empresa_id = ?", [id, empresaId]);
}

// Asignacion vigente de un conductor para una fecha puntual (usado por
// viajes.service.js obtenerAsignacionHoy, para que el conductor vea su ruta
// del dia ya resuelta en vez de elegir vehiculo/destino a mano). Si por error
// quedaron dos asignaciones el mismo dia para el mismo conductor, se toma la
// mas reciente.
async function findByConductorYFecha(conductorId, fecha, empresaId) {
  return db.get(
    `${SELECT_JOIN} WHERE ar.empresa_id = ? AND ar.conductor_id = ? AND ar.fecha = ? ORDER BY ar.id DESC LIMIT 1`,
    [empresaId, conductorId, fecha]
  );
}

// Asignaciones de un rango de fechas con indicadores de si su inspeccion y su
// preoperacional ya se registraron -- es el "esperado" del Resumen del dia
// (viajes.service.js#obtenerResumenDia): cada ruta asignada deberia tener
// los dos.
// El vinculo principal es el mismo de resolverAsignacionParaFecha
// (asignacion -> inspeccion -> viaje -> preoperacional); como respaldo se
// acepta un preoperacional del mismo conductor ese mismo dia (Bogota), para
// el viaje que el conductor inicio por el flujo manual sin la asignacion.
// conductorUsuarioId es el usuario (mismo filtro "Conductor" de Viajes
// recientes), no conductores.id.
async function findConPreoperacionalPorRango(empresaId, { fechaDesde, fechaHasta, conductorUsuarioId, placa } = {}) {
  const conditions = ["ar.empresa_id = ?", "ar.fecha >= ?", "ar.fecha <= ?"];
  const values = [empresaId, fechaDesde, fechaHasta];

  if (conductorUsuarioId) {
    conditions.push("c.usuario_id = ?");
    values.push(conductorUsuarioId);
  }

  if (placa) {
    conditions.push("v.placa = ?");
    values.push(placa);
  }

  return db.all(
    `
      SELECT
        ar.id,
        to_char(ar.fecha, 'YYYY-MM-DD') AS fecha,
        ar.vehiculo_id,
        ar.conductor_id,
        v.placa AS vehiculo_placa,
        c.nombres AS conductor_nombres,
        c.apellidos AS conductor_apellidos,
        r.nombre AS ruta_nombre,
        -- Inspeccion: la atada a la asignacion (incluye la "preinspeccion"
        -- hecha la tarde anterior, ver inspecciones.service.js) o, si el
        -- conductor uso el flujo manual, una suya de ese mismo dia.
        (
          EXISTS (
            SELECT 1
            FROM inspecciones_preventivas ip
            WHERE ip.asignacion_id = ar.id
          )
          OR EXISTS (
            SELECT 1
            FROM inspecciones_preventivas ip
            WHERE c.usuario_id IS NOT NULL
              AND ip.usuario_id = c.usuario_id
              AND (ip.fecha AT TIME ZONE 'America/Bogota')::date = ar.fecha
          )
        ) AS inspeccion_realizada,
        (
          EXISTS (
            SELECT 1
            FROM inspecciones_preventivas ip
            INNER JOIN preoperacionales p ON p.viaje_id = ip.viaje_id
            WHERE ip.asignacion_id = ar.id
          )
          OR EXISTS (
            SELECT 1
            FROM preoperacionales p
            WHERE c.usuario_id IS NOT NULL
              AND p.usuario_id = c.usuario_id
              AND (p.fecha AT TIME ZONE 'America/Bogota')::date = ar.fecha
          )
        ) AS preoperacional_realizado
      FROM asignaciones_ruta ar
      LEFT JOIN conductores c ON c.id = ar.conductor_id
      LEFT JOIN vehiculos v ON v.id = ar.vehiculo_id
      LEFT JOIN rutas r ON r.id = ar.ruta_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY ar.fecha ASC, ar.id ASC
    `,
    values
  );
}

module.exports = { create, update, findById, findByFecha, findByConductorYFecha, findConPreoperacionalPorRango, remove };
