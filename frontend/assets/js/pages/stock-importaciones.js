const stockImportSubmitButton = document.getElementById("stockImportSubmitButton");
const stockImportRunResult = document.getElementById("stockImportRunResult");
const stockImportStatusBody = document.getElementById("stockImportStatusBody");
const stockImportFiltroEstado = document.getElementById("stockImportFiltroEstado");
const stockImportTableBody = document.getElementById("stockImportTableBody");
const stockImportListSummary = document.getElementById("stockImportListSummary");
const stockImportPrevPage = document.getElementById("stockImportPrevPage");
const stockImportNextPage = document.getElementById("stockImportNextPage");
const loader = document.getElementById("loader");
const mensaje = document.getElementById("mensaje");

const stockImportDrawer = document.getElementById("stockImportDrawer");
const stockImportDrawerBackdrop = document.getElementById("stockImportDrawerBackdrop");
const closeStockImportDrawer = document.getElementById("closeStockImportDrawer");
const stockImportDrawerTitle = document.getElementById("stockImportDrawerTitle");
const stockImportDrawerSubtitle = document.getElementById("stockImportDrawerSubtitle");
const stockImportDrawerBody = document.getElementById("stockImportDrawerBody");

const configImportSyncButton = document.getElementById("configImportSyncButton");
const configImportResult = document.getElementById("configImportResult");
const configImportStatusBody = document.getElementById("configImportStatusBody");

let currentPage = 1;
let totalPages = 1;

const ESTADO_LABEL = {
    pendiente: "Pendiente",
    en_proceso: "En proceso",
    completado: "Completado",
    completado_con_errores: "Completado con errores",
    fallido: "Fallido"
};

const ESTADO_CLASS = {
    pendiente: "badge-amarillo",
    en_proceso: "badge-amarillo",
    completado: "badge-verde",
    completado_con_errores: "badge-amarillo",
    fallido: "badge-rojo"
};

const ACCION_LABEL = {
    creado: "Creado",
    actualizado: "Actualizado",
    omitido: "Omitido (sin cambios)",
    ignorado: "Ignorado (duplicado)",
    error: "Error"
};

const TIPO_INCIDENCIA_LABEL = {
    campo_nulo: "Campo obligatorio vacio",
    otro: "Otro"
};

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatDateTime(value) {
    if (!value) return "--";
    return new Date(value).toLocaleString("es-CO", {
        day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
    });
}

function formatDuracion(ms) {
    if (ms === null || ms === undefined) return "--";
    if (ms < 1000) return `${ms} ms`;
    return `${(ms / 1000).toFixed(1)} s`;
}

async function cargarStatus() {
    try {
        const { ultimaImportacionAutomatica } = await window.VehiAmb.api.getStockImportacionesStatus();

        if (!ultimaImportacionAutomatica) {
            stockImportStatusBody.innerHTML = '<p class="dash-empty">Aun no se ha ejecutado ninguna importacion automatica.</p>';
            return;
        }

        const item = ultimaImportacionAutomatica;
        stockImportStatusBody.innerHTML = `
            <div class="record-meta">
                <span class="badge ${ESTADO_CLASS[item.estado] || "badge-amarillo"}">${ESTADO_LABEL[item.estado] || item.estado}</span>
                <span class="pill">${formatDateTime(item.creado_en)}</span>
            </div>
            <p class="field-help">Nuevos: ${item.total_nuevos} · Actualizados: ${item.total_actualizados} · Omitidos: ${item.total_omitidos} · Errores: ${item.total_errores}</p>
            ${item.observaciones ? `<p class="field-help">${escapeHtml(item.observaciones)}</p>` : ""}
        `;
    } catch (error) {
        stockImportStatusBody.innerHTML = '<p class="dash-empty">No fue posible cargar el estado</p>';
    }
}

