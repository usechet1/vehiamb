const env = require("../config/env");
const HttpError = require("../errors/http-error");

// Unico modulo del backend que le habla a la API REST de Traccar (puerto
// interno 8082, nunca expuesto). VehiAmb nunca implementa el protocolo del
// tracker Suntech: Traccar es la capa de ingesta, esto es solo un cliente
// HTTP para su API ya existente. Autenticacion por Basic Auth en cada
// request (Traccar la soporta sin necesidad de manejar cookies de sesion).
function estaConfigurado() {
  return Boolean(env.traccarUrl);
}

function authHeader() {
  const credenciales = Buffer.from(`${env.traccarUser}:${env.traccarPassword}`).toString("base64");
  return `Basic ${credenciales}`;
}

async function request(path, { method = "GET", body } = {}) {
  if (!estaConfigurado()) {
    throw new HttpError(503, "El modulo de rastreo GPS no esta configurado (falta TRACCAR_URL)");
  }

  const url = `${env.traccarUrl.replace(/\/$/, "")}/api${path}`;
  let response;

  try {
    response = await fetch(url, {
      method,
      headers: {
        Authorization: authHeader(),
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
  } catch (error) {
    throw new HttpError(502, `No fue posible conectar con Traccar: ${error.message}`);
  }

  if (!response.ok) {
    const detalle = await response.text().catch(() => "");
    throw new HttpError(502, `Traccar respondio ${response.status} en ${path}${detalle ? `: ${detalle.slice(0, 300)}` : ""}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

// Catalogo completo de dispositivos dados de alta en Traccar (no filtrado
// por vehiculo/empresa -- ese cruce lo hace gps.service.js contra
// dispositivos_gps, la unica tabla de VehiAmb que sabe que dispositivo es de
// que empresa).
async function listarDispositivos() {
  return request("/devices");
}

async function obtenerDispositivo(traccarDeviceId) {
  const dispositivos = await request(`/devices?id=${traccarDeviceId}`);
  return dispositivos[0] || null;
}

// Da de alta un dispositivo en Traccar a partir de su IMEI (uniqueId, el
// mismo identificador que el tracker manda en el protocolo Suntech). Se usa
// al vincular un tracker nuevo desde el panel de gestion (gps.manage).
async function crearDispositivo({ nombre, imei }) {
  return request("/devices", { method: "POST", body: { name: nombre, uniqueId: imei } });
}

// Ultima posicion conocida de cada dispositivo (o de uno puntual via
// deviceId) -- Traccar la mantiene en memoria/cache, no hace falta pedir un
// rango de fechas para "donde esta ahora mismo".
async function obtenerPosicionesActuales(traccarDeviceIds = []) {
  if (!traccarDeviceIds.length) return request("/positions");

  const query = traccarDeviceIds.map((id) => `deviceId=${id}`).join("&");
  return request(`/positions?${query}`);
}

// Historial de posiciones de UN dispositivo en un rango de fechas -- usado
// por el detalle/recorrido de un vehiculo puntual, no por el tablero de
// flota (ver obtenerPosicionesActuales).
async function obtenerHistorialPosiciones(traccarDeviceId, desde, hasta) {
  const query = new URLSearchParams({
    deviceId: String(traccarDeviceId),
    from: desde.toISOString(),
    to: hasta.toISOString()
  });
  return request(`/positions?${query}`);
}

// Eventos (alarmas, SOS, etc.) de un dispositivo en un rango de fechas. El
// endpoint de reportes de Traccar exige deviceId + from + to -- no hay forma
// de pedir "todos los eventos de todos los dispositivos" en una sola
// llamada, por eso gps.service.js#sincronizarEventos itera dispositivo por
// dispositivo (ver gps-eventos-sync.job.js).
async function obtenerEventos(traccarDeviceId, desde, hasta) {
  const query = new URLSearchParams({
    deviceId: String(traccarDeviceId),
    from: desde.toISOString(),
    to: hasta.toISOString()
  });
  return request(`/reports/events?${query}`);
}

module.exports = {
  estaConfigurado,
  listarDispositivos,
  obtenerDispositivo,
  crearDispositivo,
  obtenerPosicionesActuales,
  obtenerHistorialPosiciones,
  obtenerEventos
};
