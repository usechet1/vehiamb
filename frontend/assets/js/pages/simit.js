const kpisGrid = document.getElementById("simitKpisGrid");
const filterForm = document.getElementById("simitFilterForm");
const filterVehiculo = document.getElementById("filterSimitVehiculo");
const filterEstado = document.getElementById("filterSimitEstado");
const filterFechaDesde = document.getElementById("filterSimitFechaDesde");
const filterFechaHasta = document.getElementById("filterSimitFechaHasta");
const filterSummary = document.getElementById("simitFilterSummary");
const clearFiltersButton = document.getElementById("clearSimitFiltersButton");
const flotaList = document.getElementById("simitFlotaList");
const actualizarFlotaButton = document.getElementById("actualizarFlotaButton");
const loader = document.getElementById("loader");
const mensaje = document.getElementById("mensaje");

const simitDrawer = document.getElementById("simitDrawer");
const simitDrawerBackdrop = document.getElementById("simitDrawerBackdrop");
const closeSimitDrawer = document.getElementById("closeSimitDrawer");
const simitDrawerTitle = document.getElementById("simitDrawerTitle");
const simitDrawerSubtitle = document.getElementById("simitDrawerSubtitle");
const simitDrawerBody = document.getElementById("simitDrawerBody");
const simitDrawerConsultarButton = document.getElementById("simitDrawerConsultarButton");
const simitDrawerPagarButton = document.getElementById("simitDrawerPagarButton");
const exportSimitPdfButton = document.getElementById("exportSimitPdfButton");
const exportSimitExcelButton = document.getElementById("exportSimitExcelButton");

// El portal SIMIT es una SPA que no soporta pre-llenar la placa por URL
// (verificado probando varios formatos de query param): el link solo puede
// llevar al buscador, por eso se copia la placa al portapapeles al abrirlo.
const SIMIT_PORTAL_URL = "https://www.fcm.org.co/simit/#/estado-cuenta";

let flotaState = [];
let currentDrawerVehiculoId = null;
// Contexto completo del vehículo actualmente abierto en el drawer (fila de
// flota, historial de consultas y detalle/comparendos de la última
// consulta), para que los botones de exportar PDF/Excel no tengan que
// volver a pedir nada al backend.
let currentDrawerContext = null;

const ESTADO_LABELS = {
    nunca_consultado: "Nunca consultado",
    sin_multas: "Sin multas",
    con_multas: "Con multas",
    cobro_coactivo: "Cobro coactivo",
    acuerdo_pago: "Acuerdo de pago",
    desconocido: "Desconocido / error"
};

// Solo para los KPIs de resumen: cada conteo es de VEHICULOS en ese estado
// (uno por placa, segun su ultima consulta), no de multas individuales -- un
// vehiculo puede tener varios comparendos y solo cuenta una vez aqui. Se usa
// una etiqueta distinta a ESTADO_LABELS (la de los pills del listado) para
// dejarlo explicito y evitar la ambiguedad de "Con multas: 5".
const ESTADO_KPI_LABEL = {
    nunca_consultado: "Nunca consultados",
    acuerdo_pago: "Vehículos en acuerdo de pago",
    desconocido: "Consulta con error"
};

const ESTADO_PILL_CLASS = {
    nunca_consultado: "pill",
    sin_multas: "pill-success",
    con_multas: "pill-danger",
    cobro_coactivo: "pill-danger",
    acuerdo_pago: "pill-warning",
    desconocido: "pill"
};

// Orden de severidad para la lista: lo mas urgente de resolver primero.
const ESTADO_SEVERIDAD = {
    cobro_coactivo: 0,
    con_multas: 1,
    acuerdo_pago: 2,
    desconocido: 3,
    nunca_consultado: 4,
    sin_multas: 5
};