async function cargarConfigImportStatus() {
    try {
        const { ultimaImportacionAutomatica } = await window.VehiAmb.api.getConfigImportStatus();

        if (!ultimaImportacionAutomatica) {
            configImportStatusBody.innerHTML = '<p class="dash-empty">Aun no se ha ejecutado ninguna sincronizacion automatica.</p>';
            return;
        }

        const item = ultimaImportacionAutomatica;
        configImportStatusBody.innerHTML = `
            <div class="record-meta">
                <span class="badge ${ESTADO_CLASS[item.estado] || "badge-amarillo"}">${ESTADO_LABEL[item.estado] || item.estado}</span>
                <span class="pill">${formatDateTime(item.creado_en)}</span>
            </div>
            <p class="field-help">Sugeridos creados: ${item.total_sugeridos_creados} · Equivalencias creadas: ${item.total_equivalencias_creadas} · Omitidos: ${item.total_omitidos} · Incidencias: ${item.total_incidencias}</p>
        `;
    } catch (error) {
        configImportStatusBody.innerHTML = '<p class="dash-empty">No fue posible cargar el estado</p>';
    }
}

function renderRow(item) {
    return `
        <tr class="import-row" data-import-id="${item.id}" tabindex="0">
            <td>${formatDateTime(item.creado_en)}</td>
            <td>${escapeHtml(item.nombre_archivo)}</td>
            <td><span class="badge ${ESTADO_CLASS[item.estado] || "badge-amarillo"}">${ESTADO_LABEL[item.estado] || item.estado}</span></td>
            <td>${item.total_nuevos}</td>
            <td>${item.total_actualizados}</td>
            <td>${item.total_omitidos}</td>
            <td>${item.total_errores > 0 ? `<strong class="import-error-count">${item.total_errores}</strong>` : "0"}</td>
            <td>${formatDuracion(item.duracion_ms)}</td>
            <td><button type="button" class="btn-secondary" data-import-detail="${item.id}">Ver detalle</button></td>
        </tr>
    `;
}

async function cargarHistorial() {
    try {
        stockImportTableBody.innerHTML = '<tr><td colspan="9" class="dash-empty">Cargando...</td></tr>';
        const resultado = await window.VehiAmb.api.getStockImportaciones({
            estado: stockImportFiltroEstado.value || undefined,
            page: currentPage,
            limit: 15
        });

        totalPages = resultado.totalPages;

        if (!resultado.items.length) {
            stockImportTableBody.innerHTML = '<tr><td colspan="9" class="dash-empty">No hay importaciones registradas</td></tr>';
        } else {
            stockImportTableBody.innerHTML = resultado.items.map(renderRow).join("");
        }

        stockImportListSummary.textContent = `Pagina ${resultado.page} de ${resultado.totalPages} · ${resultado.total} importaciones`;
        stockImportPrevPage.disabled = currentPage <= 1;
        stockImportNextPage.disabled = currentPage >= totalPages;
    } catch (error) {
        stockImportTableBody.innerHTML = '<tr><td colspan="9" class="dash-empty">No fue posible cargar el historial</td></tr>';
    }
}

stockImportSubmitButton.addEventListener("click", async () => {
    stockImportSubmitButton.disabled = true;
    stockImportRunResult.classList.add("hidden");

    try {
        window.VehiAmb.ui.show(loader);
        const resultado = await window.VehiAmb.api.ejecutarStockImportacion();

        stockImportRunResult.classList.remove("hidden");
        stockImportRunResult.innerHTML = `
            <span class="badge ${ESTADO_CLASS[resultado.estado] || "badge-amarillo"}">${ESTADO_LABEL[resultado.estado] || resultado.estado}</span>
            <p>Leidos: ${resultado.totalLeidos} · Nuevos: ${resultado.totalNuevos} · Actualizados: ${resultado.totalActualizados} · Omitidos: ${resultado.totalOmitidos} · Errores: ${resultado.totalErrores} (${formatDuracion(resultado.duracionMs)})</p>
        `;

        window.VehiAmb.ui.showMessage(mensaje, "Importacion de stock ejecutada correctamente");
        currentPage = 1;
        await Promise.all([cargarHistorial(), cargarStatus()]);
    } catch (error) {
        console.error(error);
        stockImportRunResult.classList.remove("hidden");
        stockImportRunResult.innerHTML = `<span class="badge badge-rojo">Error</span><p>${escapeHtml(error.message || "No se pudo ejecutar la importacion de stock")}</p>`;
    } finally {
        window.VehiAmb.ui.hide(loader);
        stockImportSubmitButton.disabled = false;
    }
});

