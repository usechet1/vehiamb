const kpisGrid = document.getElementById("simitKpisGrid");
const filterForm = document.getElementById("simitFilterForm");
const filterBusqueda = document.getElementById("filterSimitBusqueda");
const filterEstadoTrigger = document.getElementById("filterSimitEstadoTrigger");
const filterEstadoTriggerLabel = document.getElementById("filterSimitEstadoTriggerLabel");
const filterEstadoPopover = document.getElementById("filterSimitEstadoPopover");
const filterConductorTrigger = document.getElementById("filterSimitConductorTrigger");
const filterConductorTriggerLabel = document.getElementById("filterSimitConductorTriggerLabel");
const filterConductorPopover = document.getElementById("filterSimitConductorPopover");
const filterFechasTrigger = document.getElementById("filterSimitFechasTrigger");
const filterFechasTriggerLabel = document.getElementById("filterSimitFechasTriggerLabel");
const filterFechasPopover = document.getElementById("filterSimitFechasPopover");
const filterFechaDesde = document.getElementById("filterSimitFechaDesde");
const filterFechaHasta = document.getElementById("filterSimitFechaHasta");
const filterChips = document.getElementById("simitFilterChips");
const filterSummary = document.getElementById("simitFilterSummary");
const clearFiltersButton = document.getElementById("clearSimitFiltersButton");
const flotaList = document.getElementById("simitFlotaList");
const rankingsContainer = document.getElementById("simitRankings");
const simitSyncNote = document.getElementById("simitSyncNote");
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

// Disparar una consulta real a SIMIT (individual o de toda la flota) tiene
// costo/limite -- igual que "Actualizar toda la flota", solo Administrador
// puede iniciarlas. El resto de roles con simit.view solo puede ver lo ya
// consultado (drawer, filtros, exportar).
const puedeConsultarSimit = Boolean(window.VehiAmb.auth?.hasPermission?.("simit.manage"));
if (!puedeConsultarSimit) {
    simitDrawerConsultarButton.classList.add("hidden");
}

let flotaState = [];
let fechaLoteState = null;
let filtroEstadoValue = "";
let filtroConductorValue = "";
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

// Cobro coactivo (proceso de embargo/juridico) es la unica severidad que
// merece el rojo institucional. "Con multas" todavia es pagable con
// descuento -- mismo tono ambar que "acuerdo de pago", no rojo.
const ESTADO_PILL_CLASS = {
    nunca_consultado: "pill",
    sin_multas: "pill-success",
    con_multas: "pill-warning",
    cobro_coactivo: "pill-danger",
    acuerdo_pago: "pill-warning",
    desconocido: "pill"
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
function topVehiculosPorComparendos(rows, top = 5) {
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

// La hora de "ultima consulta" es casi identica en las 25 filas porque viene
// de un mismo job nocturno -- es una propiedad del LOTE, no de cada
// vehiculo. Se calcula una sola vez (la fecha_consulta mas reciente de toda
// la flota) para mostrarla arriba, en el encabezado de la seccion, en vez de
// repetirla en cada fila.
function calcularSincronizacionLote(rows) {
    const fechas = rows.map((row) => row.fecha_consulta).filter(Boolean).sort();
    if (!fechas.length) return null;
    return fechas[fechas.length - 1];
}

function formatSyncNote(fechaLote) {
    if (!fechaLote) return "";

    const fecha = new Date(fechaLote);
    const esHoy = fecha.toDateString() === new Date().toDateString();
    const hora = fecha.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });

    return esHoy ? `· Sincronizado hoy, ${hora}` : `· Última sincronización: ${formatDate(fechaLote)}, ${hora}`;
}

// Solo las filas que YA tienen consulta pero quedaron fuera del ultimo lote
// (ej. fallo esa noche, o el vehiculo se agrego despues) necesitan su propia
// fecha visible, y en ambar -- son la excepcion, no la regla. Los "nunca
// consultados" no cuentan aqui, ya tienen su propio estado/pill.
function esConsultaDesactualizada(row, fechaLote) {
    if (!row.fecha_consulta || !fechaLote) return false;
    return new Date(row.fecha_consulta).toDateString() !== new Date(fechaLote).toDateString();
}

