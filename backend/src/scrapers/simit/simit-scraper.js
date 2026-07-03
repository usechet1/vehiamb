// Scraper del portal publico SIMIT (Playwright). Modulo deliberadamente
// aislado y sin dependencias del resto del backend (no importa repositories,
// servicios ni la conexion a base de datos): solo sabe recibir una placa y
// devolver un resultado estructurado. Esto permite moverlo a un servicio o
// proceso separado en el futuro sin tocar su logica interna, y facilita
// agregar scrapers hermanos para otras integraciones externas (RUNT, GPS,
// aseguradoras, DIAN) siguiendo el mismo contrato de entrada/salida.
//
// Contrato de salida (siempre el mismo shape, exitoso o no):
// {
//   estado_consulta: "ok" | "error" | "bloqueado",
//   estado_cartera: "sin_multas" | "con_multas" | "cobro_coactivo" | "acuerdo_pago" | "desconocido",
//   comparendos: [{ numero_comparendo, fecha_infraccion, descripcion, valor, estado, detalle }],
//   total_comparendos, valor_total, mensaje_error
// }
//
// Verificado el 2026-07-02 navegando el sitio real (ver simit-scraper.config.js
// para el detalle). Estructura real de resultados:
// - Tarjeta "Resumen" con contadores agregados (Comparendos/Multas/Acuerdos de
//   pago/Total): es la fuente MAS CONFIABLE para total_comparendos/valor_total,
//   se usa siempre que este presente.
// - Tabla #multaTable, paginada en el cliente (maximo 15 filas por pagina, sin
//   controles de "siguiente" visibles para saltar de pagina). Para una placa
//   con muchas multas (se probo un caso con 1015) NO es viable ni deseable
//   recorrer cada pagina en cada consulta automatica: se captura unicamente
//   la muestra visible (hasta 15 filas, tras maximizar el tamano de pagina)
//   para la comparacion de "nuevos/cambios de estado" por numero_comparendo.
//   Si el vehiculo tiene mas multas que las capturadas, el conteo/total viene
//   igual de la tarjeta Resumen (siempre correcto); solo la lista item-a-item
//   puede quedar incompleta para flotas con historiales muy largos.
const { chromium } = require("playwright-core");
const config = require("./simit-scraper.config");

const DATE_PATTERN = /\d{1,2}\/\d{1,2}\/\d{2,4}/;

const ESTADO_KEYWORDS = [
  { estado: "cobro_coactivo", pattern: /cobro\s*coactivo/i },
  { estado: "acuerdo_pago", pattern: /acuerdo\s*de\s*pago/i },
  { estado: "pagado", pattern: /pagad[oa]/i },
  { estado: "prescrito", pattern: /prescrit[oa]/i },
  { estado: "pendiente", pattern: /pendiente/i }
];

function emptyResult(overrides = {}) {
  return {
    estado_consulta: config.ESTADOS_CONSULTA.OK,
    estado_cartera: config.ESTADOS_CARTERA.DESCONOCIDO,
    comparendos: [],
    total_comparendos: 0,
    valor_total: 0,
    mensaje_error: null,
    ...overrides
  };
}

function parseValor(text) {
  if (!text) return 0;
  const digits = String(text).replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

// El sitio muestra las fechas como DD/MM/YYYY. Postgres, con el DateStyle por
// defecto, interpreta "17/04/2026" como MM/DD/YYYY y falla con "date/time
// field value out of range" (mes 17 no existe). Se normaliza a ISO
// (YYYY-MM-DD) aqui, en el borde del scraper, para que el resto del sistema
// nunca tenga que lidiar con el formato de origen.
function toIsoDate(fechaDDMMYYYY) {
  if (!fechaDDMMYYYY) return null;

  const match = fechaDDMMYYYY.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!match) return null;

  const [, dia, mes, anio] = match;
  const anioCompleto = anio.length === 2 ? `20${anio}` : anio;

  return `${anioCompleto}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`;
}

function detectarEstado(text) {
  const encontrado = ESTADO_KEYWORDS.find(({ pattern }) => pattern.test(text || ""));
  return encontrado ? encontrado.estado : "pendiente";
}

function calcularEstadoCartera({ totalComparendosResumen, acuerdosPagoResumen, comparendosMuestra }) {
  if (!totalComparendosResumen) return config.ESTADOS_CARTERA.SIN_MULTAS;
  // La deteccion de "cobro coactivo" solo alcanza a la muestra capturada (ver
  // nota de cabecera), asi que es un indicador parcial: si aparece en la
  // muestra, se reporta; si no aparece, no significa que no exista en el
  // resto del historial no muestreado.
  if (comparendosMuestra.some((c) => c.estado === "cobro_coactivo")) return config.ESTADOS_CARTERA.COBRO_COACTIVO;
  if (acuerdosPagoResumen > 0) return config.ESTADOS_CARTERA.ACUERDO_PAGO;
  return config.ESTADOS_CARTERA.CON_MULTAS;
}

