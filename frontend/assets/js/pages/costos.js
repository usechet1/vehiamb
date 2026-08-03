const costosDesdeInput = document.getElementById("costosDesde");
const costosHastaInput = document.getElementById("costosHasta");
const costosTitulo = document.getElementById("costosTitulo");
const costosSubtitulo = document.getElementById("costosSubtitulo");
const costosMensaje = document.getElementById("costosMensaje");
const costosSync = document.getElementById("costosSync");
const costosSyncButton = document.getElementById("costosSyncButton");
const costosSyncEstado = document.getElementById("costosSyncEstado");

const costosTabs = document.getElementById("costosTabs");
const costosBloqueVehiculo = document.getElementById("costosBloqueVehiculo");
const costosBloqueConductor = document.getElementById("costosBloqueConductor");

const costosListaView = document.getElementById("costosListaView");
const costosListaGrid = document.getElementById("costosListaGrid");
const costosListaBuscar = document.getElementById("costosListaBuscar");
const costosListaTotales = document.getElementById("costosListaTotales");

const costosDetalleView = document.getElementById("costosDetalleView");
const costosVolverButton = document.getElementById("costosVolverButton");
const costosKpisGrid = document.getElementById("costosKpisGrid");

const costosFacturasBuscar = document.getElementById("costosFacturasBuscar");
const costosFacturasBody = document.getElementById("costosFacturasBody");
const costosFacturasSummary = document.getElementById("costosFacturasSummary");
const costosFacturasPrev = document.getElementById("costosFacturasPrev");
const costosFacturasNext = document.getElementById("costosFacturasNext");
const costosFacturasTable = document.getElementById("costosFacturasTable");

const costosConductoresListaView = document.getElementById("costosConductoresListaView");
const costosConductoresListaGrid = document.getElementById("costosConductoresListaGrid");
const costosConductoresListaBuscar = document.getElementById("costosConductoresListaBuscar");
const costosConductoresListaTotales = document.getElementById("costosConductoresListaTotales");

const costosConductorDetalleView = document.getElementById("costosConductorDetalleView");
const costosConductorVolverButton = document.getElementById("costosConductorVolverButton");
const costosConductorKpisGrid = document.getElementById("costosConductorKpisGrid");

const costosConductorFacturasBuscar = document.getElementById("costosConductorFacturasBuscar");
const costosConductorFacturasBody = document.getElementById("costosConductorFacturasBody");
const costosConductorFacturasSummary = document.getElementById("costosConductorFacturasSummary");
const costosConductorFacturasPrev = document.getElementById("costosConductorFacturasPrev");
const costosConductorFacturasNext = document.getElementById("costosConductorFacturasNext");
const costosConductorFacturasTable = document.getElementById("costosConductorFacturasTable");

const GASTO_COLORS = {
    combustible_pesos: "#e55039",
    almuerzos: "#f39c12",
    peajes: "#2980b9",
    parqueaderos: "#27ae60",
    otros: "#8e44ad"
};

const GASTO_LABELS = {
    combustible_pesos: "Combustible",
    almuerzos: "Almuerzos",
    peajes: "Peajes",
    parqueaderos: "Parqueaderos",
    otros: "Otros"
};

const KPIS_CONFIG = [
    { key: "totalGastado", label: "Total gasto (operativo)", format: "cop", accent: "var(--color-primary)" },
    { key: "totalFacturadoNeto", label: "Valor despachado (sin IVA)", format: "cop", accent: "var(--color-primary)" },
    { key: "promedioFacturaNeto", label: "Promedio despachado", format: "cop", accent: "var(--color-primary)" },
    { key: "combustiblePctSobreFacturado", label: "Combustible % del valor despachado", format: "pct", accent: GASTO_COLORS.combustible_pesos },
    { key: "gastoPctSobreFacturado", label: "% de participación de despachos en valor despachado sin IVA", format: "pct", accent: "var(--color-primary)" },
    { key: "totalCombustible", label: "Combustible", format: "cop", accent: GASTO_COLORS.combustible_pesos },
    { key: "totalGalones", label: "Consumo (galones)", format: "galones", accent: GASTO_COLORS.combustible_pesos },
    { key: "costoPromedioPorCargue", label: "Promedio por cargue", format: "cop", accent: "var(--color-primary)" },
    { key: "totalAlmuerzos", label: "Almuerzos", format: "cop", accent: GASTO_COLORS.almuerzos },
    { key: "totalPeajes", label: "Peajes", format: "cop", accent: GASTO_COLORS.peajes },
    { key: "totalParqueaderos", label: "Parqueaderos", format: "cop", accent: GASTO_COLORS.parqueaderos },
    { key: "numFacturas", label: "Numero de despachos", format: "int", accent: "var(--color-muted)" },
    { key: "combustiblePct", label: "Combustible % del gasto operativo", format: "pct", accent: GASTO_COLORS.combustible_pesos }
];