// Compara el valor total actual contra el de hace N dias (obtenido del
// backend, ver getSimitValorHistorico) y arma un texto de tendencia. Se usa
// la diferencia absoluta en pesos, no el porcentaje: partir de una base baja
// (o cero) infla cualquier porcentaje y lo vuelve inutil para leer -- "+$7.2M
// en 30 dias" se entiende de un vistazo, "+1150%" no. Un aumento de deuda es
// mala noticia (rojo); una disminucion es buena (verde).
function formatTendencia(actual, anterior, dias) {
    if (anterior === null || anterior === undefined) return null;

    const diferencia = actual - anterior;
    if (diferencia === 0) return { texto: `Sin cambio vs. hace ${dias} días`, clase: "" };

    const flecha = diferencia > 0 ? "▲" : "▼";

    return {
        texto: `${flecha} ${formatCurrency(Math.abs(diferencia))} vs. hace ${dias} días`,
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
    const topVehiculos = topVehiculosPorComparendos(rows, 5);
    const valorRiesgo = valorTotalEnRiesgo(rows);
    const alDia = flotaAlDia(rows);
    const desactualizados = vehiculosDesactualizados(rows);
    const tendencia = valorHistorico ? formatTendencia(valorRiesgo, valorHistorico.valor_total, valorHistorico.dias) : null;
    const conComparendos = rows.filter((row) => Number(row.total_comparendos) > 0).length;
    const totalComparendos = totalComparendosInfo(rows, conteos);
    const topInfractores = infractorTop || [];

    fechaLoteState = calcularSincronizacionLote(rows);
    simitSyncNote.textContent = formatSyncNote(fechaLoteState);

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
            <div class="kpi-bar"><div class="kpi-bar-fill" style="width: ${alDia.porcentaje}%"></div></div>
            ${desactualizados ? `<div class="kpi-sub">${desactualizados} sin consultar hace +30 días</div>` : ""}
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
    `;

    renderRankings(topVehiculos, topInfractores);
}

// Rankings van aparte de las tarjetas KPI -- un KPI se lee en un vistazo, un
// ranking de 5 nombres necesita una lista con barra proporcional para poder
// comparar magnitudes, no una tarjeta de texto de 11px.
function renderRankings(topVehiculos, topInfractores) {
    if (!topVehiculos.length && !topInfractores.length) {
        rankingsContainer.innerHTML = "";
        return;
    }

    const maxVehiculos = Math.max(...topVehiculos.map((v) => Number(v.total_comparendos)), 1);
    const maxInfractores = Math.max(...topInfractores.map((i) => Number(i.total_comparendos)), 1);

    rankingsContainer.innerHTML = `
        ${topVehiculos.length ? `
            <div class="simit-ranking-card">
                <h3>Top vehículos con comparendos</h3>
                <div class="simit-ranking-list">
                    ${topVehiculos.map((vehiculo, indice) => `
                        <div class="simit-ranking-item clickable-record" data-vehiculo-id="${vehiculo.vehiculo_id}" tabindex="0" role="button" aria-label="Ver detalle SIMIT de ${escapeHtml(vehiculo.placa || "")}">
                            <span class="simit-ranking-rank">${indice + 1}</span>
                            <div class="simit-ranking-main">
                                <div class="simit-ranking-row">
                                    <span class="simit-ranking-label">${escapeHtml(vehiculo.placa || "Sin placa")}</span>
                                    <span class="simit-ranking-value">${vehiculo.total_comparendos}</span>
                                </div>
                                <div class="simit-ranking-bar"><div class="simit-ranking-bar-fill" style="width: ${(Number(vehiculo.total_comparendos) / maxVehiculos * 100).toFixed(0)}%"></div></div>
                            </div>
                        </div>
                    `).join("")}
                </div>
            </div>
        ` : ""}
        ${topInfractores.length ? `
            <div class="simit-ranking-card">
                <h3>Top conductores</h3>
                <div class="simit-ranking-list">
                    ${topInfractores.map((infractor, indice) => `
                        <div class="simit-ranking-item">
                            <span class="simit-ranking-rank">${indice + 1}</span>
                            <div class="simit-ranking-main">
                                <div class="simit-ranking-row">
                                    <span class="simit-ranking-label${infractor.identificado ? "" : " simit-ranking-label--masked"}">${escapeHtml(infractor.nombre || "Nombre no disponible")}</span>
                                    <span class="simit-ranking-value">${infractor.total_comparendos}</span>
                                </div>
                                <div class="simit-ranking-bar"><div class="simit-ranking-bar-fill" style="width: ${(Number(infractor.total_comparendos) / maxInfractores * 100).toFixed(0)}%"></div></div>
                            </div>
                        </div>
                    `).join("")}
                </div>
            </div>
        ` : ""}
    `;
}

// Opciones del filtro por conductor: solo conductores que aparecen como
// infractores identificados en la ultima consulta de algun vehiculo (ver
// comparendo-conductor-matcher.js), no el catalogo completo de conductores.
// Se renderizan como botones de popover (mismo patron que Tipo en
// documentos.html), no como <option> nativas.
function fillConductorFilterOptions(rows) {
    const conductores = new Map();

    rows.forEach((row) => {
        (row.conductores || []).forEach((conductor) => {
            if (conductor.id) conductores.set(conductor.id, conductor.nombre);
        });
    });

    const ordenados = [...conductores.entries()].sort((a, b) => a[1].localeCompare(b[1]));

    if (filtroConductorValue && !conductores.has(Number(filtroConductorValue))) {
        filtroConductorValue = "";
    }

    filterConductorPopover.innerHTML = `
        <button type="button" class="doc-filter-option${filtroConductorValue ? "" : " is-active"}" data-conductor-value="">Todos</button>
        ${ordenados.map(([id, nombre]) => `
            <button type="button" class="doc-filter-option${String(id) === filtroConductorValue ? " is-active" : ""}" data-conductor-value="${id}">${escapeHtml(nombre)}</button>
        `).join("")}
    `;

    updateConductorTriggerLabel(conductores);
}

function updateConductorTriggerLabel(conductores) {
    const nombre = filtroConductorValue ? conductores.get(Number(filtroConductorValue)) : null;
    filterConductorTriggerLabel.textContent = nombre || "Conductor";
    filterConductorTrigger.classList.toggle("is-active", Boolean(filtroConductorValue));
}

function updateEstadoTriggerLabel() {
    filterEstadoTriggerLabel.textContent = filtroEstadoValue ? estadoLabel(filtroEstadoValue) : "Estado de cartera";
    filterEstadoTrigger.classList.toggle("is-active", Boolean(filtroEstadoValue));
    filterEstadoPopover.querySelectorAll("[data-estado-value]").forEach((boton) => {
        boton.classList.toggle("is-active", boton.dataset.estadoValue === filtroEstadoValue);
    });
}

function updateFechasTriggerLabel() {
    const hayFecha = filterFechaDesde.value || filterFechaHasta.value;
    filterFechasTrigger.classList.toggle("is-active", Boolean(hayFecha));
}

function matchesFilters(row) {
    const busqueda = filterBusqueda.value.trim().toLowerCase();
    const fechaDesde = filterFechaDesde.value;
    const fechaHasta = filterFechaHasta.value;

    if (busqueda) {
        const enPlaca = String(row.placa || "").toLowerCase().includes(busqueda);
        const enMarca = `${row.marca || ""} ${row.modelo || ""}`.toLowerCase().includes(busqueda);
        if (!enPlaca && !enMarca) return false;
    }
    if (filtroEstadoValue && deriveEstadoCartera(row) !== filtroEstadoValue) return false;
    if (filtroConductorValue && !(row.conductores || []).some((conductor) => String(conductor.id) === filtroConductorValue)) return false;

    if (fechaDesde || fechaHasta) {
        if (!row.fecha_consulta) return false;
        const fechaConsulta = String(row.fecha_consulta).slice(0, 10);
        if (fechaDesde && fechaConsulta < fechaDesde) return false;
        if (fechaHasta && fechaConsulta > fechaHasta) return false;
    }

    return true;
}

function hayFiltrosActivos() {
    return Boolean(filterBusqueda.value.trim() || filtroEstadoValue || filtroConductorValue || filterFechaDesde.value || filterFechaHasta.value);
}

function updateFilterSummary(filteredCount) {
    const total = flotaState.length;

    if (!total) {
        filterSummary.textContent = "Aún no hay vehículos registrados.";
    } else {
        filterSummary.textContent = hayFiltrosActivos()
            ? `Mostrando ${filteredCount} de ${total} vehículos.`
            : `Mostrando todos los vehículos (${total}).`;
    }

    renderFiltersChips();
}

// Cada filtro activo (menos la busqueda, que ya se ve escrita en el campo)
// queda como chip removible, igual que en documentos.html.
function renderFiltersChips() {
    const chips = [];

    if (filtroEstadoValue) {
        chips.push({ id: "estado", label: estadoLabel(filtroEstadoValue) });
    }
    if (filtroConductorValue) {
        chips.push({ id: "conductor", label: filterConductorTriggerLabel.textContent });
    }
    if (filterFechaDesde.value || filterFechaHasta.value) {
        const desde = filterFechaDesde.value ? formatDate(filterFechaDesde.value) : "…";
        const hasta = filterFechaHasta.value ? formatDate(filterFechaHasta.value) : "…";
        chips.push({ id: "fechas", label: `${desde} → ${hasta}` });
    }

    filterChips.classList.toggle("hidden", chips.length === 0);
    filterChips.innerHTML = chips.map((chip) => `
        <span class="pill">${escapeHtml(chip.label)} <button type="button" class="pill-remove" data-remove-chip="${chip.id}" aria-label="Quitar filtro">×</button></span>
    `).join("");
}

// Orden por defecto de la lista: la consulta mas reciente primero. Los
// vehiculos que nunca se han consultado (fecha_consulta null) quedan al
// final, sin importar que tan urgente sea su estado.
function ordenarPorFechaReciente(rows) {
    return [...rows].sort((a, b) => {
        if (!a.fecha_consulta && !b.fecha_consulta) return 0;
        if (!a.fecha_consulta) return 1;
        if (!b.fecha_consulta) return -1;
        return new Date(b.fecha_consulta) - new Date(a.fecha_consulta);
    });
}

// Las multas "con_multas"/"cobro_coactivo" son las unicas con algo que hacer
// de verdad -- ofrecer el atajo a SIMIT ahi es la accion que faltaba en la
// fila (junto con "ver detalle", que ya cubre el click en toda la tarjeta).
function tieneAccionDePago(estado) {
    return estado === "con_multas" || estado === "cobro_coactivo";
}

function renderFlotaList(rows, { ordenar = true } = {}) {
    if (!rows.length) {
        flotaList.innerHTML = '<p class="dash-empty">No hay vehículos para los filtros seleccionados</p>';
        return;
    }

    const filas = ordenar ? ordenarPorFechaReciente(rows) : rows;

    flotaList.innerHTML = filas.map((row) => {
        const estado = deriveEstadoCartera(row);
        const desactualizada = esConsultaDesactualizada(row, fechaLoteState);

        return `
            <article class="record-item clickable-record" data-vehiculo-id="${row.vehiculo_id}" tabindex="0" role="button" aria-label="Ver detalle SIMIT de ${row.placa || ""}">
                <div class="record-top">
                    <div>
                        <span class="record-title">${escapeHtml(row.placa || "Sin placa")}</span>
                        <span class="record-sub">${escapeHtml(row.marca || "")} ${escapeHtml(row.modelo || "")}</span>
                    </div>
                    <div class="simit-row-end">
                        <span class="simit-row-amount${Number(row.valor_total) ? "" : " simit-row-amount--muted"}">${Number(row.valor_total) ? formatCurrency(row.valor_total) : "Sin deuda"}</span>
                        <span class="pill ${estadoPillClass(estado)}">${estadoLabel(estado)}</span>
                    </div>
                </div>
                <div class="record-meta">
                    <span class="pill">Comparendos: ${row.total_comparendos ?? 0}</span>
                    ${desactualizada ? `<span class="simit-row-stale">⚠ Última consulta: ${formatDateTime(row.fecha_consulta)}</span>` : ""}
                </div>
                <div class="simit-card-actions">
                    <span class="record-link">Ver detalle →</span>
                    <div class="simit-card-actions-buttons">
                        ${tieneAccionDePago(estado) ? `<button type="button" class="btn-secondary btn-pagar" data-pagar-placa="${escapeHtml(row.placa || "")}">Pagar en SIMIT ↗</button>` : ""}
                        ${puedeConsultarSimit ? `<button type="button" class="btn-secondary" data-consultar-id="${row.vehiculo_id}">Consultar ahora</button>` : ""}
                    </div>
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
            window.VehiAmb.api.getSimitInfractorTop(5).catch(() => null)
        ]);
        flotaState = flota;
        renderSummary(flotaState, valorHistorico, infractorTop);
        fillConductorFilterOptions(flotaState);
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
    filtroEstadoValue = estado;
    updateEstadoTriggerLabel();
    applyFilters();
    flotaList.scrollIntoView({ behavior: "smooth", block: "start" });
}

