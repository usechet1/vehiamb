const mantenimientoForm = document.getElementById("mantenimientoForm");
const mantenimientosFilterForm = document.getElementById("mantenimientosFilterForm");
const mantenimientoSelect = document.getElementById("vehiculoMantenimiento");
const mantenimientosList = document.getElementById("mantenimientosList");
const filterPlaca = document.getElementById("filterPlaca");
const filterTipo = document.getElementById("filterTipo");
const filterFechaDesde = document.getElementById("filterFechaDesde");
const filterFechaHasta = document.getElementById("filterFechaHasta");
const filterSummary = document.getElementById("filterSummary");
const clearFiltersButton = document.getElementById("clearFiltersButton");
const loader = document.getElementById("loader");
const mensaje = document.getElementById("mensaje");
const mantenimientoKilometraje = document.getElementById("mantenimientoKilometraje");
const kilometrajeHelp = document.getElementById("kilometrajeHelp");
const repuestosData = document.getElementById("repuestosData");
const repuestoInput = document.getElementById("repuestoInput");
const repuestoProveedorInput = document.getElementById("repuestoProveedorInput");
const repuestoValorInput = document.getElementById("repuestoValorInput");
const repuestoNotasInput = document.getElementById("repuestoNotasInput");
const addRepuestoButton = document.getElementById("addRepuestoButton");
const repuestosList = document.getElementById("repuestosList");
const repuestosEmpty = document.getElementById("repuestosEmpty");
const valorManoObraInput = document.getElementById("valorManoObraInput");
const costoTotalDisplay = document.getElementById("costoTotalDisplay");
const mantenimientoTipo = document.getElementById("mantenimientoTipo");
const cambioAceiteFields = document.getElementById("cambioAceiteFields");
const proximoCambioKmInput = document.getElementById("proximoCambioKmInput");
const proximoCambioFechaInput = document.getElementById("proximoCambioFechaInput");
const maintenanceDrawer = document.getElementById("maintenanceDrawer");
const maintenanceDrawerBackdrop = document.getElementById("maintenanceDrawerBackdrop");
const closeMaintenanceDrawer = document.getElementById("closeMaintenanceDrawer");
const maintenanceDrawerTitle = document.getElementById("maintenanceDrawerTitle");
const maintenanceDrawerSubtitle = document.getElementById("maintenanceDrawerSubtitle");
const maintenanceDrawerBody = document.getElementById("maintenanceDrawerBody");
const exportMaintenanceButton = document.getElementById("exportMaintenanceButton");
const exportHistorialButton = document.getElementById("exportHistorialButton");

let repuestosState = [];
let mantenimientosState = [];
let vehiculosState = [];
let totalMantenimientosCount = 0;
let filtersRequestToken = 0;
let currentDetailItem = null;

const tiposMantenimiento = {
    revision: "Revision general",
    preventivo: "Preventivo",
    correctivo: "Correctivo",
    cambio_aceite: "Cambio de aceite",
    frenos: "Frenos",
    llantas: "Llantas",
    otro: "Otro"
};

const estadosMantenimiento = {
    pendiente: "Pendiente de aprobacion",
    aprobado: "Aprobado",
    rechazado: "Rechazado",
    completado: "Completado"
};

function formatCurrency(value) {
    return new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        maximumFractionDigits: 0
    }).format(Number(value || 0));
}