// Cobro coactivo implica proceso de embargo/jurídico (lo más grave: hay que
// distinguirlo visualmente de "con multas", que aun no llega a ese punto) --
// mismo tono base que --color-primary pero mas oscuro/intenso.
const ESTADO_KPI_ACCENT = {
    cobro_coactivo: "#7a1420",
    con_multas: "var(--color-primary)",
    acuerdo_pago: "var(--color-warning)",
    sin_multas: "var(--color-success)",
    nunca_consultado: "var(--color-ink-soft)",
    desconocido: "var(--color-ink-soft)"
};

function formatCurrency(value) {
    return new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        maximumFractionDigits: 0
    }).format(Number(value || 0));
}

function formatDateTime(value) {
    if (!value) return "Nunca";
    return new Date(value).toLocaleString("es-CO", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function formatDate(value) {
    if (!value) return "Sin fecha";
    return new Date(value).toLocaleDateString("es-CO", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// El backend solo informa estado_cartera cuando la consulta existió y salió
// "ok". Aquí se deriva la categoría visual que combina los tres casos: nunca
// consultado, consulta fallida/bloqueada, o el estado de cartera real.
function deriveEstadoCartera(row) {
    if (!row.id) return "nunca_consultado";
    if (row.estado_consulta !== "ok") return "desconocido";
    return row.estado_cartera || "desconocido";
}

function estadoLabel(estado) {
    return ESTADO_LABELS[estado] || estado;
}

function estadoPillClass(estado) {
    return ESTADO_PILL_CLASS[estado] || "pill";
}

// Top N vehiculos con mas comparendos vigentes, segun la ultima consulta de
// cada uno (mismo dato ya cargado en flotaState, sin llamada adicional al
// backend).
function topVehiculosPorComparendos(rows, top = 3) {
    return rows
        .filter((row) => Number(row.total_comparendos) > 0)
        .sort((a, b) => Number(b.total_comparendos) - Number(a.total_comparendos))
        .slice(0, top);
}

// Suma del valor_total (deuda vigente segun la ultima consulta) de todos
// los vehiculos de la flota, sin importar el estado de cartera -- los que
// estan "sin multas"/"nunca consultado" ya aportan 0, asi que no hace falta
// filtrarlos aparte.
function valorTotalEnRiesgo(rows) {
    return rows.reduce((total, row) => total + Number(row.valor_total || 0), 0);
}

// "Al dia" = sin multas vigentes segun la ultima consulta registrada. Los
// vehiculos "nunca consultados" no cuentan ni a favor ni en contra (no hay
// forma de saber su estado real), pero si se incluyen en el denominador
// para que el porcentaje refleje la flota completa.
function flotaAlDia(rows) {
    const total = rows.length;
    const alDia = rows.filter((row) => deriveEstadoCartera(row) === "sin_multas").length;
    const porcentaje = total ? Math.round((alDia / total) * 100) : 0;
    return { alDia, total, porcentaje };
}

// Vehiculos cuya ultima consulta ya tiene mas de "dias" de antiguedad --
// los "nunca consultados" (fecha_consulta null) no cuentan aqui, ya tienen
// su propio KPI aparte.
function vehiculosDesactualizados(rows, dias = 30) {
    const limite = Date.now() - dias * 24 * 60 * 60 * 1000;
    return rows.filter((row) => row.fecha_consulta && new Date(row.fecha_consulta).getTime() < limite).length;
}

// Compara el valor total actual contra el de hace N dias (obtenido del
// backend, ver getSimitValorHistorico) y arma un texto de tendencia. Un
// aumento de deuda es una mala noticia (rojo); una disminucion es buena
// (verde).
function formatTendencia(actual, anterior, dias) {
    if (anterior === null || anterior === undefined) return null;

    const diferencia = actual - anterior;
    if (diferencia === 0) return { texto: `Sin cambio vs. hace ${dias} días`, clase: "" };

    const flecha = diferencia > 0 ? "▲" : "▼";
    const magnitud = anterior > 0
        ? `${Math.round((Math.abs(diferencia) / anterior) * 100)}%`
        : formatCurrency(Math.abs(diferencia));

    return {
        texto: `${flecha} ${magnitud} vs. hace ${dias} días`,
        clase: diferencia > 0 ? "kpi-sub-bad" : "kpi-sub-good"
    };
}

// Mismo criterio que home.js pintarComparendos(): total de comparendos de
// la flota (suma de la ultima consulta de cada vehiculo) con un sub-texto
// que prioriza la novedad mas grave (cobro coactivo > con multas).
function totalComparendosInfo(rows, conteos) {
    const total = rows.reduce((sum, row) => sum + Number(row.total_comparendos || 0), 0);

    if (conteos.cobro_coactivo) {
        return { total, texto: `${conteos.cobro_coactivo} en cobro coactivo`, clase: "kpi-sub-bad", accent: ESTADO_KPI_ACCENT.cobro_coactivo };
    }
    if (conteos.con_multas) {
        return {
            total,
            texto: `Afecta a ${conteos.con_multas} vehículo${conteos.con_multas === 1 ? "" : "s"}`,
            clase: "",
            accent: ESTADO_KPI_ACCENT.acuerdo_pago
        };
    }
    return { total, texto: total ? "" : "Sin comparendos", clase: "", accent: "var(--color-ink-soft)" };
}

function renderSummary(rows, valorHistorico, infractorTop) {
    const conteos = rows.reduce((acc, row) => {
        const estado = deriveEstadoCartera(row);
        acc[estado] = (acc[estado] || 0) + 1;
        return acc;
    }, {});

    // "sin_multas" no se repite aqui: ya lo cubre el KPI "Flota al dia". Los
    // conteos de "con_multas"/"cobro_coactivo" por vehiculo tampoco se
    // repiten como tarjetas propias: quedan resumidos en "Total comparendos".
    const orden = ["acuerdo_pago", "nunca_consultado", "desconocido"];
    const topVehiculos = topVehiculosPorComparendos(rows, 3);
    const valorRiesgo = valorTotalEnRiesgo(rows);
    const alDia = flotaAlDia(rows);
    const desactualizados = vehiculosDesactualizados(rows);
    const tendencia = valorHistorico ? formatTendencia(valorRiesgo, valorHistorico.valor_total, valorHistorico.dias) : null;
    const conComparendos = rows.filter((row) => Number(row.total_comparendos) > 0).length;
    const totalComparendos = totalComparendosInfo(rows, conteos);
    const topInfractores = infractorTop || [];

    kpisGrid.innerHTML = `
        <div class="kpi-card clickable-record" style="--kpi-accent: ${totalComparendos.accent}" data-accion="ranking-comparendos" tabindex="0" role="button" aria-label="Ver vehículos con comparendos">
            <div class="kpi-label">Total comparendos</div>
            <div class="kpi-value">${totalComparendos.total}</div>
            ${totalComparendos.texto ? `<div class="kpi-sub ${totalComparendos.clase}">${totalComparendos.texto}</div>` : ""}
        </div>
        <div class="kpi-card" style="--kpi-accent: var(--color-primary)">
            <div class="kpi-label">Valor total comparendos</div>
            <div class="kpi-value">${formatCurrency(valorRiesgo)}</div>
            ${tendencia ? `<div class="kpi-sub ${tendencia.clase}">${tendencia.texto}</div>` : ""}
        </div>
        <div class="kpi-card" style="--kpi-accent: var(--color-success)">
            <div class="kpi-label">Flota al día</div>
            <div class="kpi-value">${alDia.alDia}/${alDia.total}</div>
            <div class="kpi-sub">${alDia.porcentaje}% sin multas${desactualizados ? ` · ${desactualizados} sin consultar hace +30 días` : ""}</div>
        </div>
        ${orden
            .filter((estado) => conteos[estado])
            .map((estado) => `
                <div class="kpi-card clickable-record" style="--kpi-accent: ${ESTADO_KPI_ACCENT[estado]}" data-filter-estado="${estado}" tabindex="0" role="button" aria-label="Ver vehículos en estado ${estadoLabel(estado)}">
                    <div class="kpi-label">${ESTADO_KPI_LABEL[estado] || estadoLabel(estado)}</div>
                    <div class="kpi-value">${conteos[estado]}</div>
                </div>
            `)
            .join("")}
        ${topVehiculos.length ? `
            <div class="kpi-card" style="--kpi-accent: var(--color-primary)">
                <div class="kpi-label">Top vehículos</div>
                <div class="kpi-top-list">
                    ${topVehiculos.map((vehiculo, indice) => `
                        <div class="kpi-top-item clickable-record" data-vehiculo-id="${vehiculo.vehiculo_id}" tabindex="0" role="button" aria-label="Ver detalle SIMIT de ${escapeHtml(vehiculo.placa || "")}">
                            ${indice + 1}. ${escapeHtml(vehiculo.placa || "Sin placa")} (${vehiculo.total_comparendos})
                        </div>
                    `).join("")}
                </div>
                ${conComparendos > topVehiculos.length ? `<button type="button" class="kpi-mini-link" data-accion="ranking-comparendos">Ver ranking completo (${conComparendos})</button>` : ""}
            </div>
        ` : ""}
        ${topInfractores.length ? `
            <div class="kpi-card" style="--kpi-accent: var(--color-primary)">
                <div class="kpi-label">Top conductores</div>
                <div class="kpi-top-list">
                    ${topInfractores.map((infractor, indice) => `
                        <div class="kpi-top-item">${indice + 1}. ${escapeHtml(infractor.nombre_infractor || "Nombre no disponible")} (${infractor.total_comparendos})</div>
                    `).join("")}
                </div>
            </div>
        ` : ""}
    `;
}

function fillVehiculoFilterOptions(rows) {
    const previousValue = filterVehiculo.value;
    const ordenadas = [...rows].sort((a, b) => (a.placa || "").localeCompare(b.placa || ""));

    filterVehiculo.innerHTML = '<option value="">Todos los vehículos</option>' +
        ordenadas
            .map((row) => `<option value="${row.vehiculo_id}">${escapeHtml(row.placa || "Sin placa")} - ${escapeHtml(row.marca || "")} ${escapeHtml(row.modelo || "")}</option>`)
            .join("");

    if (previousValue && rows.some((row) => String(row.vehiculo_id) === previousValue)) {
        filterVehiculo.value = previousValue;
    }
}

function matchesFilters(row) {
    const vehiculoId = filterVehiculo.value;
    const estado = filterEstado.value;
    const fechaDesde = filterFechaDesde.value;
    const fechaHasta = filterFechaHasta.value;

    if (vehiculoId && String(row.vehiculo_id) !== vehiculoId) return false;
    if (estado && deriveEstadoCartera(row) !== estado) return false;

    if (fechaDesde || fechaHasta) {
        if (!row.fecha_consulta) return false;
        const fechaConsulta = String(row.fecha_consulta).slice(0, 10);
        if (fechaDesde && fechaConsulta < fechaDesde) return false;
        if (fechaHasta && fechaConsulta > fechaHasta) return false;
    }

    return true;
}

function updateFilterSummary(filteredCount) {
    const total = flotaState.length;
    const hasFilters = Boolean(filterVehiculo.value || filterEstado.value || filterFechaDesde.value || filterFechaHasta.value);

    if (!total) {
        filterSummary.textContent = "Aún no hay vehículos registrados.";
        return;
    }

    filterSummary.textContent = hasFilters
        ? `Mostrando ${filteredCount} de ${total} vehículos.`
        : `Mostrando todos los vehículos (${total}).`;
}

function ordenarPorSeveridad(rows) {
    return [...rows].sort((a, b) => {
        const severidadA = ESTADO_SEVERIDAD[deriveEstadoCartera(a)] ?? 99;
        const severidadB = ESTADO_SEVERIDAD[deriveEstadoCartera(b)] ?? 99;
        return severidadA - severidadB;
    });
}

function renderFlotaList(rows, { ordenar = true } = {}) {
    if (!rows.length) {
        flotaList.innerHTML = '<p class="dash-empty">No hay vehículos para los filtros seleccionados</p>';
        return;
    }

    const filas = ordenar ? ordenarPorSeveridad(rows) : rows;

    flotaList.innerHTML = filas.map((row) => {
        const estado = deriveEstadoCartera(row);

        return `
            <article class="record-item clickable-record" data-vehiculo-id="${row.vehiculo_id}" tabindex="0" role="button" aria-label="Ver detalle SIMIT de ${row.placa || ""}">
                <div class="record-top">
                    <div>
                        <span class="record-title">${escapeHtml(row.placa || "Sin placa")}</span>
                        <span class="record-sub">${escapeHtml(row.marca || "")} ${escapeHtml(row.modelo || "")}</span>
                    </div>
                    <span class="pill ${estadoPillClass(estado)}">${estadoLabel(estado)}</span>
                </div>
                <div class="record-meta">
                    <span class="pill">Comparendos: ${row.total_comparendos ?? 0}</span>
                    <span class="pill">${formatCurrency(row.valor_total)}</span>
                    <span class="pill">Última consulta: ${formatDateTime(row.fecha_consulta)}</span>
                </div>
                <div class="simit-card-actions">
                    <button type="button" class="btn-secondary" data-consultar-id="${row.vehiculo_id}">Consultar ahora</button>
                </div>
            </article>
        `;
    }).join("");
}

function applyFilters() {
    const filtered = flotaState.filter(matchesFilters);
    renderFlotaList(filtered);
    updateFilterSummary(filtered.length);
}

async function cargarFlota() {
    try {
        window.VehiAmb.ui.show(loader);
        const [flota, valorHistorico, infractorTop] = await Promise.all([
            window.VehiAmb.api.getSimitEstadoFlota(),
            window.VehiAmb.api.getSimitValorHistorico(30).catch(() => null),
            window.VehiAmb.api.getSimitInfractorTop().catch(() => null)
        ]);
        flotaState = flota;
        renderSummary(flotaState, valorHistorico, infractorTop);
        fillVehiculoFilterOptions(flotaState);
        applyFilters();
    } catch (error) {
        console.error(error);
        flotaList.innerHTML = '<p class="dash-empty">No fue posible cargar el estado SIMIT de la flota</p>';
        window.VehiAmb.ui.showMessage(mensaje, "No fue posible cargar el estado SIMIT de la flota", "error");
    } finally {
        window.VehiAmb.ui.hide(loader);
    }
}

// Filtra el listado de abajo por un estado de cartera especifico (desde un
// KPI de "Con multas"/"Cobro coactivo"/etc.) y hace scroll hasta el.
function filtrarPorEstadoYScroll(estado) {
    filterEstado.value = estado;
    applyFilters();
    flotaList.scrollIntoView({ behavior: "smooth", block: "start" });
}

// Vista temporal: ordena el listado por total_comparendos descendente en
// vez de por severidad de estado, para ver de un vistazo cuales vehiculos
// concentran mas comparendos. Se pierde al tocar cualquier filtro (vuelve
// al orden normal via applyFilters).
function mostrarRankingComparendos() {
    const conComparendos = flotaState
        .filter((row) => Number(row.total_comparendos) > 0)
        .sort((a, b) => Number(b.total_comparendos) - Number(a.total_comparendos));

    renderFlotaList(conComparendos, { ordenar: false });
    filterSummary.textContent = `Ranking por comparendos: ${conComparendos.length} vehículos con comparendos vigentes.`;
    flotaList.scrollIntoView({ behavior: "smooth", block: "start" });
}

// Cedula/nombre del infractor se obtienen del propio portal SIMIT: al hacer
// clic en cada fila de su tabla de resultados, SIMIT expande un panel "Datos
// conductor" que el scraper lee (ver simit-scraper.js). SIMIT los muestra
// parcialmente enmascarados por proteccion de datos (ej. "JU** CAR***",
// "10496*****") -- es el mismo dato que veria cualquiera en el portal
// publico, no un valor completo, y aqui solo se despliega tal cual llega.
function renderComparendosTable(comparendos) {
    if (!comparendos || !comparendos.length) {
        return '<p class="dash-empty detail-empty">No hay comparendos registrados en esta consulta.</p>';
    }

    return `
        <div class="table-scroll">
            <table class="import-table">
                <thead>
                    <tr>
                        <th>Número</th>
                        <th>Fecha</th>
                        <th>Descripción</th>
                        <th>Valor</th>
                        <th>Estado</th>
                        <th>Cédula infractor</th>
                        <th>Nombre infractor</th>
                        <th>Conductor identificado</th>
                    </tr>
                </thead>
                <tbody>
                    ${comparendos.map((item) => `
                        <tr>
                            <td>${escapeHtml(item.numero_comparendo)}</td>
                            <td>${item.fecha_infraccion ? formatDate(item.fecha_infraccion) : "Sin fecha"}</td>
                            <td>${escapeHtml(item.descripcion || "Sin descripción")}</td>
                            <td>${formatCurrency(item.valor)}</td>
                            <td>${escapeHtml(item.estado)}</td>
                            <td>${escapeHtml(item.cedula_infractor || "No disponible")}</td>
                            <td>${escapeHtml(item.nombre_infractor || "No disponible")}</td>
                            <td>${item.conductor_id ? `<span class="pill pill-success">${escapeHtml(`${item.conductor_nombres || ""} ${item.conductor_apellidos || ""}`.trim())}</span>` : '<span class="pill">No identificado</span>'}</td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        </div>
    `;
}

function renderHistorialTable(historial) {
    if (!historial.length) {
        return '<p class="dash-empty detail-empty">Este vehículo aún no tiene consultas SIMIT registradas.</p>';
    }

    return `
        <div class="table-scroll">
            <table class="import-table">
                <thead>
                    <tr>
                        <th>Fecha</th>
                        <th>Origen</th>
                        <th>Resultado</th>
                        <th>Estado cartera</th>
                        <th>Comparendos</th>
                        <th>Valor total</th>
                    </tr>
                </thead>
                <tbody>
                    ${historial.map((item) => `
                        <tr>
                            <td>${formatDateTime(item.fecha_consulta)}</td>
                            <td>${item.origen === "masivo" ? "Actualización de flota" : "Manual"}</td>
                            <td>${item.estado_consulta === "ok" ? "OK" : escapeHtml(item.estado_consulta)}</td>
                            <td>${estadoLabel(item.estado_consulta === "ok" ? item.estado_cartera : "desconocido")}</td>
                            <td>${item.total_comparendos ?? 0}</td>
                            <td>${formatCurrency(item.valor_total)}</td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        </div>
    `;
}

async function openSimitDetail(vehiculoId) {
    const row = flotaState.find((item) => String(item.vehiculo_id) === String(vehiculoId));
    if (!row) return;

    currentDrawerVehiculoId = vehiculoId;
    currentDrawerContext = null;
    simitDrawerTitle.textContent = row.placa || "Vehículo";
    simitDrawerSubtitle.textContent = `${row.marca || ""} ${row.modelo || ""}`.trim() || "Sin información de vehículo";
    simitDrawerBody.innerHTML = '<p class="dash-empty">Cargando historial SIMIT...</p>';

    window.VehiAmb.ui.show(simitDrawerBackdrop);
    window.VehiAmb.ui.show(simitDrawer);
    simitDrawer.setAttribute("aria-hidden", "false");
    closeSimitDrawer.focus();

    try {
        const historial = await window.VehiAmb.api.getSimitHistorialVehiculo(vehiculoId);
        const ultima = historial[0];
        const detalle = ultima ? await window.VehiAmb.api.getSimitConsultaDetalle(ultima.id) : null;
        const estado = deriveEstadoCartera(row);
        currentDrawerContext = { row, historial, detalle, estado };

        simitDrawerBody.innerHTML = `
            <dl class="detail-list drawer-detail-list">
                <div>
                    <dt>Estado actual</dt>
                    <dd><span class="pill ${estadoPillClass(estado)}">${estadoLabel(estado)}</span></dd>
                </div>
                <div>
                    <dt>Comparendos vigentes</dt>
                    <dd>${row.total_comparendos ?? 0}</dd>
                </div>
                <div>
                    <dt>Valor total</dt>
                    <dd>${formatCurrency(row.valor_total)}</dd>
                </div>
                <div>
                    <dt>Última consulta</dt>
                    <dd>${formatDateTime(row.fecha_consulta)}</dd>
                </div>
            </dl>

            ${row.mensaje_error ? `<p class="dash-empty detail-empty">Último error: ${escapeHtml(row.mensaje_error)}</p>` : ""}

            <section class="drawer-section">
                <h3>Comparendos de la última consulta</h3>
                ${renderComparendosTable(detalle?.comparendos)}
            </section>

            <section class="drawer-section">
                <h3>Historial de consultas</h3>
                ${renderHistorialTable(historial)}
            </section>
        `;
    } catch (error) {
        console.error(error);
        simitDrawerBody.innerHTML = '<p class="dash-empty detail-empty">No fue posible cargar el historial SIMIT de este vehículo.</p>';
    }
}

function closeDetailDrawer() {
    window.VehiAmb.ui.hide(simitDrawerBackdrop);
    window.VehiAmb.ui.hide(simitDrawer);
    simitDrawer.setAttribute("aria-hidden", "true");
    currentDrawerVehiculoId = null;
    currentDrawerContext = null;
}

async function consultarVehiculoManual(vehiculoId) {
    try {
        window.VehiAmb.ui.show(loader);
        await window.VehiAmb.api.consultarSimitVehiculo(vehiculoId);
        window.VehiAmb.ui.showMessage(mensaje, "Consulta SIMIT actualizada correctamente");
        await cargarFlota();

        if (String(currentDrawerVehiculoId) === String(vehiculoId)) {
            await openSimitDetail(vehiculoId);
        }
    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudo consultar el estado SIMIT", "error");
    } finally {
        window.VehiAmb.ui.hide(loader);
    }
}

async function actualizarFlotaCompleta() {
    const confirmado = await window.VehiAmb.ui.confirm({
        title: "Actualizar toda la flota",
        message: `Se va a consultar el SIMIT para ${flotaState.length} ${flotaState.length === 1 ? "vehículo" : "vehículos"} de la flota. Puede tardar varios minutos.`,
        confirmText: "Actualizar flota"
    });
    if (!confirmado) return;

    try {
        window.VehiAmb.ui.show(loader);
        window.VehiAmb.ui.showMessage(mensaje, "Actualizando toda la flota, esto puede tardar varios minutos...");
        const resumen = await window.VehiAmb.api.actualizarSimitFlota();
        window.VehiAmb.ui.showMessage(
            mensaje,
            `Actualización completada: ${resumen.ok} ok, ${resumen.con_novedades} con novedades, ${resumen.bloqueado} bloqueadas, ${resumen.error} con error.`
        );
        await cargarFlota();
    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudo actualizar la flota", "error");
    } finally {
        window.VehiAmb.ui.hide(loader);
    }
}

filterForm.addEventListener("submit", (event) => {
    event.preventDefault();
});

[filterVehiculo, filterEstado, filterFechaDesde, filterFechaHasta].forEach((input) => {
    input.addEventListener("input", applyFilters);
    input.addEventListener("change", applyFilters);
});

clearFiltersButton.addEventListener("click", () => {
    filterForm.reset();
    applyFilters();
});

actualizarFlotaButton.addEventListener("click", actualizarFlotaCompleta);

flotaList.addEventListener("click", (event) => {
    const consultarButton = event.target.closest("[data-consultar-id]");
    if (consultarButton) {
        event.stopPropagation();
        consultarVehiculoManual(consultarButton.dataset.consultarId);
        return;
    }

    const card = event.target.closest("[data-vehiculo-id]");
    if (card) openSimitDetail(card.dataset.vehiculoId);
});

flotaList.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;

    const card = event.target.closest("[data-vehiculo-id]");
    if (!card) return;

    event.preventDefault();
    openSimitDetail(card.dataset.vehiculoId);
});

kpisGrid.addEventListener("click", (event) => {
    const rankingButton = event.target.closest('[data-accion="ranking-comparendos"]');
    if (rankingButton) {
        event.stopPropagation();
        mostrarRankingComparendos();
        return;
    }

    const filtroEstado = event.target.closest("[data-filter-estado]");
    if (filtroEstado) {
        filtrarPorEstadoYScroll(filtroEstado.dataset.filterEstado);
        return;
    }

    const card = event.target.closest("[data-vehiculo-id]");
    if (card) openSimitDetail(card.dataset.vehiculoId);
});

kpisGrid.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;

    const rankingButton = event.target.closest('[data-accion="ranking-comparendos"]');
    if (rankingButton) {
        event.preventDefault();
        mostrarRankingComparendos();
        return;
    }

    const filtroEstado = event.target.closest("[data-filter-estado]");
    if (filtroEstado) {
        event.preventDefault();
        filtrarPorEstadoYScroll(filtroEstado.dataset.filterEstado);
        return;
    }

    const card = event.target.closest("[data-vehiculo-id]");
    if (!card) return;

    event.preventDefault();
    openSimitDetail(card.dataset.vehiculoId);
});

closeSimitDrawer.addEventListener("click", closeDetailDrawer);
simitDrawerBackdrop.addEventListener("click", closeDetailDrawer);
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !simitDrawer.classList.contains("hidden")) {
        closeDetailDrawer();
    }
});

