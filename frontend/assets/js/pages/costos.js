const costosDesdeInput = document.getElementById("costosDesde");
const costosHastaInput = document.getElementById("costosHasta");
const costosTitulo = document.getElementById("costosTitulo");
const costosSubtitulo = document.getElementById("costosSubtitulo");
const costosMensaje = document.getElementById("costosMensaje");
const costosSync = document.getElementById("costosSync");
const costosSyncButton = document.getElementById("costosSyncButton");
const costosSyncEstado = document.getElementById("costosSyncEstado");

const costosListaView = document.getElementById("costosListaView");
const costosListaGrid = document.getElementById("costosListaGrid");
const costosListaBuscar = document.getElementById("costosListaBuscar");

const costosDetalleView = document.getElementById("costosDetalleView");
const costosVolverButton = document.getElementById("costosVolverButton");
const costosKpisGrid = document.getElementById("costosKpisGrid");

const costosFacturasBuscar = document.getElementById("costosFacturasBuscar");
const costosFacturasBody = document.getElementById("costosFacturasBody");
const costosFacturasSummary = document.getElementById("costosFacturasSummary");
const costosFacturasPrev = document.getElementById("costosFacturasPrev");
const costosFacturasNext = document.getElementById("costosFacturasNext");
const costosFacturasTable = document.getElementById("costosFacturasTable");

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
    { key: "totalGastado", label: "Total gastado", format: "cop", accent: "var(--color-primary)" },
    { key: "totalCombustible", label: "Combustible", format: "cop", accent: GASTO_COLORS.combustible_pesos },
    { key: "totalGalones", label: "Consumo (galones)", format: "galones", accent: GASTO_COLORS.combustible_pesos },
    { key: "costoPromedioPorCargue", label: "Promedio por cargue", format: "cop", accent: "var(--color-primary)" },
    { key: "totalAlmuerzos", label: "Almuerzos", format: "cop", accent: GASTO_COLORS.almuerzos },
    { key: "totalPeajes", label: "Peajes", format: "cop", accent: GASTO_COLORS.peajes },
    { key: "totalParqueaderos", label: "Parqueaderos", format: "cop", accent: GASTO_COLORS.parqueaderos },
    { key: "numFacturas", label: "Numero de facturas", format: "int", accent: "var(--color-muted)" },
    { key: "combustiblePct", label: "Combustible % del total", format: "pct", accent: GASTO_COLORS.combustible_pesos }
];

let chartInstances = {};
let facturasState = { page: 1, limit: 20, search: "", orderBy: "fecha_envio", dir: "desc", totalPages: 1 };
let vehiculosCache = [];

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
        placa: params.get("placa") || null
    };
}

function escribirEstadoUrl(estado, { replace = false } = {}) {
    const params = new URLSearchParams();
    if (estado.desde) params.set("desde", estado.desde);
    if (estado.hasta) params.set("hasta", estado.hasta);
    if (estado.placa) params.set("placa", estado.placa);

    const url = `costos.html?${params.toString()}`;
    if (replace) {
        window.history.replaceState(estado, "", url);
    } else {
        window.history.pushState(estado, "", url);
    }
}

// ── Vista: lista de vehiculos ────────────────────────────────────