function formatDate(value) {
    if (!value) return "Sin fecha";

    const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
    if (Number.isNaN(date.getTime())) return "Sin fecha";

    return date.toLocaleDateString("es-CO", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

function formatDateTime(value) {
    if (!value) return "Sin fecha";
    return new Date(value).toLocaleString("es-CO", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
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

function selectedVehicle() {
    return vehiculosState.find((vehiculo) => String(vehiculo.id) === String(mantenimientoSelect.value));
}

function fillVehicleSelect(select, vehiculos, placeholder = "Selecciona un vehiculo", valueField = "id") {
    const previousValue = select.value;
    select.innerHTML = `<option value="">${placeholder}</option>`;

    if (!vehiculos.length) {
        select.innerHTML = '<option value="">Primero registra un vehiculo</option>';
        return;
    }

    vehiculos.forEach((vehiculo) => {
        const option = document.createElement("option");
        option.value = vehiculo[valueField] || "";
        option.dataset.kilometraje = vehiculo.kilometraje_actual || 0;
        option.textContent = `${vehiculo.placa} - ${vehiculo.marca} ${vehiculo.modelo}`;
        select.appendChild(option);
    });

    if (previousValue && Array.from(select.options).some((option) => option.value === previousValue)) {
        select.value = previousValue;
    }
}

function updateKilometrajeValidation() {
    const vehiculo = selectedVehicle();
    const minKm = Number(vehiculo?.kilometraje_actual || 0);

    mantenimientoKilometraje.min = String(minKm);
    mantenimientoKilometraje.setCustomValidity("");

    if (!vehiculo) {
        kilometrajeHelp.textContent = "Selecciona un vehiculo para validar el kilometraje.";
        return;
    }

    kilometrajeHelp.textContent = `Kilometraje actual registrado: ${minKm.toLocaleString("es-CO")} km. El nuevo valor no puede ser menor.`;

    const value = mantenimientoKilometraje.value;
    if (value !== "" && Number(value) < minKm) {
        mantenimientoKilometraje.setCustomValidity(`El kilometraje debe ser mayor o igual a ${minKm.toLocaleString("es-CO")} km.`);
    }
}

function validateKilometrajeBeforeSubmit() {
    updateKilometrajeValidation();

    if (!mantenimientoKilometraje.checkValidity()) {
        mantenimientoKilometraje.reportValidity();
        window.VehiAmb.ui.showMessage(mensaje, mantenimientoKilometraje.validationMessage, "error");
        return false;
    }

    return true;
}

function updateCambioAceiteFields() {
    const isCambioAceite = mantenimientoTipo.value === "cambio_aceite";

    cambioAceiteFields.classList.toggle("hidden", !isCambioAceite);
    proximoCambioKmInput.required = isCambioAceite;
    proximoCambioFechaInput.required = isCambioAceite;

    if (!isCambioAceite) {
        proximoCambioKmInput.value = "";
        proximoCambioFechaInput.value = "";
    }
}

function parseRepuestos(value) {
    if (!value) return [];

    if (Array.isArray(value)) {
        return value
            .filter(Boolean)
            .map((item) => {
                if (typeof item === "string") {
                    return { repuesto: item.trim(), proveedor: "", valor: "", notas: "" };
                }

                return {
                    repuesto: String(item.repuesto || item.nombre || "").trim(),
                    proveedor: String(item.proveedor || "").trim(),
                    valor: item.valor ?? "",
                    notas: String(item.notas || "").trim()
                };
            })
            .filter((item) => item.repuesto);
    }

    if (typeof value === "string") {
        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) {
                return parseRepuestos(parsed);
            }
        } catch (error) {
            // Fallback para formatos antiguos en texto plano.
        }

        return value
            .split(/\n|,/)
            .map((item) => ({ repuesto: item.trim(), proveedor: "", valor: "", notas: "" }))
            .filter((item) => item.repuesto);
    }

    return [];
}

function syncRepuestosField() {
    repuestosData.value = JSON.stringify(repuestosState);
}

function updateCostoTotal() {
    const manoObra = Number(valorManoObraInput.value || 0);
    const totalRepuestos = repuestosState.reduce((sum, item) => sum + Number(item.valor || 0), 0);
    costoTotalDisplay.value = formatCurrency(manoObra + totalRepuestos);
}

function renderRepuestosBuilder() {
    repuestosList.innerHTML = repuestosState.map((item, index) => `
        <li class="simple-checklist-item">
            <div class="simple-checklist-content">
                <span class="simple-checklist-label">${item.repuesto}</span>
                <span class="simple-checklist-detail">${item.proveedor || "Sin proveedor"}</span>
                <span class="simple-checklist-detail">${item.valor ? formatCurrency(item.valor) : "Sin valor"}</span>
                <span class="simple-checklist-detail">${item.notas || "Sin notas"}</span>
            </div>
            <button type="button" class="simple-checklist-remove" data-index="${index}">Quitar</button>
        </li>
    `).join("");

    repuestosEmpty.classList.toggle("hidden", repuestosState.length > 0);
    syncRepuestosField();
    updateCostoTotal();

    repuestosList.querySelectorAll(".simple-checklist-remove").forEach((button) => {
        button.addEventListener("click", () => {
            const index = Number(button.dataset.index);
            repuestosState.splice(index, 1);
            renderRepuestosBuilder();
        });
    });
}

function addRepuesto() {
    const repuesto = repuestoInput.value.trim();
    const proveedor = repuestoProveedorInput.value.trim();
    const valor = repuestoValorInput.value.trim();
    const notas = repuestoNotasInput.value.trim();

    if (!repuesto) return;

    repuestosState.push({ repuesto, proveedor, valor, notas });
    repuestoInput.value = "";
    repuestoProveedorInput.value = "";
    repuestoValorInput.value = "";
    repuestoNotasInput.value = "";
    renderRepuestosBuilder();
    repuestoInput.focus();
}

function renderRepuestosMeta(value) {
    const repuestos = parseRepuestos(value);

    if (!repuestos.length) {
        return '<span class="pill">Repuestos: No registrados</span>';
    }

    return repuestos.map((repuesto) => `
        <span class="pill">
            ${repuesto.repuesto}
            ${repuesto.proveedor ? ` - ${repuesto.proveedor}` : ""}
            ${repuesto.valor ? ` - ${formatCurrency(repuesto.valor)}` : ""}
            ${repuesto.notas ? ` - ${repuesto.notas}` : ""}
        </span>
    `).join("");
}

function renderAttachment(item) {
    if (!item.soporte_url) return "";

    const fileUrl = window.VehiAmb.api.getAssetUrl(item.soporte_url);
    const fileLabel = item.soporte_nombre || "Ver adjunto";

    return `
        <a class="record-link" href="${fileUrl}" target="_blank" rel="noreferrer">
            ${fileLabel}
        </a>
    `;
}

function renderDetailAttachment(item) {
    if (!item.soporte_url) {
        return '<p class="dash-empty detail-empty">No hay archivos adjuntos.</p>';
    }

    const fileUrl = window.VehiAmb.api.getAssetUrl(item.soporte_url);
    const fileLabel = escapeHtml(item.soporte_nombre || "Ver adjunto");
    const mime = String(item.soporte_mime || "");
    const isImage = mime.startsWith("image/");

    return `
        <div class="detail-attachment">
            ${isImage ? `<img src="${fileUrl}" alt="${fileLabel}">` : ""}
            <a class="record-link" href="${fileUrl}" target="_blank" rel="noreferrer">${fileLabel}</a>
            <span class="pill">${escapeHtml(mime || "Archivo adjunto")}</span>
        </div>
    `;
}

function detailRow(label, value) {
    return `
        <div>
            <dt>${escapeHtml(label)}</dt>
            <dd>${escapeHtml(value || "--")}</dd>
        </div>
    `;
}

function renderDetailRepuestos(value) {
    const repuestos = parseRepuestos(value);

    if (!repuestos.length) {
        return '<p class="dash-empty detail-empty">No hay repuestos registrados.</p>';
    }

    return `
        <div class="detail-parts-list">
            ${repuestos.map((repuesto) => `
                <article class="detail-part-item">
                    <strong>${escapeHtml(repuesto.repuesto)}</strong>
                    <span>Proveedor: ${escapeHtml(repuesto.proveedor || "Sin proveedor")}</span>
                    <span>${escapeHtml(repuesto.valor ? formatCurrency(repuesto.valor) : "Sin valor")}</span>
                    <p>${escapeHtml(repuesto.notas || "Sin notas")}</p>
                </article>
            `).join("")}
        </div>
    `;
}

function openMaintenanceDetail(item) {
    currentDetailItem = item;
    const vehicleName = `${item.marca || ""} ${item.modelo || ""}`.trim() || "Vehiculo";

    maintenanceDrawerTitle.textContent = tiposMantenimiento[item.tipo] || item.tipo || "Mantenimiento";
    maintenanceDrawerSubtitle.textContent = `${item.placa || "Sin placa"} - ${vehicleName}`;
    maintenanceDrawerBody.innerHTML = `
        <dl class="detail-list drawer-detail-list">
            ${detailRow("Vehiculo", vehicleName)}
            ${detailRow("Placa", item.placa || "Sin placa")}
            ${detailRow("Estado", estadosMantenimiento[item.estado] || item.estado || "Completado")}
            ${detailRow("Fecha", formatDate(item.fecha))}
            ${detailRow("Tipo", tiposMantenimiento[item.tipo] || item.tipo)}
            ${detailRow("Valor", formatCurrency(item.valor))}
            ${detailRow("Kilometraje", `${Number(item.kilometraje || 0).toLocaleString("es-CO")} km`)}
            ${detailRow("Autorizado por", item.autorizado_por || "No registrado")}
            ${detailRow("Realizado por", item.hecho_por || "No registrado")}
            ${detailRow("Fecha de creacion", formatDateTime(item.created_at))}
        </dl>

        <section class="drawer-section">
            <h3>Descripcion / trabajo realizado</h3>
            <p>${escapeHtml(item.descripcion || "Sin detalle de revision")}</p>
        </section>

        <section class="drawer-section">
            <h3>Repuestos utilizados</h3>
            ${renderDetailRepuestos(item.repuestos)}
        </section>

        <section class="drawer-section">
            <h3>Archivos adjuntos</h3>
            ${renderDetailAttachment(item)}
        </section>
    `;

    window.VehiAmb.ui.show(maintenanceDrawerBackdrop);
    window.VehiAmb.ui.show(maintenanceDrawer);
    maintenanceDrawer.setAttribute("aria-hidden", "false");
    closeMaintenanceDrawer.focus();
}

function closeDetailDrawer() {
    window.VehiAmb.ui.hide(maintenanceDrawerBackdrop);
    window.VehiAmb.ui.hide(maintenanceDrawer);
    maintenanceDrawer.setAttribute("aria-hidden", "true");
}

function renderMantenimientos(mantenimientos) {
    if (!mantenimientos.length) {
        mantenimientosList.innerHTML = '<p class="dash-empty">No hay mantenimientos para los filtros seleccionados</p>';
        return;
    }

    mantenimientosList.innerHTML = mantenimientos.map((item) => `
        <article class="record-item clickable-record" data-maintenance-id="${item.id}" tabindex="0" role="button" aria-label="Ver detalle de mantenimiento ${item.placa || ""}">
            <div class="record-top">
                <div>
                    <span class="record-title">${tiposMantenimiento[item.tipo] || item.tipo}</span>
                    <span class="record-sub">${item.placa || "Sin placa"} - ${item.marca || ""} ${item.modelo || ""}</span>
                </div>
                <span class="pill">${formatDate(item.fecha)}</span>
            </div>
            <p>${item.descripcion || "Sin detalle de revision"}</p>
            <div class="record-meta">
                <span class="pill">${formatCurrency(item.valor)}</span>
                <span class="pill">${Number(item.kilometraje || 0).toLocaleString("es-CO")} km</span>
                <span class="pill">${estadosMantenimiento[item.estado] || item.estado || "Completado"}</span>
                ${item.vehiculo_varado ? '<span class="pill">Vehiculo varado</span>' : ""}
                ${renderRepuestosMeta(item.repuestos)}
                <span class="pill">Autorizado por: ${item.autorizado_por || "No registrado"}</span>
                <span class="pill">Hecho por: ${item.hecho_por || "No registrado"}</span>
                ${item.soporte_url ? '<span class="pill">Soporte adjunto</span>' : ""}
            </div>
            ${renderAttachment(item)}
        </article>
    `).join("");
}

function currentMaintenanceFilters() {
    return {
        placa: filterPlaca.value.trim(),
        tipo: filterTipo.value,
        fecha_desde: filterFechaDesde.value,
        fecha_hasta: filterFechaHasta.value
    };
}

function updateFilterSummary(filteredCount) {
    const total = totalMantenimientosCount;
    const filters = currentMaintenanceFilters();
    const hasFilters = Boolean(filters.placa || filters.tipo || filters.fecha_desde || filters.fecha_hasta);

    if (!total) {
        filterSummary.textContent = "Aun no hay mantenimientos registrados.";
        return;
    }

    filterSummary.textContent = hasFilters
        ? `Mostrando ${filteredCount} de ${total} mantenimientos.`
        : `Mostrando todos los mantenimientos (${total}).`;
}

async function applyMaintenanceFilters() {
    const requestToken = ++filtersRequestToken;

    try {
        window.VehiAmb.ui.show(loader);
        const mantenimientos = await window.VehiAmb.api.getMantenimientos(currentMaintenanceFilters());
        if (requestToken !== filtersRequestToken) return;

        mantenimientosState = mantenimientos;
        renderMantenimientos(mantenimientos);
        updateFilterSummary(mantenimientos.length);
    } catch (error) {
        if (requestToken !== filtersRequestToken) return;

        console.error(error);
        mantenimientosList.innerHTML = '<p class="dash-empty">No fue posible cargar el historial de mantenimientos</p>';
        updateFilterSummary(0);
    } finally {
        if (requestToken === filtersRequestToken) window.VehiAmb.ui.hide(loader);
    }
}

async function cargarDatos() {
    try {
        window.VehiAmb.ui.show(loader);

        const vehiculos = await window.VehiAmb.api.getVehiculosCatalogo();
        vehiculosState = vehiculos;
        fillVehicleSelect(mantenimientoSelect, vehiculos);
        fillVehicleSelect(filterPlaca, vehiculos, "Todas las placas", "placa");

        const vehiculoPreseleccionado = new URLSearchParams(window.location.search).get("vehiculo");
        if (vehiculoPreseleccionado && Array.from(mantenimientoSelect.options).some((option) => option.value === vehiculoPreseleccionado)) {
            mantenimientoSelect.value = vehiculoPreseleccionado;
        }

        updateKilometrajeValidation();
    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(mensaje, "No fue posible cargar los vehiculos", "error");
        window.VehiAmb.ui.hide(loader);
        return;
    }

    try {
        const todosLosMantenimientos = await window.VehiAmb.api.getMantenimientos();
        totalMantenimientosCount = todosLosMantenimientos.length;
        await applyMaintenanceFilters();
    } catch (error) {
        console.error(error);
        mantenimientosList.innerHTML = '<p class="dash-empty">No fue posible cargar el historial de mantenimientos</p>';
        updateFilterSummary(0);
        window.VehiAmb.ui.showMessage(mensaje, "Los vehiculos cargaron, pero no fue posible cargar el historial", "error");
    } finally {
        window.VehiAmb.ui.hide(loader);
    }
}

mantenimientoForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!validateKilometrajeBeforeSubmit()) return;

    const formData = new FormData(mantenimientoForm);

    try {
        window.VehiAmb.ui.show(loader);
        await window.VehiAmb.api.createMantenimiento(formData);
        window.VehiAmb.ui.showMessage(mensaje, "Mantenimiento guardado correctamente");
        mantenimientoForm.reset();
        repuestosState = [];
        renderRepuestosBuilder();
        updateKilometrajeValidation();
        updateCostoTotal();
        updateCambioAceiteFields();
        await cargarDatos();
    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(mensaje, error.message || "Error al guardar el mantenimiento", "error");
    } finally {
        window.VehiAmb.ui.hide(loader);
    }
});

