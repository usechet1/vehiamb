const importForm = document.getElementById("importForm");
const importPeriodo = document.getElementById("importPeriodo");
const importModoDia = document.getElementById("importModoDia");
const importModoRango = document.getElementById("importModoRango");
const importGrupoDia = document.getElementById("importGrupoDia");
const importGrupoRango = document.getElementById("importGrupoRango");
const importDesde = document.getElementById("importDesde");
const importHasta = document.getElementById("importHasta");
const importSubmitButton = document.getElementById("importSubmitButton");
const importRunResult = document.getElementById("importRunResult");
const importStatusBody = document.getElementById("importStatusBody");
const importFiltroEstado = document.getElementById("importFiltroEstado");
const importTableBody = document.getElementById("importTableBody");
const importListSummary = document.getElementById("importListSummary");
const importPrevPage = document.getElementById("importPrevPage");
const importNextPage = document.getElementById("importNextPage");
const loader = document.getElementById("loader");
const mensaje = document.getElementById("mensaje");

const importDrawer = document.getElementById("importDrawer");
const importDrawerBackdrop = document.getElementById("importDrawerBackdrop");
const closeImportDrawer = document.getElementById("closeImportDrawer");
const importDrawerTitle = document.getElementById("importDrawerTitle");
const importDrawerSubtitle = document.getElementById("importDrawerSubtitle");
const importDrawerBody = document.getElementById("importDrawerBody");

let currentPage = 1;
let totalPages = 1;

const ESTADO_LABEL = {
    pendiente: "Pendiente",
    en_proceso: "En proceso",
    completado: "Completado",
    completado_con_errores: "Completado con errores",
    sin_cambios: "Sin cambios",
    fallido: "Fallido"
};