simitDrawerConsultarButton.addEventListener("click", () => {
    if (currentDrawerVehiculoId) consultarVehiculoManual(currentDrawerVehiculoId);
});

simitDrawerPagarButton.addEventListener("click", async () => {
    const placa = currentDrawerContext?.row?.placa;

    if (placa && navigator.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(placa);
            window.VehiAmb.ui.showMessage(mensaje, `Placa ${placa} copiada. Pégala en el buscador de SIMIT.`);
        } catch (error) {
            console.error(error);
        }
    }

    window.open(SIMIT_PORTAL_URL, "_blank", "noopener,noreferrer");
});

exportSimitPdfButton.addEventListener("click", async () => {
    if (!currentDrawerContext) return;

    const originalLabel = exportSimitPdfButton.textContent;
    exportSimitPdfButton.disabled = true;
    exportSimitPdfButton.textContent = "Generando...";

    try {
        await window.VehiAmb.simit.exportComparendosPdf(currentDrawerContext);
    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudo exportar el PDF", "error");
    } finally {
        exportSimitPdfButton.disabled = false;
        exportSimitPdfButton.textContent = originalLabel;
    }
});

exportSimitExcelButton.addEventListener("click", async () => {
    if (!currentDrawerContext) return;

    const originalLabel = exportSimitExcelButton.textContent;
    exportSimitExcelButton.disabled = true;
    exportSimitExcelButton.textContent = "Generando...";

    try {
        await window.VehiAmb.simit.exportComparendosExcel(currentDrawerContext);
    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudo exportar el Excel", "error");
    } finally {
        exportSimitExcelButton.disabled = false;
        exportSimitExcelButton.textContent = originalLabel;
    }
});

document.addEventListener("DOMContentLoaded", cargarFlota);