mantenimientoSelect.addEventListener("change", updateKilometrajeValidation);
mantenimientoKilometraje.addEventListener("input", updateKilometrajeValidation);
valorManoObraInput.addEventListener("input", updateCostoTotal);
mantenimientoTipo.addEventListener("change", updateCambioAceiteFields);

mantenimientosFilterForm.addEventListener("submit", (event) => {
    event.preventDefault();
});

[filterPlaca, filterTipo, filterFechaDesde, filterFechaHasta].forEach((input) => {
    input.addEventListener("input", applyMaintenanceFilters);
    input.addEventListener("change", applyMaintenanceFilters);
});

clearFiltersButton.addEventListener("click", () => {
    mantenimientosFilterForm.reset();
    applyMaintenanceFilters();
});

mantenimientosList.addEventListener("click", (event) => {
    if (event.target.closest("a")) return;

    const card = event.target.closest("[data-maintenance-id]");
    if (!card) return;

    const item = mantenimientosState.find((maintenance) => String(maintenance.id) === String(card.dataset.maintenanceId));
    if (item) openMaintenanceDetail(item);
});

mantenimientosList.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;

    const card = event.target.closest("[data-maintenance-id]");
    if (!card) return;

    event.preventDefault();
    const item = mantenimientosState.find((maintenance) => String(maintenance.id) === String(card.dataset.maintenanceId));
    if (item) openMaintenanceDetail(item);
});

