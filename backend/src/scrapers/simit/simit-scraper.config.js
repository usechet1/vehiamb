// Configuracion del scraper SIMIT. Los selectores del portal publico cambian
// con cierta frecuencia (es una SPA): mantenerlos aislados aqui evita tocar
// la logica de scraping cuando el sitio actualiza su marcado.
//
// Selectores verificados el 2026-07-02 navegando el sitio real con Playwright
// + un User-Agent de navegador comun, incluyendo una busqueda de prueba real
// (placa con multas) hasta ver resultados:
// - Campo de busqueda: #txtBusqueda (acepta placa O numero de documento, es
//   un unico campo compartido).
// - Boton de busqueda: #btnNumDocPlaca (icono sin texto).
// - Tabla de resultados: #multaTable, filas con clase .page-row y celdas con
//   atributo data-label (Tipo/Notificacion/Placa/Secretaria/Infraccion/
//   Estado/Valor/"Valor a pagar"). Paginada en el cliente (maximo 15 filas
//   por pagina via #pageLengthSelect, sin boton "siguiente" visible) -- ver
//   simit-scraper.js para como se maneja esto.
// - Tarjeta de agregados: ".bg-estado-section" con labels "Comparendos",
//   "Multas", "Acuerdos de pago", "Total" (fuente autoritativa de los
//   totales, no depende de la paginacion de la tabla).
// - emptyState (placa/documento SIN multas) NO se pudo verificar: no hay una
//   placa de prueba conocida sin comparendos. Sigue siendo una estimacion; si
//   el scraper reporta "error" de forma consistente para placas que deberian
//   estar limpias, revisar este selector primero.
//
// IMPORTANTE: el sitio esta protegido con Cloudflare Turnstile (bot check).
// Con un User-Agent de navegador real el sitio respondio 200 y renderizo el
// formulario; con clientes sin User-Agent de navegador (ej. curl) respondio
// 403 de inmediato. Si el scraper reporta "bloqueado" de forma consistente,
// el Turnstile esta interceptando la sesion headless.

const SIMIT_BASE_URL = process.env.SIMIT_BASE_URL || "https://www.fcm.org.co/simit/#/estado-cuenta";
const BROWSER_USER_AGENT = process.env.SIMIT_USER_AGENT
  || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

module.exports = {
  SIMIT_BASE_URL,
  BROWSER_USER_AGENT,
  NAVIGATION_TIMEOUT_MS: Number(process.env.SIMIT_NAV_TIMEOUT_MS || 30000),
  // 15s resulto insuficiente en pruebas reales (la busqueda dispara una
  // llamada AJAX que a veces tarda mas de eso); 30s fue estable.
  RESULT_TIMEOUT_MS: Number(process.env.SIMIT_RESULT_TIMEOUT_MS || 30000),
  HEADLESS: process.env.SIMIT_HEADLESS !== "false",
  CHROMIUM_EXECUTABLE_PATH: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
  // Delay entre consultas consecutivas durante una actualizacion masiva, para
  // no saturar el portal ni parecer trafico automatizado agresivo. La flota
  // se recorre siempre de forma secuencial (una placa a la vez).
  BULK_DELAY_MS: Number(process.env.SIMIT_BULK_DELAY_MS || 4000),

  SELECTORS: {
    placaInput: process.env.SIMIT_SELECTOR_PLACA_INPUT || "#txtBusqueda",
    searchButton: process.env.SIMIT_SELECTOR_SEARCH_BUTTON || "#btnNumDocPlaca",
    resultsTable: process.env.SIMIT_SELECTOR_RESULTS_TABLE || "#multaTable",
    resultRow: process.env.SIMIT_SELECTOR_RESULT_ROW || "#multaTable tbody tr.page-row",
    resumenCard: process.env.SIMIT_SELECTOR_RESUMEN || ".bg-estado-section",
    pageLengthSelect: process.env.SIMIT_SELECTOR_PAGE_LENGTH || "#pageLengthSelect",
    emptyState: process.env.SIMIT_SELECTOR_EMPTY_STATE || ".sin-resultados, .no-data, .estado-sin-multas",
    captchaMarker: process.env.SIMIT_SELECTOR_CAPTCHA
      || "iframe[src*='challenges.cloudflare.com' i], .cf-turnstile, [class*='turnstile' i], iframe[src*='captcha' i], iframe[src*='recaptcha' i], .g-recaptcha, .h-captcha"
  },

  ESTADOS_CARTERA: {
    SIN_MULTAS: "sin_multas",
    CON_MULTAS: "con_multas",
    COBRO_COACTIVO: "cobro_coactivo",
    ACUERDO_PAGO: "acuerdo_pago",
    DESCONOCIDO: "desconocido"
  },

  ESTADOS_CONSULTA: {
    OK: "ok",
    ERROR: "error",
    BLOQUEADO: "bloqueado"
  }
};