stockImportFiltroEstado.addEventListener("change", () => {
    currentPage = 1;
    cargarHistorial();
});

stockImportPrevPage.addEventListener("click", () => {
    if (currentPage <= 1) return;
    currentPage -= 1;
    cargarHistorial();
});

stockImportNextPage.addEventListener("click", () => {
    if (currentPage >= totalPages) return;
    currentPage += 1;
    cargarHistorial();
});

// ── Drawer de detalle ──────────────────────────────────────────

function renderIncidenciaRow(incidencia) {
    return `
        <article class="record-item ${incidencia.resuelta ? "notif-item--leido" : ""}">
            <div class="record-top">
                <div>
                    <span class="record-title">${TIPO_INCIDENCIA_LABEL[incidencia.tipo_incidencia] || incidencia.tipo_incidencia}</span>
                    <span class="record-sub">Fila Excel ${incidencia.fila_excel ?? "--"} · Codigo ${escapeHtml(incidencia.codigo_interno || "--")}</span>
                </div>
                <span class="pill">${incidencia.resuelta ? "Resuelta" : "Pendiente"}</span>
            </div>
            <p>${escapeHtml(incidencia.descripcion)}</p>
            ${!incidencia.resuelta ? `<div class="notif-item-actions"><button type="button" class="btn-secondary" data-resolver-incidencia="${incidencia.id}">Marcar como resuelta</button></div>` : ""}
        </article>
    `;
}

async function cargarDrawer(importacionId) {
    stockImportDrawerBody.innerHTML = '<p class="dash-empty">Cargando...</p>';
    window.VehiAmb.ui.show(stockImportDrawerBackdrop);
    window.VehiAmb.ui.show(stockImportDrawer);
    stockImportDrawer.setAttribute("aria-hidden", "false");

    try {
        const [importacion, incidencias, detalle] = await Promise.all([
            window.VehiAmb.api.getStockImportacion(importacionId),
            window.VehiAmb.api.getStockImportacionIncidencias(importacionId, { limit: 20 }),
            window.VehiAmb.api.getStockImportacionDetalle(importacionId, { limit: 15 })
        ]);

        stockImportDrawerTitle.textContent = `Importacion #${importacion.id}`;
        stockImportDrawerSubtitle.textContent = escapeHtml(importacion.nombre_archivo);

        stockImportDrawerBody.innerHTML = `
            <dl class="detail-list drawer-detail-list">
                <div><dt>Estado</dt><dd><span class="badge ${ESTADO_CLASS[importacion.estado] || "badge-amarillo"}">${ESTADO_LABEL[importacion.estado] || importacion.estado}</span></dd></div>
                <div><dt>Ejecutada por</dt><dd>${escapeHtml(importacion.usuario_nombre || "Proceso automatico")}</dd></div>
                <div><dt>Fecha de ejecucion</dt><dd>${formatDateTime(importacion.creado_en)}</dd></div>
                <div><dt>Duracion</dt><dd>${formatDuracion(importacion.duracion_ms)}</dd></div>
                <div><dt>Total leidos</dt><dd>${importacion.total_leidos}</dd></div>
                <div><dt>Nuevos / Actualizados</dt><dd>${importacion.total_nuevos} / ${importacion.total_actualizados}</dd></div>
                <div><dt>Omitidos / Errores</dt><dd>${importacion.total_omitidos} / ${importacion.total_errores}</dd></div>
                <div><dt>Hash del archivo</dt><dd class="import-hash">${importacion.hash_archivo}</dd></div>
            </dl>

            ${importacion.observaciones ? `<section class="drawer-section"><h3>Observaciones</h3><p>${escapeHtml(importacion.observaciones)}</p></section>` : ""}

            <section class="drawer-section">
                <h3>Incidencias (${incidencias.total})</h3>
                ${incidencias.items.length
                    ? incidencias.items.map(renderIncidenciaRow).join("")
                    : '<p class="dash-empty detail-empty">Sin incidencias en esta importacion.</p>'}
            </section>

            <section class="drawer-section">
                <h3>Registros procesados (ultimos ${detalle.items.length} de ${detalle.total})</h3>
                ${detalle.items.length
                    ? `<div class="table-scroll"><table class="import-table import-table-compact">
                        <thead><tr><th>Codigo</th><th>Accion</th><th>Fecha</th></tr></thead>
                        <tbody>
                            ${detalle.items.map((d) => `
                                <tr>
                                    <td>${escapeHtml(d.codigo_interno)}</td>
                                    <td>${ACCION_LABEL[d.accion] || d.accion}</td>
                                    <td>${formatDateTime(d.creado_en)}</td>
                                </tr>
                            `).join("")}
                        </tbody>
                    </table></div>`
                    : '<p class="dash-empty detail-empty">Sin registros.</p>'}
            </section>
        `;
    } catch (error) {
        stockImportDrawerBody.innerHTML = '<p class="dash-empty">No fue posible cargar el detalle de la importacion</p>';
    }
}