// Lee la tarjeta "Resumen" (Comparendos/Multas/Acuerdos de pago/Total). Es la
// fuente autoritativa de los agregados: no depende de paginacion ni de que el
// scraper logre capturar todas las filas de la tabla.
async function leerResumen(page) {
  const resumen = await page.evaluate((selectorResumen) => {
    const labels = Array.from(document.querySelectorAll(`${selectorResumen} label`));
    const leer = (texto) => {
      const label = labels.find((el) => el.textContent.trim().startsWith(texto));
      const valor = label?.nextElementSibling?.textContent?.trim();
      return valor ?? null;
    };

    return {
      comparendos: leer("Comparendos"),
      acuerdosPago: leer("Acuerdos de pago"),
      total: leer("Total")
    };
  }, config.SELECTORS.resumenCard).catch(() => null);

  if (!resumen) return null;

  return {
    totalComparendos: resumen.comparendos !== null ? Number(resumen.comparendos) || 0 : null,
    acuerdosPago: resumen.acuerdosPago !== null ? Number(resumen.acuerdosPago) || 0 : 0,
    valorTotal: parseValor(resumen.total)
  };
}

async function extraerMuestraComparendos(page) {
  // Maximiza el tamano de pagina disponible (hasta 15) antes de leer, para
  // capturar la mayor muestra posible en una sola pasada sin paginar.
  const selectorTamano = await page.$(config.SELECTORS.pageLengthSelect);
  if (selectorTamano) {
    const opciones = await selectorTamano.$$eval("option", (nodes) => nodes.map((node) => node.value));
    if (opciones.length) {
      const mayor = opciones.reduce((max, actual) => (Number(actual) > Number(max) ? actual : max), opciones[0]);
      await page.selectOption(config.SELECTORS.pageLengthSelect, mayor).catch(() => {});
      await page.waitForTimeout(1000);
    }
  }

  const filas = await page.$$(config.SELECTORS.resultRow);
  const resultados = [];

  for (const fila of filas) {
    const visible = await fila.isVisible().catch(() => false);
    if (!visible) continue;

    const celdas = await fila.evaluate((row) => {
      const leerCelda = (label) => row.querySelector(`[data-label="${label}"]`)?.textContent?.trim() || "";
      const infraccionPopover = row.querySelector('[data-label="Infracción"] [data-content]');

      // La celda "Valor a pagar" incluye un popover oculto con el desglose
      // (capital, descuentos, recargos): sin quitarlo, textContent concatena
      // todas esas cifras con el valor principal. Se clona la celda y se
      // eliminan los nodos del popover antes de leer el texto.
      const celdaValor = row.querySelector('[data-label="Valor a pagar"]');
      let valorAPagar = "";
      if (celdaValor) {
        const clon = celdaValor.cloneNode(true);
        clon.querySelectorAll("div, p").forEach((nodo) => nodo.remove());
        valorAPagar = clon.textContent.trim();
      }

      return {
        tipo: leerCelda("Tipo"),
        placa: leerCelda("Placa"),
        infraccionResumen: leerCelda("Infracción"),
        infraccionDetalle: infraccionPopover ? infraccionPopover.getAttribute("data-content") : null,
        estado: leerCelda("Estado"),
        valorAPagar
      };
    });

    if (!celdas.tipo) continue;

    const numeroMatch = celdas.tipo.match(/\d[\d.]{5,}/);
    const fechaMatch = celdas.tipo.match(DATE_PATTERN);

    resultados.push({
      numero_comparendo: numeroMatch ? numeroMatch[0] : celdas.tipo.split("\n")[0].trim(),
      fecha_infraccion: fechaMatch ? toIsoDate(fechaMatch[0]) : null,
      descripcion: (celdas.infraccionDetalle || celdas.infraccionResumen || null),
      valor: parseValor(celdas.valorAPagar),
      estado: detectarEstado(celdas.estado),
      detalle: celdas
    });
  }

  return resultados;
}