// Vista temporal: ordena el listado por total_comparendos descendente en
// vez de por fecha de consulta, para ver de un vistazo cuales vehiculos
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
// publico, no un valor completo. Cuando el comparendo ya quedo vinculado a un
// conductor registrado (match automatico fuerte, ver
// comparendo-conductor-matcher.js), se muestra el nombre real sin mascara en
// vez del dato crudo de SIMIT.
function nombreInfractorReal(item) {
    if (item.conductor_id) {
        return `${item.conductor_nombres || ""} ${item.conductor_apellidos || ""}`.trim() || item.nombre_infractor;
    }
    return item.nombre_infractor;
}

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
                        <th>No.</th>
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
                            <td>${escapeHtml(item.numero_infraccion || "No disponible")}</td>
                            <td>${item.fecha_infraccion ? formatDate(item.fecha_infraccion) : "Sin fecha"}</td>
                            <td>${escapeHtml(item.descripcion || "Sin descripción")}</td>
                            <td>${formatCurrency(item.valor)}</td>
                            <td>${escapeHtml(item.estado)}</td>
                            <td>${escapeHtml(item.cedula_infractor || "No disponible")}</td>
                            <td>${escapeHtml(nombreInfractorReal(item) || "No disponible")}</td>
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

filterBusqueda.addEventListener("input", applyFilters);

