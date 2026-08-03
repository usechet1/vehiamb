const documentoForm = document.getElementById("documentoForm");
const documentoFormTitle = document.getElementById("documentoFormTitle");
const documentoId = document.getElementById("documentoId");
const documentoTipo = document.getElementById("documentoTipo");
const documentoNumero = document.getElementById("documentoNumero");
const documentoNumeroLabel = document.getElementById("documentoNumeroLabel");
const documentoFechaExpedicion = document.getElementById("documentoFechaExpedicion");
const documentoFechaVencimiento = document.getElementById("documentoFechaVencimiento");
const documentoVencimientoGroup = document.getElementById("documentoVencimientoGroup");
const documentoPropietarioGroup = document.getElementById("documentoPropietarioGroup");
const documentoPropietario = document.getElementById("documentoPropietario");
const documentoSeguroAyuda = document.getElementById("documentoSeguroAyuda");
const documentoArchivoActual = document.getElementById("documentoArchivoActual");
const documentoSubmitButton = document.getElementById("documentoSubmitButton");
const documentoCancelEditButton = document.getElementById("documentoCancelEditButton");
const tabDocumentosHistorialButton = document.getElementById("tabDocumentosHistorialButton");
const tabDocumentosRegistrarButton = document.getElementById("tabDocumentosRegistrarButton");
const registrarDocumentoSection = document.getElementById("registrarDocumentoSection");
const documentosRegistradosSection = document.getElementById("documentosRegistradosSection");
const documentosFilterForm = document.getElementById("documentosFilterForm");
const documentoSelect = document.getElementById("vehiculoDocumento");
const documentosList = document.getElementById("documentosList");
const filterDocumentoNumero = document.getElementById("filterDocumentoNumero");
const filterDocumentoPlaca = document.getElementById("filterDocumentoPlaca");
const filterDocumentoTipo = document.getElementById("filterDocumentoTipo");
const filterDocumentoFechaDesde = document.getElementById("filterDocumentoFechaDesde");
const filterDocumentoFechaHasta = document.getElementById("filterDocumentoFechaHasta");
const documentosFilterSummary = document.getElementById("documentosFilterSummary");
const clearDocumentosFiltersButton = document.getElementById("clearDocumentosFiltersButton");
const documentosKpisGrid = document.getElementById("documentosKpisGrid");
const loader = document.getElementById("loader");
const mensaje = document.getElementById("mensaje");

let documentosState = [];
let vencimientoEditadoManualmente = false;

// Tipos con vigencia legal fija de 1 año en Colombia: al escribir la fecha de
// expedicion se sugiere el vencimiento automaticamente, pero el usuario
// puede corregirlo (ej. polizas con vigencia distinta) sin que se le pise.
const TIPOS_VENCIMIENTO_UN_ANIO = ["tecnomecanica", "soat"];

// La licencia de transito no vence (solo tiene fecha de expedicion y numero),
// a diferencia del resto de tipos que si necesitan vencimiento.
const TIPOS_SIN_VENCIMIENTO = ["licencia_transito"];

// Catalogo fijo de los dos titulares bajo los que puede quedar registrado un
// vehiculo de la flota (mismo catalogo que valida el backend en
// documentos.service.js -- si llega a agregarse un tercero hay que actualizar
// ambos lados).
const PROPIETARIOS_CATALOGO = [
    { numero_identificacion: "830514610", label: "NIT 830514610 · AMBIENTES CERAMICOS LTDA" },
    { numero_identificacion: "79539118", label: "C.C. 79539118 · RENE OSWALDO USECHE CAMACHO" }
];

documentoPropietario.innerHTML = '<option value="">Selecciona...</option>' + PROPIETARIOS_CATALOGO.map((propietario) => `
    <option value="${propietario.numero_identificacion}">${escapeHtml(propietario.label)}</option>
`).join("");