function closeDrawer() {
    window.VehiAmb.ui.hide(stockImportDrawerBackdrop);
    window.VehiAmb.ui.hide(stockImportDrawer);
    stockImportDrawer.setAttribute("aria-hidden", "true");
}

stockImportTableBody.addEventListener("click", (event) => {
    const button = event.target.closest("[data-import-detail]");
    if (!button) return;
    cargarDrawer(button.dataset.importDetail);
});

stockImportDrawerBody.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-resolver-incidencia]");
    if (!button) return;

    button.disabled = true;
    try {
        await window.VehiAmb.api.resolverIncidenciaStock(button.dataset.resolverIncidencia);
        const openId = stockImportDrawerTitle.textContent.replace("Importacion #", "");
        await cargarDrawer(openId);
    } catch (error) {
        window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudo resolver la incidencia", "error");
        button.disabled = false;
    }
});

closeStockImportDrawer.addEventListener("click", closeDrawer);
stockImportDrawerBackdrop.addEventListener("click", closeDrawer);
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !stockImportDrawer.classList.contains("hidden")) closeDrawer();
});

configImportSyncButton.addEventListener("click", async () => {
    configImportSyncButton.disabled = true;
    configImportResult.classList.add("hidden");

    try {
        window.VehiAmb.ui.show(loader);
        const resultado = await window.VehiAmb.api.ejecutarConfigImport();

        configImportResult.classList.remove("hidden");
        configImportResult.innerHTML = `
            <p>Sugeridos creados: ${resultado.totalSugeridosCreados} · Equivalencias creadas: ${resultado.totalEquivalenciasCreadas} · Omitidos: ${resultado.totalOmitidos} · Incidencias: ${resultado.totalIncidencias}</p>
        `;
        window.VehiAmb.ui.showMessage(mensaje, "Sincronizacion de configuracion ejecutada correctamente");
        await cargarConfigImportStatus();
    } catch (error) {
        configImportResult.classList.remove("hidden");
        configImportResult.innerHTML = `<span class="badge badge-rojo">Error</span><p>${error.message || "No se pudo ejecutar la sincronizacion"}</p>`;
    } finally {
        window.VehiAmb.ui.hide(loader);
        configImportSyncButton.disabled = false;
    }
});

document.addEventListener("DOMContentLoaded", () => {
    cargarHistorial();
    cargarStatus();
    cargarConfigImportStatus();
});