[filterFechaDesde, filterFechaHasta].forEach((input) => {
    input.addEventListener("input", () => {
        updateFechasTriggerLabel();
        applyFilters();
    });
});

clearFiltersButton.addEventListener("click", () => {
    filterBusqueda.value = "";
    filterFechaDesde.value = "";
    filterFechaHasta.value = "";
    filtroEstadoValue = "";
    filtroConductorValue = "";
    updateEstadoTriggerLabel();
    fillConductorFilterOptions(flotaState);
    updateFechasTriggerLabel();
    applyFilters();
});

// Popovers de Estado/Conductor/Fechas: mismo patron de abrir-uno-cierra-los-
// demas y cerrar al hacer clic afuera que documentos.html.
function cerrarPopoversFiltro() {
    filterEstadoPopover.classList.add("hidden");
    filterConductorPopover.classList.add("hidden");
    filterFechasPopover.classList.add("hidden");
}

filterEstadoTrigger.addEventListener("click", (event) => {
    event.stopPropagation();
    const estabaAbierto = !filterEstadoPopover.classList.contains("hidden");
    cerrarPopoversFiltro();
    filterEstadoPopover.classList.toggle("hidden", estabaAbierto);
});

filterConductorTrigger.addEventListener("click", (event) => {
    event.stopPropagation();
    const estabaAbierto = !filterConductorPopover.classList.contains("hidden");
    cerrarPopoversFiltro();
    filterConductorPopover.classList.toggle("hidden", estabaAbierto);
});

