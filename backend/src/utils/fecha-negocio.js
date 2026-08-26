// "Hoy" segun el calendario del negocio (Colombia), no el del servidor (los
// contenedores suelen correr en UTC sin TZ configurada). Mismo enfoque que
// obtenerHoyUTC en jobs/documentos-vencimiento.job.js -- se extrae aqui como
// util reusable porque ahora lo necesita tambien la asignacion de rutas del
// conductor.
function hoyIso(timeZone = "America/Bogota") {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const valores = Object.fromEntries(partes.map((parte) => [parte.type, parte.value]));
  return `${valores.year}-${valores.month}-${valores.day}`;
}

// "Mañana" segun el mismo calendario -- se usa para que el conductor pueda
// preparar la inspeccion del vehiculo la tarde/noche anterior a la ruta.
function mananaIso(timeZone = "America/Bogota") {
  const hoy = hoyIso(timeZone);
  const fecha = new Date(`${hoy}T00:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() + 1);
  return fecha.toISOString().slice(0, 10);
}

function horaActualBogota(timeZone = "America/Bogota") {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date());
  return Number(partes.find((parte) => parte.type === "hour")?.value);
}

// True si "ahora" en Bogota ya paso las 5:00am del dia fechaIso -- usado
// para habilitar Preoperacional cuando la Inspeccion ya se hizo el dia
// anterior a la ruta. Si fechaIso ya quedo en el pasado tambien es true
// (no tiene sentido seguir bloqueando una fecha vieja).
function estaHabilitadoDesdeLasCinco(fechaIso, timeZone = "America/Bogota") {
  const hoy = hoyIso(timeZone);
  if (hoy > fechaIso) return true;
  if (hoy < fechaIso) return false;
  return horaActualBogota(timeZone) >= 5;
}

module.exports = { hoyIso, mananaIso, estaHabilitadoDesdeLasCinco };
