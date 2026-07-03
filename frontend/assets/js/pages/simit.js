const summaryRow = document.getElementById("simitSummaryRow");
const filterForm = document.getElementById("simitFilterForm");
const filterPlaca = document.getElementById("filterSimitPlaca");
const filterEstado = document.getElementById("filterSimitEstado");
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

let flotaState = [];
let currentDrawerVehiculoId = null;

const ESTADO_LABELS = {
    nunca_consultado: "Nunca consultado",
    sin_multas: "Sin multas",
    con_multas: "Con multas",
    cobro_coactivo: "Cobro coactivo",
    acuerdo_pago: "Acuerdo de pago",
    desconocido: "Desconocido / error"
};

const ESTADO_PILL_CLASS = {
    nunca_consultado: "pill",
    sin_multas: "pill-success",
    con_multas: "pill-danger",
    cobro_coactivo: "pill-danger",
    acuerdo_pago: "pill-warning",
    desconocido: "pill"
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

// El backend solo informa estado_cartera cuando la consulta existio y salio
// "ok". Aqui se deriva la categoria visual que combina los tres casos: nunca
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

function renderSummary(rows) {
    const conteos = rows.reduce((acc, row) => {
        const estado = deriveEstadoCartera(row);
        acc[estado] = (acc[estado] || 0) + 1;
        return acc;
    }, {});

    const orden = ["con_multas", "cobro_coactivo", "acuerdo_pago", "sin_multas", "nunca_consultado", "desconocido"];

    summaryRow.innerHTML = `
        <span class="pill">Total: ${rows.length}</span>
        ${orden
            .filter((estado) => conteos[estado])
            .map((estado) => `<span class="pill ${estadoPillClass(estado)}">${estadoLabel(estado)}: ${conteos[estado]}</span>`)
            .join("")}
    `;
}

function matchesFilters(row) {
    const placa = filterPlaca.value.trim().toLowerCase();
    const estado = filterEstado.value;
    const rowPlaca = String(row.placa || "").toLowerCase();

    if (placa && !rowPlaca.includes(placa)) return false;
    if (estado && deriveEstadoCartera(row) !== estado) return false;

    return true;
}

function updateFilterSummary(filteredCount) {
    const total = flotaState.length;
    const hasFilters = Boolean(filterPlaca.value.trim() || filterEstado.value);

    if (!total) {
        filterSummary.textContent = "Aun no hay vehiculos registrados.";
        return;
    }

    filterSummary.textContent = hasFilters
        ? `Mostrando ${filteredCount} de ${total} vehiculos.`
        : `Mostrando todos los vehiculos (${total}).`;
}

function renderFlotaList(rows) {
    if (!rows.length) {
        flotaList.innerHTML = '<p class="dash-empty">No hay vehiculos para los filtros seleccionados</p>';
        return;
    }

    flotaList.innerHTML = rows.map((row) => {
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
                    <span class="pill">Ultima consulta: ${formatDateTime(row.fecha_consulta)}</span>
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
        flotaState = await window.VehiAmb.api.getSimitEstadoFlota();
        renderSummary(flotaState);
        applyFilters();
    } catch (error) {
        console.error(error);
        flotaList.innerHTML = '<p class="dash-empty">No fue posible cargar el estado SIMIT de la flota</p>';
        window.VehiAmb.ui.showMessage(mensaje, "No fue posible cargar el estado SIMIT de la flota", "error");
    } finally {
        window.VehiAmb.ui.hide(loader);
    }
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
                        <th>Numero</th>
                        <th>Fecha</th>
                        <th>Descripcion</th>
                        <th>Valor</th>
                        <th>Estado</th>
                    </tr>
                </thead>
                <tbody>
                    ${comparendos.map((item) => `
                        <tr>
                            <td>${escapeHtml(item.numero_comparendo)}</td>
                            <td>${item.fecha_infraccion ? formatDate(item.fecha_infraccion) : "Sin fecha"}</td>
                            <td>${escapeHtml(item.descripcion || "Sin descripcion")}</td>
                            <td>${formatCurrency(item.valor)}</td>
                            <td>${escapeHtml(item.estado)}</td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        </div>
    `;
}

function renderHistorialTable(historial) {
    if (!historial.length) {
        return '<p class="dash-empty detail-empty">Este vehiculo aun no tiene consultas SIMIT registradas.</p>';
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
                            <td>${item.origen === "masivo" ? "Actualizacion de flota" : "Manual"}</td>
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
    simitDrawerTitle.textContent = row.placa || "Vehiculo";
    simitDrawerSubtitle.textContent = `${row.marca || ""} ${row.modelo || ""}`.trim() || "Sin informacion de vehiculo";
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
                    <dt>Ultima consulta</dt>
                    <dd>${formatDateTime(row.fecha_consulta)}</dd>
                </div>
            </dl>

            ${row.mensaje_error ? `<p class="dash-empty detail-empty">Ultimo error: ${escapeHtml(row.mensaje_error)}</p>` : ""}

            <section class="drawer-section">
                <h3>Comparendos de la ultima consulta</h3>
                ${renderComparendosTable(detalle?.comparendos)}
            </section>

            <section class="drawer-section">
                <h3>Historial de consultas</h3>
                ${renderHistorialTable(historial)}
            </section>
        `;
    } catch (error) {
        console.error(error);
        simitDrawerBody.innerHTML = '<p class="dash-empty detail-empty">No fue posible cargar el historial SIMIT de este vehiculo.</p>';
    }
}

function closeDetailDrawer() {
    window.VehiAmb.ui.hide(simitDrawerBackdrop);
    window.VehiAmb.ui.hide(simitDrawer);
    simitDrawer.setAttribute("aria-hidden", "true");
    currentDrawerVehiculoId = null;
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
    try {
        window.VehiAmb.ui.show(loader);
        window.VehiAmb.ui.showMessage(mensaje, "Actualizando toda la flota, esto puede tardar varios minutos...");
        const resumen = await window.VehiAmb.api.actualizarSimitFlota();
        window.VehiAmb.ui.showMessage(
            mensaje,
            `Actualizacion completada: ${resumen.ok} ok, ${resumen.con_novedades} con novedades, ${resumen.bloqueado} bloqueadas, ${resumen.error} con error.`
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

[filterPlaca, filterEstado].forEach((input) => {
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

document.addEventListener("DOMContentLoaded", cargarFlota);