closeMaintenanceDrawer.addEventListener("click", closeDetailDrawer);
maintenanceDrawerBackdrop.addEventListener("click", closeDetailDrawer);

exportMaintenanceButton.addEventListener("click", async () => {
    if (!currentDetailItem) return;

    const originalLabel = exportMaintenanceButton.textContent;
    exportMaintenanceButton.disabled = true;
    exportMaintenanceButton.textContent = "Generando...";

    try {
        await window.VehiAmb.mantenimientos.exportPdf(currentDetailItem);
    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudo exportar el PDF", "error");
    } finally {
        exportMaintenanceButton.disabled = false;
        exportMaintenanceButton.textContent = originalLabel;
    }
});

exportHistorialButton.addEventListener("click", async () => {
    const originalLabel = exportHistorialButton.textContent;
    exportHistorialButton.disabled = true;
    exportHistorialButton.textContent = "Generando...";

    try {
        await window.VehiAmb.mantenimientos.exportHistorialPdf(mantenimientosState, currentMaintenanceFilters());
    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudo exportar el historial", "error");
    } finally {
        exportHistorialButton.disabled = false;
        exportHistorialButton.textContent = originalLabel;
    }
});

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !maintenanceDrawer.classList.contains("hidden")) {
        closeDetailDrawer();
    }
});

addRepuestoButton.addEventListener("click", addRepuesto);
repuestoInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        event.preventDefault();
        addRepuesto();
    }
});

document.addEventListener("DOMContentLoaded", () => {
    renderRepuestosBuilder();
    updateCostoTotal();
    updateCambioAceiteFields();
    cargarDatos();
});