async function hayCaptcha(page) {
  const marcador = await page.$(config.SELECTORS.captchaMarker);
  return Boolean(marcador);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Cortes de conexion (ERR_CONNECTION_CLOSED/RESET/EMPTY_RESPONSE) suelen ser
// transitorios -- el sitio esta detras de Cloudflare y puede cortar la
// conexion momentaneamente ante trafico repetido en poco tiempo, sin que
// signifique un bloqueo permanente. Se reintenta una vez con una espera corta
// antes de reportar la consulta como fallida.
const ERRORES_RED_REINTENTABLES = /ERR_CONNECTION_CLOSED|ERR_CONNECTION_RESET|ERR_EMPTY_RESPONSE|ERR_CONNECTION_REFUSED|ERR_NETWORK_CHANGED/;

async function irConReintento(page, url, opciones) {
  try {
    return await page.goto(url, opciones);
  } catch (error) {
    if (!ERRORES_RED_REINTENTABLES.test(error.message)) throw error;

    await sleep(5000);
    return page.goto(url, opciones);
  }
}

async function scrapePlaca(placa) {
  const placaNormalizada = String(placa || "").trim().toUpperCase();

  if (!placaNormalizada) {
    return emptyResult({
      estado_consulta: config.ESTADOS_CONSULTA.ERROR,
      mensaje_error: "Placa vacia"
    });
  }

  let browser;

  try {
    browser = await chromium.launch({
      headless: config.HEADLESS,
      executablePath: config.CHROMIUM_EXECUTABLE_PATH,
      // Requerido para correr Chromium dentro de un contenedor Docker.
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    // El sitio esta detras de Cloudflare Turnstile: con el User-Agent por
    // defecto de Playwright responde 403 o cuelga la navegacion; con un
    // User-Agent de navegador comun carga con normalidad (verificado
    // manualmente). "waitUntil: networkidle" tampoco funciona aqui porque el
    // sitio mantiene conexiones de fondo (widget de Turnstile, chat, etc.).
    const page = await browser.newPage({ userAgent: config.BROWSER_USER_AGENT });
    page.setDefaultTimeout(config.NAVIGATION_TIMEOUT_MS);

    await irConReintento(page, config.SIMIT_BASE_URL, { waitUntil: "domcontentloaded" });
    // Le da tiempo al SPA (Angular) y al widget de Turnstile a terminar de
    // renderizar/resolverse antes de buscar el formulario.
    await page.waitForTimeout(3000);

    if (await hayCaptcha(page)) {
      return emptyResult({
        estado_consulta: config.ESTADOS_CONSULTA.BLOQUEADO,
        mensaje_error: "El portal SIMIT presento un desafio CAPTCHA antes de poder consultar la placa"
      });
    }

    // El campo de busqueda es compartido (placa o numero de documento).
    await page.fill(config.SELECTORS.placaInput, placaNormalizada);
    await page.click(config.SELECTORS.searchButton);

    const race = await Promise.race([
      page.waitForSelector(config.SELECTORS.resultsTable, { timeout: config.RESULT_TIMEOUT_MS }).then(() => "resultados"),
      page.waitForSelector(config.SELECTORS.emptyState, { timeout: config.RESULT_TIMEOUT_MS }).then(() => "vacio"),
      page.waitForSelector(config.SELECTORS.captchaMarker, { timeout: config.RESULT_TIMEOUT_MS }).then(() => "captcha")
    ]).catch(() => "timeout");

    if (race === "captcha") {
      return emptyResult({
        estado_consulta: config.ESTADOS_CONSULTA.BLOQUEADO,
        mensaje_error: "El portal SIMIT solicito verificacion CAPTCHA al consultar la placa"
      });
    }

    if (race === "timeout") {
      return emptyResult({
        estado_consulta: config.ESTADOS_CONSULTA.ERROR,
        mensaje_error: "El portal SIMIT no respondio dentro del tiempo esperado"
      });
    }

    if (race === "vacio") {
      return emptyResult({ estado_cartera: config.ESTADOS_CARTERA.SIN_MULTAS });
    }

    await page.waitForTimeout(500);
    // Secuencial, no en paralelo: extraerMuestraComparendos cambia el tamano
    // de pagina (#pageLengthSelect), lo que dispara un re-render de Angular
    // que puede dejar momentaneamente vacia la tarjeta Resumen. Si se lee en
    // paralelo, leerResumen puede capturar ese estado transitorio y devolver
    // 0 aunque si existan comparendos (bug detectado con datos reales).
    const resumen = await leerResumen(page);
    const comparendos = await extraerMuestraComparendos(page);

    // Salvaguarda: el conteo real extraido de la tabla nunca puede superar al
    // del Resumen. Si el Resumen llego en 0 (u otro valor inconsistente) pero
    // si se extrajeron filas reales, se confia en lo efectivamente encontrado.
    const totalComparendos = Math.max(resumen?.totalComparendos ?? 0, comparendos.length);
    const valorTotal = resumen ? resumen.valorTotal : comparendos.reduce((sum, item) => sum + Number(item.valor || 0), 0);
    const estadoCartera = calcularEstadoCartera({
      totalComparendosResumen: totalComparendos,
      acuerdosPagoResumen: resumen?.acuerdosPago ?? 0,
      comparendosMuestra: comparendos
    });

    return emptyResult({
      estado_cartera: estadoCartera,
      comparendos,
      total_comparendos: totalComparendos,
      valor_total: valorTotal
    });
  } catch (error) {
    return emptyResult({
      estado_consulta: config.ESTADOS_CONSULTA.ERROR,
      mensaje_error: error.message
    });
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = { scrapePlaca };