filterFechasTrigger.addEventListener("click", (event) => {
    event.stopPropagation();
    const estabaAbierto = !filterFechasPopover.classList.contains("hidden");
    cerrarPopoversFiltro();
    filterFechasPopover.classList.toggle("hidden", estabaAbierto);
});

document.addEventListener("click", (event) => {
    if (!event.target.closest(".doc-filter-popover-wrap")) cerrarPopoversFiltro();
});

filterEstadoPopover.addEventListener("click", (event) => {
    const opcion = event.target.closest("[data-estado-value]");
    if (!opcion) return;

    filtroEstadoValue = opcion.dataset.estadoValue;
    updateEstadoTriggerLabel();
    cerrarPopoversFiltro();
    applyFilters();
});

filterConductorPopover.addEventListener("click", (event) => {
    const opcion = event.target.closest("[data-conductor-value]");
    if (!opcion) return;

    filtroConductorValue = opcion.dataset.conductorValue;
    fillConductorFilterOptions(flotaState);
    cerrarPopoversFiltro();
    applyFilters();
});

filterChips.addEventListener("click", (event) => {
    const boton = event.target.closest("[data-remove-chip]");
    if (!boton) return;

    if (boton.dataset.removeChip === "estado") {
        filtroEstadoValue = "";
        updateEstadoTriggerLabel();
    } else if (boton.dataset.removeChip === "conductor") {
        filtroConductorValue = "";
        fillConductorFilterOptions(flotaState);
    } else if (boton.dataset.removeChip === "fechas") {
        filterFechaDesde.value = "";
        filterFechaHasta.value = "";
        updateFechasTriggerLabel();
    }

    applyFilters();
});