let chartInstances = {};
let facturasState = { page: 1, limit: 20, search: "", orderBy: "fecha_envio", dir: "desc", totalPages: 1 };
let facturasConductorState = { page: 1, limit: 20, search: "", orderBy: "fecha_envio", dir: "desc", totalPages: 1 };
let vehiculosCache = [];
let conductoresCache = [];
let vistaActual = "vehiculo";

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatCOP(value) {
    return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatGalones(value) {
    return `${Number(value || 0).toLocaleString("es-CO", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} gal`;
}

function formatPct(value) {
    return `${Number(value || 0).toLocaleString("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function formatInt(value) {
    return Number(value || 0).toLocaleString("es-CO");
}

function formatKpiValue(kpi, value) {
    if (kpi.format === "cop") return formatCOP(value);
    if (kpi.format === "galones") return formatGalones(value);
    if (kpi.format === "pct") return formatPct(value);
    return formatInt(value);
}

function formatFechaCorta(value) {
    if (!value) return "--";
    return new Date(String(value).slice(0, 10) + "T00:00:00").toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}

function renderDeltaBadge(deltaPct) {
    if (deltaPct === null || deltaPct === undefined) {
        return '<span class="costos-delta igual">Nuevo</span>';
    }

    if (deltaPct === 0) {
        return '<span class="costos-delta igual">Sin cambio</span>';
    }

    const cls = deltaPct > 0 ? "subio" : "bajo";
    const arrow = deltaPct > 0 ? "▲" : "▼";
    return `<span class="costos-delta ${cls}">${arrow} ${formatPct(Math.abs(deltaPct))}</span>`;
}

// ── Estado / URL ─────────────────────────────────────────────────

function leerEstadoUrl() {
    const params = new URLSearchParams(window.location.search);
    return {
        desde: params.get("desde") || "",
        hasta: params.get("hasta") || "",
        placa: params.get("placa") || null,
        vista: params.get("vista") === "conductor" ? "conductor" : "vehiculo",
        conductorKey: params.get("conductor") || null
    };
}

function escribirEstadoUrl(estado, { replace = false } = {}) {
    const params = new URLSearchParams();
    if (estado.desde) params.set("desde", estado.desde);
    if (estado.hasta) params.set("hasta", estado.hasta);
    if (estado.vista === "conductor") params.set("vista", "conductor");
    if (estado.placa) params.set("placa", estado.placa);
    if (estado.conductorKey) params.set("conductor", estado.conductorKey);

    const url = `costos.html?${params.toString()}`;
    if (replace) {
        window.history.replaceState(estado, "", url);
    } else {
        window.history.pushState(estado, "", url);
    }
}

// ── Totales de toda la flota / todos los conductores ─────────────
// A diferencia de las tarjetas de la grilla (una por vehiculo/conductor),
// esto suma TODOS los items del periodo (sin importar el filtro de
// busqueda, que solo afecta que tarjetas se ven abajo) para dar el numero
// total de la operacion completa.
function renderTotalesFlota(grid, items, unidadLabel) {
    const totalGastado = items.reduce((sum, item) => sum + Number(item.totalGastado || 0), 0);
    const totalGastadoAnterior = items.reduce((sum, item) => sum + Number(item.totalGastadoAnterior || 0), 0);
    const totalFacturadoNeto = items.reduce((sum, item) => sum + Number(item.totalFacturadoNeto || 0), 0);
    const totalFacturas = items.reduce((sum, item) => sum + Number(item.numFacturas || 0), 0);
    const totalTraslados = items.reduce((sum, item) => sum + Number(item.numTraslados || 0), 0);
    const totalFacturasReales = totalFacturas - totalTraslados;
    const totalCombustible = items.reduce((sum, item) => sum + Number(item.totalCombustible || 0), 0);
    const totalAlmuerzos = items.reduce((sum, item) => sum + Number(item.totalAlmuerzos || 0), 0);
    const totalPeajes = items.reduce((sum, item) => sum + Number(item.totalPeajes || 0), 0);
    const deltaPct = totalGastadoAnterior > 0 ? Math.round(((totalGastado - totalGastadoAnterior) / totalGastadoAnterior) * 1000) / 10 : null;
    const pctSobre = (valor, base) => (base > 0 ? formatPct(Math.round((valor / base) * 1000) / 10) : formatPct(0));

    // Tarjetas generales primero, luego una tarjeta por tipo de gasto que
    // combina los dos porcentajes (sobre el gasto operativo y sobre el valor
    // despachado neto) con su propia leyenda, en vez de dos tarjetas sueltas
    // que antes quedaban partidas entre filas del grid.
    const tarjetas = [
        { label: unidadLabel, valor: formatInt(items.length), accent: "var(--color-muted)" },
        { label: "Despachos antes de IVA", valor: formatCOP(totalFacturadoNeto), accent: "var(--color-primary)" },
        { label: "Total gasto (operativo)", valor: formatCOP(totalGastado), accent: "var(--color-primary)", delta: deltaPct },
        { label: "% de participación de despachos en valor despachado sin IVA", valor: pctSobre(totalGastado, totalFacturadoNeto), accent: "var(--color-primary)" },
        {
            label: "Total despachos",
            valor: formatInt(totalFacturas),
            accent: "var(--color-muted)",
            compacto: true,
            dual: [
                { valor: formatInt(totalFacturasReales), etiqueta: "facturas" },
                { valor: formatInt(totalTraslados), etiqueta: "traslados" }
            ]
        },
        {
            label: "Combustible",
            accent: GASTO_COLORS.combustible_pesos,
            dual: [
                { valor: pctSobre(totalCombustible, totalGastado), etiqueta: "del gasto operativo" },
                { valor: pctSobre(totalCombustible, totalFacturadoNeto), etiqueta: "del valor despachado" }
            ]
        },
        {
            label: "Almuerzos",
            accent: GASTO_COLORS.almuerzos,
            dual: [
                { valor: pctSobre(totalAlmuerzos, totalGastado), etiqueta: "del gasto operativo" },
                { valor: pctSobre(totalAlmuerzos, totalFacturadoNeto), etiqueta: "del valor despachado" }
            ]
        },
        {
            label: "Peajes",
            accent: GASTO_COLORS.peajes,
            dual: [
                { valor: pctSobre(totalPeajes, totalGastado), etiqueta: "del gasto operativo" },
                { valor: pctSobre(totalPeajes, totalFacturadoNeto), etiqueta: "del valor despachado" }
            ]
        }
    ];

    grid.innerHTML = tarjetas.map((tarjeta) => `
        <div class="costos-kpi-card${tarjeta.compacto ? " costos-kpi-card--compacto" : ""}" style="--kpi-accent: ${tarjeta.accent}">
            <div class="costos-kpi-label">${tarjeta.label}</div>
            ${tarjeta.valor !== undefined ? `<div class="costos-kpi-valor">${tarjeta.valor}</div>` : ""}
            ${tarjeta.dual
                ? tarjeta.dual.map((par) => `
                    <div class="costos-kpi-valor costos-kpi-valor-dual">${par.valor}<span class="costos-kpi-valor-etiqueta">${par.etiqueta}</span></div>
                `).join("")
                : ""}
            ${tarjeta.delta !== undefined ? renderDeltaBadge(tarjeta.delta) : ""}
        </div>
    `).join("");
}

// ── Vista: lista de vehiculos ────────────────────────────────────

function renderListaVehiculos() {
    const filtro = costosListaBuscar.value.trim().toUpperCase();
    const items = filtro ? vehiculosCache.filter((v) => v.placa.includes(filtro)) : vehiculosCache;

    if (!items.length) {
        costosListaGrid.innerHTML = '<p class="dash-empty">No hay vehículos para mostrar.</p>';
        return;
    }

    costosListaGrid.innerHTML = items
        .map(
            (v) => `
                <article class="costos-vehiculo-card" data-placa="${escapeHtml(v.placa)}">
                    <span class="costos-vehiculo-placa${v.placa === "CLIENTE" ? " es-cliente" : ""}">${escapeHtml(v.placa)}</span>
                    <span class="costos-vehiculo-total">${formatCOP(v.totalGastado)}</span>
                    <div class="costos-vehiculo-meta">
                        <span>${v.numFacturas} despachos</span>
                        <span>Max: ${formatCOP(v.gastoMasAlto)}</span>
                    </div>
                    <div class="costos-vehiculo-meta">
                        <span>Valor despachado: ${formatCOP(v.totalFacturadoNeto)}</span>
                    </div>
                    ${renderDeltaBadge(v.deltaPct)}
                </article>
            `
        )
        .join("");
}

async function cargarListaVehiculos() {
    costosListaGrid.innerHTML = `
        <div class="costos-skeleton-grid">
            ${Array.from({ length: 6 }).map(() => '<div class="costos-skeleton-card"></div>').join("")}
        </div>
    `;

    try {
        const resultado = await window.VehiAmb.api.getCostosVehiculos({ desde: costosDesdeInput.value, hasta: costosHastaInput.value });
        vehiculosCache = resultado.items;
        renderTotalesFlota(costosListaTotales, vehiculosCache, "Vehículos con gasto");
        renderListaVehiculos();
    } catch (error) {
        console.error(error);
        costosListaGrid.innerHTML = '<p class="dash-empty">No fue posible cargar los costos por vehículo.</p>';
        window.VehiAmb.ui.showMessage(costosMensaje, error.message || "Error al cargar los vehículos", "error");
    }
}

// ── Vista: detalle de vehiculo ───────────────────────────────────

function renderKpis(grid, data) {
    grid.innerHTML = KPIS_CONFIG.map((kpi) => {
        const valor = data.actual[kpi.key];
        const deltaPct = data.deltas[kpi.key];

        return `
            <div class="costos-kpi-card" style="--kpi-accent: ${kpi.accent}">
                <div class="costos-kpi-label">${kpi.label}</div>
                <div class="costos-kpi-valor">${formatKpiValue(kpi, valor)}</div>
                ${renderDeltaBadge(deltaPct)}
            </div>
        `;
    }).join("");
}

function destruirChart(id) {
    if (chartInstances[id]) {
        chartInstances[id].destroy();
        delete chartInstances[id];
    }
}

function toggleChartEmpty(canvasId, vacio) {
    const canvas = document.getElementById(canvasId);
    const wrap = canvas.parentElement;
    let empty = wrap.querySelector(".costos-chart-empty");

    if (vacio) {
        canvas.classList.add("hidden");
        if (!empty) {
            empty = document.createElement("div");
            empty.className = "costos-chart-empty";
            empty.textContent = "Sin datos para el período seleccionado.";
            wrap.appendChild(empty);
        }
    } else {
        canvas.classList.remove("hidden");
        if (empty) empty.remove();
    }
}

function renderGraficas(graficas) {
    const cfg = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { boxWidth: 12, font: { size: 11 } } } }
    };

    // Gasto total por dia (barras)
    destruirChart("gastoDiario");
    const hayGastoDiario = graficas.evolucionDiaria.fechas.length > 0;
    toggleChartEmpty("chartGastoDiario", !hayGastoDiario);
    if (hayGastoDiario) {
        chartInstances.gastoDiario = new Chart(document.getElementById("chartGastoDiario"), {
            type: "bar",
            data: {
                labels: graficas.evolucionDiaria.fechas.map(formatFechaCorta),
                datasets: [{ label: "Gasto total", data: graficas.evolucionDiaria.gastoTotal, backgroundColor: "#b21f2d" }]
            },
            options: { ...cfg, plugins: { ...cfg.plugins, legend: { display: false } } }
        });
    }

    // Consumo de galones por dia (linea)
    destruirChart("galonesDiario");
    toggleChartEmpty("chartGalonesDiario", !hayGastoDiario);
    if (hayGastoDiario) {
        chartInstances.galonesDiario = new Chart(document.getElementById("chartGalonesDiario"), {
            type: "line",
            data: {
                labels: graficas.evolucionDiaria.fechas.map(formatFechaCorta),
                datasets: [{
                    label: "Galones",
                    data: graficas.evolucionDiaria.galones,
                    borderColor: GASTO_COLORS.combustible_pesos,
                    backgroundColor: "rgba(229, 80, 57, 0.12)",
                    fill: true,
                    tension: 0.3
                }]
            },
            options: { ...cfg, plugins: { ...cfg.plugins, legend: { display: false } } }
        });
    }

    // Proporcion por tipo (torta)
    destruirChart("proporcion");
    const tiposProporcion = Object.entries(graficas.proporcionPorTipo);
    const hayProporcion = tiposProporcion.some(([, valor]) => valor > 0);
    toggleChartEmpty("chartProporcion", !hayProporcion);
    if (hayProporcion) {
        chartInstances.proporcion = new Chart(document.getElementById("chartProporcion"), {
            type: "doughnut",
            data: {
                labels: tiposProporcion.map(([tipo]) => GASTO_LABELS[tipo] || tipo),
                datasets: [{ data: tiposProporcion.map(([, valor]) => valor), backgroundColor: tiposProporcion.map(([tipo]) => GASTO_COLORS[tipo]) }]
            },
            options: cfg
        });
    }

    // Desglose diario por tipo (barras apiladas)
    destruirChart("desgloseDiario");
    const hayDesglose = graficas.desglosePorTipoDiario.fechas.length > 0;
    toggleChartEmpty("chartDesgloseDiario", !hayDesglose);
    if (hayDesglose) {
        chartInstances.desgloseDiario = new Chart(document.getElementById("chartDesgloseDiario"), {
            type: "bar",
            data: {
                labels: graficas.desglosePorTipoDiario.fechas.map(formatFechaCorta),
                datasets: Object.entries(graficas.desglosePorTipoDiario.series)
                    .filter(([tipo]) => tipo !== "otros" || graficas.desglosePorTipoDiario.series.otros.some((v) => v > 0))
                    .map(([tipo, valores]) => ({
                        label: GASTO_LABELS[tipo] || tipo,
                        data: valores,
                        backgroundColor: GASTO_COLORS[tipo]
                    }))
            },
            options: {
                ...cfg,
                scales: { x: { stacked: true }, y: { stacked: true } }
            }
        });
    }

    // Top salas (barras horizontales)
    destruirChart("topSalas");
    const haySalas = graficas.topSalas.length > 0;
    toggleChartEmpty("chartTopSalas", !haySalas);
    if (haySalas) {
        chartInstances.topSalas = new Chart(document.getElementById("chartTopSalas"), {
            type: "bar",
            data: {
                labels: graficas.topSalas.map((s) => s.sala),
                datasets: [{ label: "Gasto total", data: graficas.topSalas.map((s) => s.total), backgroundColor: "#b21f2d" }]
            },
            options: { ...cfg, indexAxis: "y", plugins: { ...cfg.plugins, legend: { display: false } } }
        });
    }
}

function renderFacturasHead() {
    costosFacturasTable.querySelectorAll("th[data-order]").forEach((th) => {
        th.classList.remove("sorted-asc", "sorted-desc");
        if (th.dataset.order === facturasState.orderBy) {
            th.classList.add(facturasState.dir === "asc" ? "sorted-asc" : "sorted-desc");
        }
    });
}

function renderFacturas(resultado) {
    if (!resultado.items.length) {
        costosFacturasBody.innerHTML = '<tr><td colspan="14" class="dash-empty">No hay facturas para los filtros seleccionados</td></tr>';
    } else {
        costosFacturasBody.innerHTML = resultado.items
            .map(
                (f) => `
                    <tr>
                        <td>${escapeHtml(f.numeroFactura)}</td>
                        <td>${formatFechaCorta(f.fechaFactura)}</td>
                        <td>${formatFechaCorta(f.fechaEnvio)}</td>
                        <td>${escapeHtml(f.sala || "--")}</td>
                        <td>${escapeHtml(f.conductor || "Sin identificar")}</td>
                        <td>${Number(f.pesoKg || 0).toLocaleString("es-CO", { maximumFractionDigits: 3 })}</td>
                        <td>${formatCOP(f.valorFactura)}</td>
                        <td>${formatCOP(f.combustible)}</td>
                        <td>${Number(f.galones || 0).toLocaleString("es-CO", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</td>
                        <td>${formatCOP(f.almuerzos)}</td>
                        <td>${formatCOP(f.peajes)}</td>
                        <td>${formatCOP(f.parqueaderos)}</td>
                        <td><strong>${formatCOP(f.totalGasto)}</strong></td>
                        <td>${escapeHtml(f.observaciones || "--")}</td>
                    </tr>
                `
            )
            .join("");
    }

    facturasState.totalPages = resultado.totalPages;
    costosFacturasSummary.textContent = `Página ${resultado.page} de ${resultado.totalPages} · ${resultado.total} facturas`;
    costosFacturasPrev.disabled = facturasState.page <= 1;
    costosFacturasNext.disabled = facturasState.page >= resultado.totalPages;
    renderFacturasHead();
}

async function cargarFacturas(placa) {
    costosFacturasBody.innerHTML = '<tr><td colspan="14" class="dash-empty">Cargando...</td></tr>';

    try {
        const resultado = await window.VehiAmb.api.getCostosVehiculoFacturas(placa, {
            desde: costosDesdeInput.value,
            hasta: costosHastaInput.value,
            page: facturasState.page,
            limit: facturasState.limit,
            search: facturasState.search,
            orderBy: facturasState.orderBy,
            dir: facturasState.dir
        });
        renderFacturas(resultado);
    } catch (error) {
        console.error(error);
        costosFacturasBody.innerHTML = '<tr><td colspan="14" class="dash-empty">No fue posible cargar las facturas</td></tr>';
    }
}

async function cargarDetalleVehiculo(placa) {
    facturasState = { page: 1, limit: 20, search: "", orderBy: "fecha_factura", dir: "desc", totalPages: 1 };
    costosFacturasBuscar.value = "";
    costosKpisGrid.innerHTML = '<p class="dash-empty">Cargando indicadores...</p>';

    const filtros = { desde: costosDesdeInput.value, hasta: costosHastaInput.value };

    try {
        const [kpis, graficas] = await Promise.all([
            window.VehiAmb.api.getCostosVehiculoKpis(placa, filtros),
            window.VehiAmb.api.getCostosVehiculoGraficas(placa, filtros)
        ]);

        renderKpis(costosKpisGrid, kpis);
        renderGraficas(graficas);
        await cargarFacturas(placa);
    } catch (error) {
        console.error(error);
        costosKpisGrid.innerHTML = '<p class="dash-empty">No fue posible cargar los indicadores del vehículo</p>';
        window.VehiAmb.ui.showMessage(costosMensaje, error.message || "Error al cargar el detalle del vehículo", "error");
    }
}

// ── Vista: lista de conductores (espejo de lista de vehiculos) ───

function renderListaConductores() {
    const filtro = costosConductoresListaBuscar.value.trim().toUpperCase();
    const items = filtro
        ? conductoresCache.filter((c) => c.conductorLabel.toUpperCase().includes(filtro))
        : conductoresCache;

    if (!items.length) {
        costosConductoresListaGrid.innerHTML = '<p class="dash-empty">No hay conductores para mostrar.</p>';
        return;
    }

    costosConductoresListaGrid.innerHTML = items
        .map(
            (c) => `
                <article class="costos-vehiculo-card" data-conductor-key="${escapeHtml(c.conductorKey)}">
                    <span class="costos-vehiculo-placa${c.conductorKey === "SIN_IDENTIFICAR" ? " es-cliente" : ""}">${escapeHtml(c.conductorLabel)}</span>
                    <span class="costos-vehiculo-total">${formatCOP(c.totalGastado)}</span>
                    <div class="costos-vehiculo-meta">
                        <span>${c.numFacturas} despachos</span>
                        <span>Max: ${formatCOP(c.gastoMasAlto)}</span>
                    </div>
                    <div class="costos-vehiculo-meta">
                        <span>Valor despachado: ${formatCOP(c.totalFacturadoNeto)}</span>
                    </div>
                    ${renderDeltaBadge(c.deltaPct)}
                </article>
            `
        )
        .join("");
}

async function cargarListaConductores() {
    costosConductoresListaGrid.innerHTML = `
        <div class="costos-skeleton-grid">
            ${Array.from({ length: 6 }).map(() => '<div class="costos-skeleton-card"></div>').join("")}
        </div>
    `;

    try {
        const resultado = await window.VehiAmb.api.getCostosConductores({ desde: costosDesdeInput.value, hasta: costosHastaInput.value });
        conductoresCache = resultado.items;
        renderTotalesFlota(costosConductoresListaTotales, conductoresCache, "Conductores con gasto");
        renderListaConductores();
    } catch (error) {
        console.error(error);
        costosConductoresListaGrid.innerHTML = '<p class="dash-empty">No fue posible cargar los costos por conductor.</p>';
        window.VehiAmb.ui.showMessage(costosMensaje, error.message || "Error al cargar los conductores", "error");
    }
}

// ── Vista: detalle de conductor (espejo de detalle de vehiculo) ──

function renderGraficasConductor(graficas) {
    const cfg = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { boxWidth: 12, font: { size: 11 } } } }
    };

    destruirChart("conductorGastoDiario");
    const hayGastoDiario = graficas.evolucionDiaria.fechas.length > 0;
    toggleChartEmpty("chartConductorGastoDiario", !hayGastoDiario);
    if (hayGastoDiario) {
        chartInstances.conductorGastoDiario = new Chart(document.getElementById("chartConductorGastoDiario"), {
            type: "bar",
            data: {
                labels: graficas.evolucionDiaria.fechas.map(formatFechaCorta),
                datasets: [{ label: "Gasto total", data: graficas.evolucionDiaria.gastoTotal, backgroundColor: "#b21f2d" }]
            },
            options: { ...cfg, plugins: { ...cfg.plugins, legend: { display: false } } }
        });
    }

    destruirChart("conductorGalonesDiario");
    toggleChartEmpty("chartConductorGalonesDiario", !hayGastoDiario);
    if (hayGastoDiario) {
        chartInstances.conductorGalonesDiario = new Chart(document.getElementById("chartConductorGalonesDiario"), {
            type: "line",
            data: {
                labels: graficas.evolucionDiaria.fechas.map(formatFechaCorta),
                datasets: [{
                    label: "Galones",
                    data: graficas.evolucionDiaria.galones,
                    borderColor: GASTO_COLORS.combustible_pesos,
                    backgroundColor: "rgba(229, 80, 57, 0.12)",
                    fill: true,
                    tension: 0.3
                }]
            },
            options: { ...cfg, plugins: { ...cfg.plugins, legend: { display: false } } }
        });
    }

    destruirChart("conductorProporcion");
    const tiposProporcion = Object.entries(graficas.proporcionPorTipo);
    const hayProporcion = tiposProporcion.some(([, valor]) => valor > 0);
    toggleChartEmpty("chartConductorProporcion", !hayProporcion);
    if (hayProporcion) {
        chartInstances.conductorProporcion = new Chart(document.getElementById("chartConductorProporcion"), {
            type: "doughnut",
            data: {
                labels: tiposProporcion.map(([tipo]) => GASTO_LABELS[tipo] || tipo),
                datasets: [{ data: tiposProporcion.map(([, valor]) => valor), backgroundColor: tiposProporcion.map(([tipo]) => GASTO_COLORS[tipo]) }]
            },
            options: cfg
        });
    }

    destruirChart("conductorDesgloseDiario");
    const hayDesglose = graficas.desglosePorTipoDiario.fechas.length > 0;
    toggleChartEmpty("chartConductorDesgloseDiario", !hayDesglose);
    if (hayDesglose) {
        chartInstances.conductorDesgloseDiario = new Chart(document.getElementById("chartConductorDesgloseDiario"), {
            type: "bar",
            data: {
                labels: graficas.desglosePorTipoDiario.fechas.map(formatFechaCorta),
                datasets: Object.entries(graficas.desglosePorTipoDiario.series)
                    .filter(([tipo]) => tipo !== "otros" || graficas.desglosePorTipoDiario.series.otros.some((v) => v > 0))
                    .map(([tipo, valores]) => ({
                        label: GASTO_LABELS[tipo] || tipo,
                        data: valores,
                        backgroundColor: GASTO_COLORS[tipo]
                    }))
            },
            options: {
                ...cfg,
                scales: { x: { stacked: true }, y: { stacked: true } }
            }
        });
    }

    destruirChart("conductorTopVehiculos");
    const hayVehiculos = graficas.topVehiculos.length > 0;
    toggleChartEmpty("chartConductorTopVehiculos", !hayVehiculos);
    if (hayVehiculos) {
        chartInstances.conductorTopVehiculos = new Chart(document.getElementById("chartConductorTopVehiculos"), {
            type: "bar",
            data: {
                labels: graficas.topVehiculos.map((v) => v.placa),
                datasets: [{ label: "Gasto total", data: graficas.topVehiculos.map((v) => v.total), backgroundColor: "#b21f2d" }]
            },
            options: { ...cfg, indexAxis: "y", plugins: { ...cfg.plugins, legend: { display: false } } }
        });
    }
}

function renderFacturasConductorHead() {
    costosConductorFacturasTable.querySelectorAll("th[data-order]").forEach((th) => {
        th.classList.remove("sorted-asc", "sorted-desc");
        if (th.dataset.order === facturasConductorState.orderBy) {
            th.classList.add(facturasConductorState.dir === "asc" ? "sorted-asc" : "sorted-desc");
        }
    });
}

function renderFacturasConductor(resultado) {
    if (!resultado.items.length) {
        costosConductorFacturasBody.innerHTML = '<tr><td colspan="14" class="dash-empty">No hay facturas para los filtros seleccionados</td></tr>';
    } else {
        costosConductorFacturasBody.innerHTML = resultado.items
            .map(
                (f) => `
                    <tr>
                        <td>${escapeHtml(f.numeroFactura)}</td>
                        <td>${formatFechaCorta(f.fechaFactura)}</td>
                        <td>${formatFechaCorta(f.fechaEnvio)}</td>
                        <td>${escapeHtml(f.placa || "--")}</td>
                        <td>${escapeHtml(f.sala || "--")}</td>
                        <td>${Number(f.pesoKg || 0).toLocaleString("es-CO", { maximumFractionDigits: 3 })}</td>
                        <td>${formatCOP(f.valorFactura)}</td>
                        <td>${formatCOP(f.combustible)}</td>
                        <td>${Number(f.galones || 0).toLocaleString("es-CO", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</td>
                        <td>${formatCOP(f.almuerzos)}</td>
                        <td>${formatCOP(f.peajes)}</td>
                        <td>${formatCOP(f.parqueaderos)}</td>
                        <td><strong>${formatCOP(f.totalGasto)}</strong></td>
                        <td>${escapeHtml(f.observaciones || "--")}</td>
                    </tr>
                `
            )
            .join("");
    }

    facturasConductorState.totalPages = resultado.totalPages;
    costosConductorFacturasSummary.textContent = `Página ${resultado.page} de ${resultado.totalPages} · ${resultado.total} facturas`;
    costosConductorFacturasPrev.disabled = facturasConductorState.page <= 1;
    costosConductorFacturasNext.disabled = facturasConductorState.page >= resultado.totalPages;
    renderFacturasConductorHead();
}

async function cargarFacturasConductor(conductorKey) {
    costosConductorFacturasBody.innerHTML = '<tr><td colspan="14" class="dash-empty">Cargando...</td></tr>';

    try {
        const resultado = await window.VehiAmb.api.getCostosConductorFacturas(conductorKey, {
            desde: costosDesdeInput.value,
            hasta: costosHastaInput.value,
            page: facturasConductorState.page,
            limit: facturasConductorState.limit,
            search: facturasConductorState.search,
            orderBy: facturasConductorState.orderBy,
            dir: facturasConductorState.dir
        });
        renderFacturasConductor(resultado);
    } catch (error) {
        console.error(error);
        costosConductorFacturasBody.innerHTML = '<tr><td colspan="14" class="dash-empty">No fue posible cargar las facturas</td></tr>';
    }
}

async function cargarDetalleConductor(conductorKey) {
    facturasConductorState = { page: 1, limit: 20, search: "", orderBy: "fecha_factura", dir: "desc", totalPages: 1 };
    costosConductorFacturasBuscar.value = "";
    costosConductorKpisGrid.innerHTML = '<p class="dash-empty">Cargando indicadores...</p>';

    const filtros = { desde: costosDesdeInput.value, hasta: costosHastaInput.value };

    try {
        const [kpis, graficas] = await Promise.all([
            window.VehiAmb.api.getCostosConductorKpis(conductorKey, filtros),
            window.VehiAmb.api.getCostosConductorGraficas(conductorKey, filtros)
        ]);

        renderKpis(costosConductorKpisGrid, kpis);
        renderGraficasConductor(graficas);
        await cargarFacturasConductor(conductorKey);
    } catch (error) {
        console.error(error);
        costosConductorKpisGrid.innerHTML = '<p class="dash-empty">No fue posible cargar los indicadores del conductor</p>';
        window.VehiAmb.ui.showMessage(costosMensaje, error.message || "Error al cargar el detalle del conductor", "error");
    }
}

// ── Navegacion entre vistas ──────────────────────────────────────

function actualizarTabsUI() {
    costosTabs.querySelectorAll(".tab-button").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.tabVista === vistaActual);
    });
    costosBloqueVehiculo.classList.toggle("hidden", vistaActual !== "vehiculo");
    costosBloqueConductor.classList.toggle("hidden", vistaActual !== "conductor");
}

function mostrarVistaLista() {
    actualizarTabsUI();
    costosListaView.classList.remove("hidden");
    costosDetalleView.classList.add("hidden");
    costosTitulo.textContent = "Dashboard de gastos";
    costosSubtitulo.textContent = "Gasto operativo por vehículo a partir de las facturas importadas.";
}

function mostrarVistaDetalle(placa) {
    actualizarTabsUI();
    costosListaView.classList.add("hidden");
    costosDetalleView.classList.remove("hidden");
    costosTitulo.textContent = placa === "CLIENTE" ? "CLIENTE" : `Vehiculo ${placa}`;
    costosSubtitulo.textContent = "Indicadores, gráficas y facturas del período seleccionado.";
}

function mostrarVistaListaConductores() {
    actualizarTabsUI();
    costosConductoresListaView.classList.remove("hidden");
    costosConductorDetalleView.classList.add("hidden");
    costosTitulo.textContent = "Dashboard de gastos";
    costosSubtitulo.textContent = "Gasto operativo por conductor a partir de las facturas importadas.";
}

function mostrarVistaDetalleConductor(conductorLabel) {
    actualizarTabsUI();
    costosConductoresListaView.classList.add("hidden");
    costosConductorDetalleView.classList.remove("hidden");
    costosTitulo.textContent = conductorLabel || "Conductor";
    costosSubtitulo.textContent = "Indicadores, gráficas y facturas del período seleccionado.";
}

async function renderVistaActual({ actualizarUrl = false, reemplazarUrl = false } = {}) {
    const estado = {
        desde: costosDesdeInput.value,
        hasta: costosHastaInput.value,
        vista: vistaActual,
        placa: vistaActual === "vehiculo" ? window.__costosPlacaActual || null : null,
        conductorKey: vistaActual === "conductor" ? window.__costosConductorActual || null : null
    };

    if (actualizarUrl) {
        escribirEstadoUrl(estado, { replace: reemplazarUrl });
    }

    if (vistaActual === "conductor") {
        if (estado.conductorKey) {
            const encontrado = conductoresCache.find((c) => c.conductorKey === estado.conductorKey);
            mostrarVistaDetalleConductor(encontrado?.conductorLabel);
            await cargarDetalleConductor(estado.conductorKey);
        } else {
            mostrarVistaListaConductores();
            await cargarListaConductores();
        }
        return;
    }

    if (estado.placa) {
        mostrarVistaDetalle(estado.placa);
        await cargarDetalleVehiculo(estado.placa);
    } else {
        mostrarVistaLista();
        await cargarListaVehiculos();
    }
}

// ── Eventos ──────────────────────────────────────────────────────

[costosDesdeInput, costosHastaInput].forEach((input) => {
    input.addEventListener("change", () => {
        renderVistaActual({ actualizarUrl: true });
    });
});

costosTabs.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-tab-vista]");
    if (!btn || btn.dataset.tabVista === vistaActual) return;

    vistaActual = btn.dataset.tabVista;
    window.__costosPlacaActual = null;
    window.__costosConductorActual = null;
    renderVistaActual({ actualizarUrl: true });
});

costosListaBuscar.addEventListener("input", renderListaVehiculos);

costosListaGrid.addEventListener("click", (event) => {
    const card = event.target.closest("[data-placa]");
    if (!card) return;

    window.__costosPlacaActual = card.dataset.placa;
    renderVistaActual({ actualizarUrl: true });
});

costosVolverButton.addEventListener("click", () => {
    window.__costosPlacaActual = null;
    renderVistaActual({ actualizarUrl: true });
});

let facturasSearchDebounce;
costosFacturasBuscar.addEventListener("input", () => {
    clearTimeout(facturasSearchDebounce);
    facturasSearchDebounce = setTimeout(() => {
        facturasState.search = costosFacturasBuscar.value.trim();
        facturasState.page = 1;
        cargarFacturas(window.__costosPlacaActual);
    }, 300);
});

costosFacturasTable.addEventListener("click", (event) => {
    const th = event.target.closest("th[data-order]");
    if (!th) return;

    const columna = th.dataset.order;
    if (facturasState.orderBy === columna) {
        facturasState.dir = facturasState.dir === "asc" ? "desc" : "asc";
    } else {
        facturasState.orderBy = columna;
        facturasState.dir = "desc";
    }
    facturasState.page = 1;
    cargarFacturas(window.__costosPlacaActual);
});

costosFacturasPrev.addEventListener("click", () => {
    if (facturasState.page <= 1) return;
    facturasState.page -= 1;
    cargarFacturas(window.__costosPlacaActual);
});

costosFacturasNext.addEventListener("click", () => {
    if (facturasState.page >= facturasState.totalPages) return;
    facturasState.page += 1;
    cargarFacturas(window.__costosPlacaActual);
});

costosConductoresListaBuscar.addEventListener("input", renderListaConductores);

costosConductoresListaGrid.addEventListener("click", (event) => {
    const card = event.target.closest("[data-conductor-key]");
    if (!card) return;

    window.__costosConductorActual = card.dataset.conductorKey;
    renderVistaActual({ actualizarUrl: true });
});

costosConductorVolverButton.addEventListener("click", () => {
    window.__costosConductorActual = null;
    renderVistaActual({ actualizarUrl: true });
});

let facturasConductorSearchDebounce;
costosConductorFacturasBuscar.addEventListener("input", () => {
    clearTimeout(facturasConductorSearchDebounce);
    facturasConductorSearchDebounce = setTimeout(() => {
        facturasConductorState.search = costosConductorFacturasBuscar.value.trim();
        facturasConductorState.page = 1;
        cargarFacturasConductor(window.__costosConductorActual);
    }, 300);
});

costosConductorFacturasTable.addEventListener("click", (event) => {
    const th = event.target.closest("th[data-order]");
    if (!th) return;

    const columna = th.dataset.order;
    if (facturasConductorState.orderBy === columna) {
        facturasConductorState.dir = facturasConductorState.dir === "asc" ? "desc" : "asc";
    } else {
        facturasConductorState.orderBy = columna;
        facturasConductorState.dir = "desc";
    }
    facturasConductorState.page = 1;
    cargarFacturasConductor(window.__costosConductorActual);
});

costosConductorFacturasPrev.addEventListener("click", () => {
    if (facturasConductorState.page <= 1) return;
    facturasConductorState.page -= 1;
    cargarFacturasConductor(window.__costosConductorActual);
});

costosConductorFacturasNext.addEventListener("click", () => {
    if (facturasConductorState.page >= facturasConductorState.totalPages) return;
    facturasConductorState.page += 1;
    cargarFacturasConductor(window.__costosConductorActual);
});

window.addEventListener("popstate", () => {
    const estado = leerEstadoUrl();
    costosDesdeInput.value = estado.desde;
    costosHastaInput.value = estado.hasta;
    vistaActual = estado.vista;
    window.__costosPlacaActual = estado.placa;
    window.__costosConductorActual = estado.conductorKey;
    renderVistaActual({ actualizarUrl: false });
});

// ── Sincronizacion de cargues (unidad de red T:) ──────────────────

const ESTADO_SYNC_LABEL = {
    pendiente: "Pendiente",
    en_proceso: "En proceso",
    completado: "Completado",
    completado_con_errores: "Completado con errores",
    sin_cambios: "Sin cambios",
    fallido: "Fallido"
};

function formatDateTimeCorta(value) {
    if (!value) return "--";
    return new Date(value).toLocaleString("es-CO", {
        day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
    });
}

function hoyIso() {
    return new Date().toISOString().slice(0, 10);
}

function renderSyncEstado(item) {
    if (!item) {
        costosSyncEstado.textContent = "Aun no se ha sincronizado ningun cargue.";
        return;
    }

    const estado = ESTADO_SYNC_LABEL[item.estado] || item.estado;
    costosSyncEstado.textContent =
        `Última sincronización: ${formatDateTimeCorta(item.creado_en)} (${estado}) ` +
        `· Nuevos: ${item.total_nuevos} · Actualizados: ${item.total_actualizados}`;
}

async function cargarEstadoSync() {
    try {
        const { ultimaImportacionAutomatica } = await window.VehiAmb.api.getImportacionesStatus();
        renderSyncEstado(ultimaImportacionAutomatica);
    } catch (error) {
        console.error(error);
        costosSyncEstado.textContent = "No fue posible cargar el estado de sincronización.";
    }
}

costosSyncButton?.addEventListener("click", async () => {
    costosSyncButton.disabled = true;
    const textoOriginal = costosSyncButton.textContent;
    costosSyncButton.textContent = "Sincronizando...";

    try {
        const resultado = await window.VehiAmb.api.ejecutarImportacion({ periodo: hoyIso() });
        const estado = ESTADO_SYNC_LABEL[resultado.estado] || resultado.estado;
        window.VehiAmb.ui.showMessage(
            costosMensaje,
            `Sincronizacion ${estado.toLowerCase()}: ${resultado.totalNuevos} nuevos, ${resultado.totalActualizados} actualizados, ${resultado.totalErrores} errores`,
            resultado.estado === "fallido" ? "error" : "success"
        );
        await Promise.all([cargarEstadoSync(), renderVistaActual()]);
    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(costosMensaje, error.message || "No se pudo sincronizar los cargues", "error");
    } finally {
        costosSyncButton.disabled = false;
        costosSyncButton.textContent = textoOriginal;
    }
});

if (window.VehiAmb.auth?.hasPermission?.("imports.manage")) {
    costosSync.classList.remove("hidden");
    cargarEstadoSync();
}

// ── Inicializacion ───────────────────────────────────────────────

function mesEnCursoIso() {
    const hoy = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const desde = `${hoy.getFullYear()}-${pad(hoy.getMonth() + 1)}-01`;
    const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
    const hasta = `${hoy.getFullYear()}-${pad(hoy.getMonth() + 1)}-${pad(ultimoDia)}`;
    return { desde, hasta };
}

document.addEventListener("DOMContentLoaded", () => {
    const estadoInicial = leerEstadoUrl();
    const defaults = mesEnCursoIso();

    costosDesdeInput.value = estadoInicial.desde || defaults.desde;
    costosHastaInput.value = estadoInicial.hasta || defaults.hasta;
    vistaActual = estadoInicial.vista;
    window.__costosPlacaActual = estadoInicial.placa;
    window.__costosConductorActual = estadoInicial.conductorKey;

    renderVistaActual({ actualizarUrl: true, reemplazarUrl: true });
});