function actualizarCamposPorTipo() {
    const sinVencimiento = TIPOS_SIN_VENCIMIENTO.includes(documentoTipo.value);

    documentoVencimientoGroup.classList.toggle("hidden", sinVencimiento);
    documentoFechaVencimiento.required = !sinVencimiento;
    if (sinVencimiento) documentoFechaVencimiento.value = "";

    documentoNumero.required = sinVencimiento;
    documentoNumeroLabel.textContent = sinVencimiento ? "Número *" : "Número";

    documentoPropietarioGroup.classList.toggle("hidden", !sinVencimiento);
    documentoPropietario.required = sinVencimiento;
    if (!sinVencimiento) documentoPropietario.value = "";

    documentoSeguroAyuda.classList.toggle("hidden", documentoTipo.value !== "seguro");
}

function calcularVencimientoUnAnio(fechaExpedicion) {
    const expedicion = new Date(`${fechaExpedicion}T00:00:00`);
    if (Number.isNaN(expedicion.getTime())) return "";

    expedicion.setFullYear(expedicion.getFullYear() + 1);
    return expedicion.toISOString().slice(0, 10);
}

function autocompletarVencimiento() {
    if (vencimientoEditadoManualmente) return;
    if (!TIPOS_VENCIMIENTO_UN_ANIO.includes(documentoTipo.value)) return;
    if (!documentoFechaExpedicion.value) return;

    documentoFechaVencimiento.value = calcularVencimientoUnAnio(documentoFechaExpedicion.value);
}

function resetForm() {
    documentoForm.reset();
    documentoId.value = "";
    vencimientoEditadoManualmente = false;
    documentoFormTitle.textContent = "Registrar documento";
    documentoSubmitButton.textContent = "Guardar documento";
    documentoCancelEditButton.classList.add("hidden");
    documentoArchivoActual.classList.add("hidden");
    documentoArchivoActual.innerHTML = "";
    actualizarCamposPorTipo();
}

const tiposDocumento = {
    tecnomecanica: "RTM",
    soat: "SOAT",
    seguro: "Póliza Seguro",
    licencia_transito: "Licencia de tránsito",
    otro: "Otro"
};

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