actualizarFlotaButton.addEventListener("click", actualizarFlotaCompleta);

if (puedeConsultarSimit) {
    actualizarFlotaButton.classList.remove("hidden");
}

flotaList.addEventListener("click", (event) => {
    const pagarButton = event.target.closest("[data-pagar-placa]");
    if (pagarButton) {
        event.stopPropagation();
        copiarPlacaYAbrirSimit(pagarButton.dataset.pagarPlaca);
        return;
    }

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

rankingsContainer.addEventListener("click", (event) => {
    const item = event.target.closest("[data-vehiculo-id]");
    if (item) openSimitDetail(item.dataset.vehiculoId);
});

rankingsContainer.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const item = event.target.closest("[data-vehiculo-id]");
    if (!item) return;
    event.preventDefault();
    openSimitDetail(item.dataset.vehiculoId);
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

async function copiarPlacaYAbrirSimit(placa) {
    if (placa && navigator.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(placa);
            window.VehiAmb.ui.showMessage(mensaje, `Placa ${placa} copiada. Pégala en el buscador de SIMIT.`);
        } catch (error) {
            console.error(error);
        }
    }

    window.open(SIMIT_PORTAL_URL, "_blank", "noopener,noreferrer");
}

simitDrawerPagarButton.addEventListener("click", () => {
    copiarPlacaYAbrirSimit(currentDrawerContext?.row?.placa);
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

document.addEventListener("DOMContentLoaded", async () => {
    await cargarFlota();

    // Llegada desde una notificacion ("Ver comparendos") -- abre de una vez
    // el detalle SIMIT de ese vehiculo puntual.
    const vehiculoIdParam = new URLSearchParams(window.location.search).get("vehiculo_id");
    if (vehiculoIdParam) openSimitDetail(vehiculoIdParam);
});
