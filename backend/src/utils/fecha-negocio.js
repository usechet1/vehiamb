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

module.exports = { hoyIso };