function renderListaVehiculos() {
    const filtro = costosListaBuscar.value.trim().toUpperCase();
    const items = filtro ? vehiculosCache.filter((v) => v.placa.includes(filtro)) : vehiculosCache;

    if (!items.length) {
        costosListaGrid.innerHTML = '<p class="dash-empty">No hay vehiculos para mostrar.</p>';
        return;
    }

    costosListaGrid.innerHTML = items
        .map(
            (v) => `
                <article class="costos-vehiculo-card" data-placa="${escapeHtml(v.placa)}">
                    <span class="costos-vehiculo-placa${v.placa === "CLIENTE" ? " es-cliente" : ""}">${escapeHtml(v.placa)}</span>
                    <span class="costos-vehiculo-total">${formatCOP(v.totalGastado)}</span>
                    <div class="costos-vehiculo-meta">
                        <span>${v.numFacturas} facturas</span>
                        <span>Max: ${formatCOP(v.gastoMasAlto)}</span>
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
        renderListaVehiculos();
    } catch (error) {
        console.error(error);
        costosListaGrid.innerHTML = '<p class="dash-empty">No fue posible cargar los costos por vehiculo.</p>';
        window.VehiAmb.ui.showMessage(costosMensaje, error.message || "Error al cargar los vehiculos", "error");
    }
}

// ── Vista: detalle de vehiculo ───────────────────────────────────

function renderKpis(data) {
    costosKpisGrid.innerHTML = KPIS_CONFIG.map((kpi) => {
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
            empty.textContent = "Sin datos para el periodo seleccionado.";
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
        costosFacturasBody.innerHTML = '<tr><td colspan="13" class="dash-empty">No hay facturas para los filtros seleccionados</td></tr>';
    } else {
        costosFacturasBody.innerHTML = resultado.items
            .map(
                (f) => `
                    <tr>
                        <td>${escapeHtml(f.numeroFactura)}</td>
                        <td>${formatFechaCorta(f.fechaFactura)}</td>
                        <td>${formatFechaCorta(f.fechaEnvio)}</td>
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

    facturasState.totalPages = resultado.totalPages;
    costosFacturasSummary.textContent = `Pagina ${resultado.page} de ${resultado.totalPages} · ${resultado.total} facturas`;
    costosFacturasPrev.disabled = facturasState.page <= 1;
    costosFacturasNext.disabled = facturasState.page >= resultado.totalPages;
    renderFacturasHead();
}

async function cargarFacturas(placa) {
    costosFacturasBody.innerHTML = '<tr><td colspan="13" class="dash-empty">Cargando...</td></tr>';

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
        costosFacturasBody.innerHTML = '<tr><td colspan="13" class="dash-empty">No fue posible cargar las facturas</td></tr>';
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

        renderKpis(kpis);
        renderGraficas(graficas);
        await cargarFacturas(placa);
    } catch (error) {
        console.error(error);
        costosKpisGrid.innerHTML = '<p class="dash-empty">No fue posible cargar los indicadores del vehiculo</p>';
        window.VehiAmb.ui.showMessage(costosMensaje, error.message || "Error al cargar el detalle del vehiculo", "error");
    }
}

// ── Navegacion entre vistas ──────────────────────────────────────

function mostrarVistaLista() {
    costosListaView.classList.remove("hidden");
    costosDetalleView.classList.add("hidden");
    costosTitulo.textContent = "Gastos vehiculares";
    costosSubtitulo.textContent = "Gasto operativo por vehiculo a partir de las facturas importadas.";
}

function mostrarVistaDetalle(placa) {
    costosListaView.classList.add("hidden");
    costosDetalleView.classList.remove("hidden");
    costosTitulo.textContent = placa === "CLIENTE" ? "CLIENTE" : `Vehiculo ${placa}`;
    costosSubtitulo.textContent = "Indicadores, graficas y facturas del periodo seleccionado.";
}

async function renderVistaActual({ actualizarUrl = false, reemplazarUrl = false } = {}) {
    const estado = { desde: costosDesdeInput.value, hasta: costosHastaInput.value, placa: window.__costosPlacaActual || null };

    if (actualizarUrl) {
        escribirEstadoUrl(estado, { replace: reemplazarUrl });
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

window.addEventListener("popstate", () => {
    const estado = leerEstadoUrl();
    costosDesdeInput.value = estado.desde;
    costosHastaInput.value = estado.hasta;
    window.__costosPlacaActual = estado.placa;
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
        `Ultima sincronizacion: ${formatDateTimeCorta(item.creado_en)} (${estado}) ` +
        `· Nuevos: ${item.total_nuevos} · Actualizados: ${item.total_actualizados}`;
}

async function cargarEstadoSync() {
    try {
        const { ultimaImportacionAutomatica } = await window.VehiAmb.api.getImportacionesStatus();
        renderSyncEstado(ultimaImportacionAutomatica);
    } catch (error) {
        console.error(error);
        costosSyncEstado.textContent = "No fue posible cargar el estado de sincronizacion.";
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
    window.__costosPlacaActual = estadoInicial.placa;

    renderVistaActual({ actualizarUrl: true, reemplazarUrl: true });
});