function daysUntil(value) {
    if (!value) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const target = new Date(`${String(value).slice(0, 10)}T00:00:00`);
    if (Number.isNaN(target.getTime())) return null;

    return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

function fillVehicleSelect(select, vehiculos, placeholder = "Selecciona un vehículo", valueField = "id") {
    const previousValue = select.value;
    select.innerHTML = `<option value="">${placeholder}</option>`;

    if (!vehiculos.length) {
        select.innerHTML = '<option value="">Primero registra un vehículo</option>';
        return;
    }

    vehiculos.forEach((vehiculo) => {
        const option = document.createElement("option");
        option.value = vehiculo[valueField] || "";
        option.textContent = `${vehiculo.placa} - ${vehiculo.marca} ${vehiculo.modelo}`;
        select.appendChild(option);
    });

    if (previousValue && Array.from(select.options).some((option) => option.value === previousValue)) {
        select.value = previousValue;
    }
}

function ordenarPorUrgencia(documentos) {
    return [...documentos].sort((a, b) => {
        const daysA = daysUntil(a.fecha_vencimiento);
        const daysB = daysUntil(b.fecha_vencimiento);
        if (daysA === null && daysB === null) return 0;
        if (daysA === null) return 1;
        if (daysB === null) return -1;
        return daysA - daysB;
    });
}

function calcularKpisDocumentos(documentos) {
    return documentos.reduce((acc, item) => {
        const days = daysUntil(item.fecha_vencimiento);
        if (days === null) return acc;
        if (days < 0) acc.vencidos += 1;
        else if (days <= 30) acc.porVencer += 1;
        else acc.vigentes += 1;
        return acc;
    }, { vencidos: 0, porVencer: 0, vigentes: 0 });
}

function renderKpisDocumentos(documentos) {
    const kpis = calcularKpisDocumentos(documentos);

    documentosKpisGrid.innerHTML = `
        <div class="kpi-card" style="--kpi-accent: var(--color-ink-soft)">
            <div class="kpi-label">Total documentos</div>
            <div class="kpi-value">${documentos.length}</div>
        </div>
        <div class="kpi-card" style="--kpi-accent: var(--color-primary)">
            <div class="kpi-label">Vencidos</div>
            <div class="kpi-value">${kpis.vencidos}</div>
        </div>
        <div class="kpi-card" style="--kpi-accent: var(--color-warning)">
            <div class="kpi-label">Por vencer (30 dias)</div>
            <div class="kpi-value">${kpis.porVencer}</div>
        </div>
        <div class="kpi-card" style="--kpi-accent: var(--color-success)">
            <div class="kpi-label">Vigentes</div>
            <div class="kpi-value">${kpis.vigentes}</div>
        </div>
    `;
}

function renderDocumentos(documentos) {
    if (!documentos.length) {
        documentosList.innerHTML = '<p class="dash-empty">No hay documentos para los filtros seleccionados</p>';
        return;
    }

    documentosList.innerHTML = ordenarPorUrgencia(documentos).map((item) => {
        const days = daysUntil(item.fecha_vencimiento);
        const pillClass = days !== null && days < 0
            ? "pill-danger"
            : days !== null && days <= 30
                ? "pill-warning"
                : days !== null
                    ? "pill-success"
                    : "";
        const statusText = days === null
            ? "Sin fecha"
            : days < 0
                ? `Vencido hace ${Math.abs(days)} días`
                : `Vence en ${days} días`;

        return `
            <article class="record-item">
                <div class="record-top">
                    <div>
                        <span class="record-title">${escapeHtml(tiposDocumento[item.tipo] || item.tipo)}${item.tipo === "seguro" ? ' <span class="field-help field-help-danger">· Llama al #324 para atención de siniestros viales.</span>' : ""}</span>
                        <span class="record-sub">${escapeHtml(item.placa) || "Sin placa"} - ${escapeHtml(item.numero_documento) || "Sin número"}</span>
                    </div>
                    <span class="pill ${pillClass}">${statusText}</span>
                </div>
                <div class="record-meta">
                    <span class="pill">Expedición: ${formatDate(item.fecha_expedicion)}</span>
                    ${item.tipo === "licencia_transito"
                        ? `<span class="pill">Propietario: ${escapeHtml(item.propietario_tipo_identificacion)} ${escapeHtml(item.propietario_numero_identificacion)} · ${escapeHtml(item.propietario_nombre)}</span>`
                        : `<span class="pill">Vencimiento: ${formatDate(item.fecha_vencimiento)}</span>`}
                    ${item.archivo_url ? '<span class="pill">Adjunto disponible</span>' : ""}
                </div>
                ${item.archivo_url ? `
                    <a class="record-link" href="${escapeHtml(window.VehiAmb.api.getAssetUrl(item.archivo_url))}" target="_blank" rel="noreferrer">
                        ${escapeHtml(item.archivo_nombre) || "Ver adjunto"}
                    </a>
                ` : ""}
                ${window.VehiAmb.auth.hasPermission("documents.create") || window.VehiAmb.auth.hasPermission("documents.delete") ? `
                    <div class="record-actions">
                        ${window.VehiAmb.auth.hasPermission("documents.create") ? `<button type="button" class="btn-secondary" data-editar-documento="${item.id}">Editar</button>` : ""}
                        ${window.VehiAmb.auth.hasPermission("documents.delete") ? `<button type="button" class="btn-danger" data-eliminar-documento="${item.id}">Eliminar</button>` : ""}
                    </div>
                ` : ""}
            </article>
        `;
    }).join("");
}

function documentMatchesFilters(item) {
    const numero = filterDocumentoNumero.value.trim().toLowerCase();
    const placa = filterDocumentoPlaca.value;
    const tipo = filterDocumentoTipo.value;
    const fechaDesde = filterDocumentoFechaDesde.value;
    const fechaHasta = filterDocumentoFechaHasta.value;
    const itemFecha = String(item.fecha_vencimiento || "").slice(0, 10);

    if (numero && !String(item.numero_documento || "").toLowerCase().includes(numero)) return false;
    if (placa && item.placa !== placa) return false;
    if (tipo && item.tipo !== tipo) return false;
    if (fechaDesde && (!itemFecha || itemFecha < fechaDesde)) return false;
    if (fechaHasta && (!itemFecha || itemFecha > fechaHasta)) return false;

    return true;
}

function updateDocumentosFilterSummary(filteredCount) {
    const total = documentosState.length;
    const hasFilters = Boolean(
        filterDocumentoNumero.value ||
        filterDocumentoPlaca.value ||
        filterDocumentoTipo.value ||
        filterDocumentoFechaDesde.value ||
        filterDocumentoFechaHasta.value
    );

    if (!total) {
        documentosFilterSummary.textContent = "Aún no hay documentos registrados.";
        return;
    }

    documentosFilterSummary.textContent = hasFilters
        ? `Mostrando ${filteredCount} de ${total} documentos.`
        : `Mostrando todos los documentos (${total}).`;
}

function applyDocumentosFilters() {
    const filtered = documentosState.filter(documentMatchesFilters);
    renderDocumentos(filtered);
    renderKpisDocumentos(filtered);
    updateDocumentosFilterSummary(filtered.length);
}

async function cargarDatos() {
    try {
        window.VehiAmb.ui.show(loader);

        const vehiculos = await window.VehiAmb.api.getVehiculosCatalogo();
        fillVehicleSelect(documentoSelect, vehiculos);
        fillVehicleSelect(filterDocumentoPlaca, vehiculos, "Todas las placas", "placa");
    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(mensaje, "No fue posible cargar los vehículos", "error");
        window.VehiAmb.ui.hide(loader);
        return;
    }

    try {
        const documentos = await window.VehiAmb.api.getDocumentos();
        documentosState = documentos;
        applyDocumentosFilters();
    } catch (error) {
        console.error(error);
        documentosList.innerHTML = '<p class="dash-empty">No fue posible cargar los documentos</p>';
        updateDocumentosFilterSummary(0);
        window.VehiAmb.ui.showMessage(mensaje, "Los vehículos cargaron, pero no fue posible cargar los documentos", "error");
    } finally {
        window.VehiAmb.ui.hide(loader);
    }
}

function switchTab(tab) {
    const esRegistrar = tab === "registrar";

    tabDocumentosRegistrarButton.classList.toggle("active", esRegistrar);
    tabDocumentosHistorialButton.classList.toggle("active", !esRegistrar);
    tabDocumentosRegistrarButton.setAttribute("aria-selected", String(esRegistrar));
    tabDocumentosHistorialButton.setAttribute("aria-selected", String(!esRegistrar));

    window.VehiAmb.ui[esRegistrar ? "show" : "hide"](registrarDocumentoSection);
    window.VehiAmb.ui[esRegistrar ? "hide" : "show"](documentosRegistradosSection);
}

tabDocumentosHistorialButton.addEventListener("click", () => switchTab("historial"));
tabDocumentosRegistrarButton.addEventListener("click", () => switchTab("registrar"));

documentoTipo.addEventListener("change", () => {
    actualizarCamposPorTipo();
    autocompletarVencimiento();
});
documentoFechaExpedicion.addEventListener("change", autocompletarVencimiento);
documentoFechaVencimiento.addEventListener("input", () => {
    vencimientoEditadoManualmente = true;
});

documentosList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-editar-documento]");
    if (!button) return;

    const item = documentosState.find((doc) => String(doc.id) === button.dataset.editarDocumento);
    if (!item) return;

    documentoId.value = item.id;
    documentoSelect.value = item.vehiculo_id;
    documentoTipo.value = item.tipo;
    actualizarCamposPorTipo();
    documentoForm.querySelector('[name="numero_documento"]').value = item.numero_documento || "";
    documentoFechaExpedicion.value = String(item.fecha_expedicion || "").slice(0, 10);
    documentoFechaVencimiento.value = String(item.fecha_vencimiento || "").slice(0, 10);
    documentoPropietario.value = item.propietario_numero_identificacion || "";
    vencimientoEditadoManualmente = true;

    if (item.archivo_url) {
        const archivoUrl = window.VehiAmb.api.getAssetUrl(item.archivo_url);
        documentoArchivoActual.innerHTML = `Archivo actual: <a href="${escapeHtml(archivoUrl)}" target="_blank" rel="noreferrer">${escapeHtml(item.archivo_nombre || "ver archivo")}</a> (sube uno nuevo para reemplazarlo)`;
        documentoArchivoActual.classList.remove("hidden");
    } else {
        documentoArchivoActual.classList.add("hidden");
        documentoArchivoActual.innerHTML = "";
    }

    documentoFormTitle.textContent = "Editar documento";
    documentoSubmitButton.textContent = "Guardar cambios";
    documentoCancelEditButton.classList.remove("hidden");
    switchTab("registrar");
    documentoForm.scrollIntoView({ behavior: "smooth", block: "start" });
});

