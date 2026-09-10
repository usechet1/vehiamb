const db = require("../database/query");

const DEVICE_SELECT = `
  SELECT
    d.id,
    d.empresa_id,
    d.vehiculo_id,
    d.traccar_device_id,
    d.imei,
    d.nombre,
    d.estado,
    d.created_at,
    v.placa AS vehiculo_placa,
    v.marca AS vehiculo_marca,
    v.modelo AS vehiculo_modelo
  FROM dispositivos_gps d
  LEFT JOIN vehiculos v ON v.id = d.vehiculo_id
`;

async function findAllDispositivos(empresaId) {
  return db.all(`${DEVICE_SELECT} WHERE d.empresa_id = ? ORDER BY d.created_at DESC`, [empresaId]);
}

// Sin filtro de empresa -- Traccar es UNA sola instancia compartida por
// todas las empresas de VehiAmb (no es multi-tenant del lado de Traccar), asi
// que el job de sincronizacion de eventos (gps-eventos-sync.job.js) necesita
// recorrer todos los dispositivos de todas las empresas en cada corrida, no
// solo los de una.
async function findAllDispositivosGlobal() {
  return db.all(`${DEVICE_SELECT} WHERE d.estado = 'activo'`);
}

async function findDispositivoById(id, empresaId) {
  return db.get(`${DEVICE_SELECT} WHERE d.id = ? AND d.empresa_id = ?`, [id, empresaId]);
}

async function findDispositivoByVehiculo(vehiculoId, empresaId) {
  return db.get(`${DEVICE_SELECT} WHERE d.vehiculo_id = ? AND d.empresa_id = ?`, [vehiculoId, empresaId]);
}

async function findDispositivoByImei(imei, empresaId) {
  return db.get(`${DEVICE_SELECT} WHERE d.imei = ? AND d.empresa_id = ?`, [imei, empresaId]);
}

async function createDispositivo(dispositivo) {
  const creado = await db.get(
    `
      INSERT INTO dispositivos_gps (empresa_id, vehiculo_id, traccar_device_id, imei, nombre, estado)
      VALUES (?, ?, ?, ?, ?, ?)
      RETURNING id
    `,
    [
      dispositivo.empresa_id,
      dispositivo.vehiculo_id ?? null,
      dispositivo.traccar_device_id,
      dispositivo.imei,
      dispositivo.nombre ?? null,
      dispositivo.estado || "activo"
    ]
  );
  return findDispositivoById(creado.id, dispositivo.empresa_id);
}

async function asignarVehiculo(id, vehiculoId, empresaId) {
  await db.run("UPDATE dispositivos_gps SET vehiculo_id = ? WHERE id = ? AND empresa_id = ?", [vehiculoId, id, empresaId]);
  return findDispositivoById(id, empresaId);
}

async function setEstadoDispositivo(id, estado, empresaId) {
  await db.run("UPDATE dispositivos_gps SET estado = ? WHERE id = ? AND empresa_id = ?", [estado, id, empresaId]);
  return findDispositivoById(id, empresaId);
}

// ON CONFLICT (traccar_event_id) DO NOTHING: el job de sincronizacion
// (gps-eventos-sync.job.js) vuelve a consultar cada minuto una ventana de
// tiempo que se solapa con la corrida anterior a proposito (para no perder
// un evento por un reloj desfasado), asi que reinsertar el mismo evento de
// Traccar debe ser un no-op, no un error.
async function createEvento(evento) {
  return db.get(
    `
      INSERT INTO gps_eventos (empresa_id, vehiculo_id, dispositivo_id, tipo_evento, traccar_event_id, payload)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT (traccar_event_id) DO NOTHING
      RETURNING id
    `,
    [
      evento.empresa_id,
      evento.vehiculo_id,
      evento.dispositivo_id,
      evento.tipo_evento,
      evento.traccar_event_id,
      evento.payload ? JSON.stringify(evento.payload) : null
    ]
  );
}

async function findEventosPorVehiculo(vehiculoId, empresaId, { limit = 50 } = {}) {
  return db.all(
    `
      SELECT ge.*, d.imei, d.nombre AS dispositivo_nombre
      FROM gps_eventos ge
      LEFT JOIN dispositivos_gps d ON d.id = ge.dispositivo_id
      WHERE ge.vehiculo_id = ? AND ge.empresa_id = ?
      ORDER BY ge.created_at DESC, ge.id DESC
      LIMIT ?
    `,
    [vehiculoId, empresaId, limit]
  );
}

module.exports = {
  findAllDispositivos,
  findAllDispositivosGlobal,
  findDispositivoById,
  findDispositivoByVehiculo,
  findDispositivoByImei,
  createDispositivo,
  asignarVehiculo,
  setEstadoDispositivo,
  createEvento,
  findEventosPorVehiculo
};