const ESTADO_CLASS = {
    pendiente: "badge-amarillo",
    en_proceso: "badge-amarillo",
    completado: "badge-verde",
    completado_con_errores: "badge-amarillo",
    sin_cambios: "badge-gris",
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
    vehiculo_no_encontrado: "Vehiculo no encontrado",
    campo_nulo: "Campo obligatorio vacio",
    formato_invalido: "Formato invalido",
    total_inconsistente: "Total inconsistente",
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

function formatDate(value) {
    if (!value) return "--";
    return new Date(String(value).slice(0, 10) + "T00:00:00").toLocaleDateString("es-CO", {
        day: "2-digit", month: "short", year: "numeric"
    });
}

function formatDuracion(ms) {
    if (ms === null || ms === undefined) return "--";
    if (ms < 1000) return `${ms} ms`;
    return `${(ms / 1000).toFixed(1)} s`;
}

function todayIso() {
    const now = new Date();
    now.setDate(now.getDate() - 1);
    return now.toISOString().slice(0, 10);
}

importPeriodo.value = todayIso();
importDesde.value = todayIso();
importHasta.value = todayIso();

function actualizarModoImportacion() {
    const esRango = importModoRango.checked;
    importGrupoDia.classList.toggle("hidden", esRango);
    importGrupoRango.classList.toggle("hidden", !esRango);
    importPeriodo.required = !esRango;
    importDesde.required = esRango;
    importHasta.required = esRango;
    importModoDia.closest(".import-modo-btn").classList.toggle("is-active", !esRango);
    importModoRango.closest(".import-modo-btn").classList.toggle("is-active", esRango);
}

importModoDia.addEventListener("change", actualizarModoImportacion);
importModoRango.addEventListener("change", actualizarModoImportacion);
actualizarModoImportacion();

async function cargarStatus() {
    try {
        const { ultimaImportacionAutomatica } = await window.VehiAmb.api.getImportacionesStatus();

        if (!ultimaImportacionAutomatica) {
            importStatusBody.innerHTML = '<p class="dash-empty">Aun no se ha ejecutado ninguna importacion automatica.</p>';
            return;
        }

        const item = ultimaImportacionAutomatica;
        importStatusBody.innerHTML = `
            <div class="record-meta">
                <span class="badge ${ESTADO_CLASS[item.estado] || "badge-amarillo"}">${ESTADO_LABEL[item.estado] || item.estado}</span>
                <span class="pill">Periodo: ${formatDate(item.periodo)}</span>
                <span class="pill">${formatDateTime(item.creado_en)}</span>
            </div>
            <p class="field-help">Nuevos: ${item.total_nuevos} · Actualizados: ${item.total_actualizados} · Omitidos: ${item.total_omitidos} · Errores: ${item.total_errores}</p>
            ${item.observaciones ? `<p class="field-help">${escapeHtml(item.observaciones)}</p>` : ""}
        `;
    } catch (error) {
        importStatusBody.innerHTML = '<p class="dash-empty">No fue posible cargar el estado</p>';
    }
}

function renderRow(item) {
    return `
        <tr class="import-row" data-import-id="${item.id}" tabindex="0">
            <td>${formatDateTime(item.creado_en)}</td>
            <td>${formatDate(item.periodo)}</td>
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
        importTableBody.innerHTML = '<tr><td colspan="10" class="dash-empty">Cargando...</td></tr>';
        const resultado = await window.VehiAmb.api.getImportaciones({
            estado: importFiltroEstado.value || undefined,
            page: currentPage,
            limit: 15
        });

        totalPages = resultado.totalPages;

        if (!resultado.items.length) {
            importTableBody.innerHTML = '<tr><td colspan="10" class="dash-empty">No hay importaciones registradas</td></tr>';
        } else {
            importTableBody.innerHTML = resultado.items.map(renderRow).join("");
        }

        importListSummary.textContent = `Pagina ${resultado.page} de ${resultado.totalPages} · ${resultado.total} importaciones`;
        importPrevPage.disabled = currentPage <= 1;
        importNextPage.disabled = currentPage >= totalPages;
    } catch (error) {
        importTableBody.innerHTML = '<tr><td colspan="10" class="dash-empty">No fue posible cargar el historial</td></tr>';
    }
}

function renderResultadoImportacion(resultado) {
    // Un solo dia: trae "estado" propio. Un rango: trae "resultados" (uno por dia) y totales sumados.
    if (!resultado.resultados) {
        return `
            <span class="badge ${ESTADO_CLASS[resultado.estado] || "badge-amarillo"}">${ESTADO_LABEL[resultado.estado] || resultado.estado}</span>
            <p>Leidos: ${resultado.totalLeidos} · Nuevos: ${resultado.totalNuevos} · Actualizados: ${resultado.totalActualizados} · Omitidos: ${resultado.totalOmitidos} · Errores: ${resultado.totalErrores} (${formatDuracion(resultado.duracionMs)})</p>
        `;
    }

    const filasPorDia = resultado.resultados.map((dia) => `
        <tr>
            <td>${formatDate(dia.periodo)}</td>
            <td><span class="badge ${ESTADO_CLASS[dia.estado] || "badge-amarillo"}">${ESTADO_LABEL[dia.estado] || dia.estado}</span></td>
            <td>${dia.totalLeidos}</td>
            <td>${dia.totalNuevos}</td>
            <td>${dia.totalActualizados}</td>
            <td>${dia.totalOmitidos}</td>
            <td>${dia.totalErrores}</td>
        </tr>
    `).join("");

    return `
        <p><strong>${resultado.totalDias} dias procesados</strong> (${formatDate(resultado.desde)} a ${formatDate(resultado.hasta)}) en ${formatDuracion(resultado.duracionMs)}</p>
        <p>Totales — Leidos: ${resultado.totalLeidos} · Nuevos: ${resultado.totalNuevos} · Actualizados: ${resultado.totalActualizados} · Omitidos: ${resultado.totalOmitidos} · Errores: ${resultado.totalErrores}</p>
        <div class="table-scroll">
            <table class="import-table import-table-compact">
                <thead><tr><th>Dia</th><th>Estado</th><th>Leidos</th><th>Nuevos</th><th>Actualizados</th><th>Omitidos</th><th>Errores</th></tr></thead>
                <tbody>${filasPorDia}</tbody>
            </table>
        </div>
    `;
}

importForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    importSubmitButton.disabled = true;
    importRunResult.classList.add("hidden");

    try {
        window.VehiAmb.ui.show(loader);
        const resultado = importModoRango.checked
            ? await window.VehiAmb.api.ejecutarImportacion({ desde: importDesde.value, hasta: importHasta.value })
            : await window.VehiAmb.api.ejecutarImportacion({ periodo: importPeriodo.value });

        importRunResult.classList.remove("hidden");
        importRunResult.innerHTML = renderResultadoImportacion(resultado);

        window.VehiAmb.ui.showMessage(mensaje, "Importacion ejecutada correctamente");
        currentPage = 1;
        await Promise.all([cargarHistorial(), cargarStatus()]);
    } catch (error) {
        console.error(error);
        importRunResult.classList.remove("hidden");
        importRunResult.innerHTML = `<span class="badge badge-rojo">Error</span><p>${escapeHtml(error.message || "No se pudo ejecutar la importacion")}</p>`;
    } finally {
        window.VehiAmb.ui.hide(loader);
        importSubmitButton.disabled = false;
    }
});

importFiltroEstado.addEventListener("change", () => {
    currentPage = 1;
    cargarHistorial();
});

importPrevPage.addEventListener("click", () => {
    if (currentPage <= 1) return;
    currentPage -= 1;
    cargarHistorial();
});

importNextPage.addEventListener("click", () => {
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
                    <span class="record-sub">Fila Excel ${incidencia.fila_excel ?? "--"} · Factura ${escapeHtml(incidencia.numero_factura || "--")}</span>
                </div>
                <span class="pill">${incidencia.resuelta ? "Resuelta" : "Pendiente"}</span>
            </div>
            <p>${escapeHtml(incidencia.descripcion)}</p>
            ${!incidencia.resuelta ? `<div class="notif-item-actions"><button type="button" class="btn-secondary" data-resolver-incidencia="${incidencia.id}">Marcar como resuelta</button></div>` : ""}
        </article>
    `;
}

async function cargarDrawer(importacionId) {
    importDrawerBody.innerHTML = '<p class="dash-empty">Cargando...</p>';
    window.VehiAmb.ui.show(importDrawerBackdrop);
    window.VehiAmb.ui.show(importDrawer);
    importDrawer.setAttribute("aria-hidden", "false");

    try {
        const [importacion, incidencias, detalle] = await Promise.all([
            window.VehiAmb.api.getImportacion(importacionId),
            window.VehiAmb.api.getImportacionIncidencias(importacionId, { limit: 20 }),
            window.VehiAmb.api.getImportacionDetalle(importacionId, { limit: 15 })
        ]);

        importDrawerTitle.textContent = `Importacion #${importacion.id}`;
        importDrawerSubtitle.textContent = `${formatDate(importacion.periodo)} · ${escapeHtml(importacion.nombre_archivo)}`;

        importDrawerBody.innerHTML = `
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
                        <thead><tr><th>Factura</th><th>Accion</th><th>Fecha</th></tr></thead>
                        <tbody>
                            ${detalle.items.map((d) => `
                                <tr>
                                    <td>${escapeHtml(d.numero_factura)}</td>
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
        importDrawerBody.innerHTML = '<p class="dash-empty">No fue posible cargar el detalle de la importacion</p>';
    }
}

function closeDrawer() {
    window.VehiAmb.ui.hide(importDrawerBackdrop);
    window.VehiAmb.ui.hide(importDrawer);
    importDrawer.setAttribute("aria-hidden", "true");
}

importTableBody.addEventListener("click", (event) => {
    const button = event.target.closest("[data-import-detail]");
    if (!button) return;
    cargarDrawer(button.dataset.importDetail);
});

importDrawerBody.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-resolver-incidencia]");
    if (!button) return;

    button.disabled = true;
    try {
        await window.VehiAmb.api.resolverIncidenciaImportacion(button.dataset.resolverIncidencia);
        const openId = importDrawerTitle.textContent.replace("Importacion #", "");
        await cargarDrawer(openId);
    } catch (error) {
        window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudo resolver la incidencia", "error");
        button.disabled = false;
    }
});

closeImportDrawer.addEventListener("click", closeDrawer);
importDrawerBackdrop.addEventListener("click", closeDrawer);
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !importDrawer.classList.contains("hidden")) closeDrawer();
});

document.addEventListener("DOMContentLoaded", () => {
    cargarHistorial();
    cargarStatus();
});