documentoCancelEditButton.addEventListener("click", resetForm);

documentosList.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-eliminar-documento]");
    if (!button) return;

    const item = documentosState.find((doc) => String(doc.id) === button.dataset.eliminarDocumento);
    if (!item) return;

    const confirmado = await window.VehiAmb.ui.confirm({
        title: "Eliminar documento",
        message: `Se eliminará el documento "${tiposDocumento[item.tipo] || item.tipo}" de ${item.placa || "este vehículo"} (${item.numero_documento || "sin número"}). Esta acción no se puede deshacer.`,
        confirmText: "Eliminar"
    });
    if (!confirmado) return;

    try {
        window.VehiAmb.ui.show(loader);
        await window.VehiAmb.api.deleteDocumento(item.id);
        window.VehiAmb.ui.showMessage(mensaje, "Documento eliminado correctamente");
        if (documentoId.value === String(item.id)) resetForm();
        await cargarDatos();
    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudo eliminar el documento", "error");
    } finally {
        window.VehiAmb.ui.hide(loader);
    }
});

documentoForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(documentoForm);

    try {
        window.VehiAmb.ui.show(loader);

        if (documentoId.value) {
            await window.VehiAmb.api.updateDocumento(documentoId.value, formData);
            window.VehiAmb.ui.showMessage(mensaje, "Documento actualizado correctamente");
        } else {
            await window.VehiAmb.api.createDocumento(formData);
            window.VehiAmb.ui.showMessage(mensaje, "Documento guardado correctamente");
        }

        resetForm();
        await cargarDatos();
        switchTab("historial");
    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(mensaje, error.message || "Error al guardar el documento", "error");
    } finally {
        window.VehiAmb.ui.hide(loader);
    }
});

documentosFilterForm.addEventListener("submit", (event) => {
    event.preventDefault();
});

[filterDocumentoNumero, filterDocumentoFechaDesde, filterDocumentoFechaHasta].forEach((input) => {
    input.addEventListener("input", applyDocumentosFilters);
});

[filterDocumentoPlaca, filterDocumentoTipo].forEach((select) => {
    select.addEventListener("change", applyDocumentosFilters);
});

clearDocumentosFiltersButton.addEventListener("click", () => {
    documentosFilterForm.reset();
    applyDocumentosFilters();
});

document.addEventListener("DOMContentLoaded", async () => {
    await window.VehiAmb.auth.fetchCurrentUser();

    if (!window.VehiAmb.auth.hasPermission("documents.create")) {
        tabDocumentosRegistrarButton?.classList.add("hidden");
    }

    cargarDatos();
});
