const documentoForm = document.getElementById("documentoForm");
const documentosFilterForm = document.getElementById("documentosFilterForm");
const documentoSelect = document.getElementById("vehiculoDocumento");
const documentosList = document.getElementById("documentosList");
const filterDocumentoPlaca = document.getElementById("filterDocumentoPlaca");
const filterDocumentoFechaDesde = document.getElementById("filterDocumentoFechaDesde");
const filterDocumentoFechaHasta = document.getElementById("filterDocumentoFechaHasta");
const documentosFilterSummary = document.getElementById("documentosFilterSummary");
const clearDocumentosFiltersButton = document.getElementById("clearDocumentosFiltersButton");
const loader = document.getElementById("loader");
const mensaje = document.getElementById("mensaje");

let documentosState = [];

const tiposDocumento = {
    tecnomecanica: "Tecnomecanica",
    soat: "SOAT",
    seguro: "Seguro",
    tarjeta_operacion: "Tarjeta de operacion",
    otro: "Otro"
};

function formatDate(value) {
    if (!value) return "Sin fecha";
    return new Date(`${value}T00:00:00`).toLocaleDateString("es-CO", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

function daysUntil(value) {
    if (!value) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const target = new Date(`${value}T00:00:00`);
    return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

function fillVehicleSelect(select, vehiculos) {
    select.innerHTML = '<option value="">Selecciona un vehiculo</option>';

    if (!vehiculos.length) {
        select.innerHTML = '<option value="">Primero registra un vehiculo</option>';
        return;
    }

    vehiculos.forEach((vehiculo) => {
        const option = document.createElement("option");
        option.value = vehiculo.id;
        option.textContent = `${vehiculo.placa} - ${vehiculo.marca} ${vehiculo.modelo}`;
        select.appendChild(option);
    });
}

function renderDocumentos(documentos) {
    if (!documentos.length) {
        documentosList.innerHTML = '<p class="dash-empty">No hay documentos para los filtros seleccionados</p>';
        return;
    }

    documentosList.innerHTML = documentos.map((item) => {
        const days = daysUntil(item.fecha_vencimiento);
        const pillClass = days !== null && days < 0
            ? "pill-danger"
            : days !== null && days <= 30
                ? "pill-warning"
                : "";
        const statusText = days === null
            ? "Sin fecha"
            : days < 0
                ? `Vencido hace ${Math.abs(days)} dias`
                : `Vence en ${days} dias`;

        return `
            <article class="record-item">
                <div class="record-top">
                    <div>
                        <span class="record-title">${tiposDocumento[item.tipo] || item.tipo}</span>
                        <span class="record-sub">${item.placa || "Sin placa"} - ${item.numero_documento || "Sin numero"}</span>
                    </div>
                    <span class="pill ${pillClass}">${statusText}</span>
                </div>
                <div class="record-meta">
                    <span class="pill">Expedicion: ${formatDate(item.fecha_expedicion)}</span>
                    <span class="pill">Vencimiento: ${formatDate(item.fecha_vencimiento)}</span>
                </div>
            </article>
        `;
    }).join("");
}

function documentMatchesFilters(item) {
    const placa = filterDocumentoPlaca.value.trim().toLowerCase();
    const fechaDesde = filterDocumentoFechaDesde.value;
    const fechaHasta = filterDocumentoFechaHasta.value;
    const itemPlaca = String(item.placa || "").toLowerCase();
    const itemFecha = String(item.fecha_vencimiento || "").slice(0, 10);

    if (placa && !itemPlaca.includes(placa)) return false;
    if (fechaDesde && (!itemFecha || itemFecha < fechaDesde)) return false;
    if (fechaHasta && (!itemFecha || itemFecha > fechaHasta)) return false;

    return true;
}

function updateDocumentosFilterSummary(filteredCount) {
    const total = documentosState.length;
    const hasFilters = Boolean(
        filterDocumentoPlaca.value.trim() ||
        filterDocumentoFechaDesde.value ||
        filterDocumentoFechaHasta.value
    );

    if (!total) {
        documentosFilterSummary.textContent = "Aun no hay documentos registrados.";
        return;
    }

    documentosFilterSummary.textContent = hasFilters
        ? `Mostrando ${filteredCount} de ${total} documentos.`
        : `Mostrando todos los documentos (${total}).`;
}

function applyDocumentosFilters() {
    const filtered = documentosState.filter(documentMatchesFilters);
    renderDocumentos(filtered);
    updateDocumentosFilterSummary(filtered.length);
}

async function cargarDatos() {
    try {
        window.VehiAmb.ui.show(loader);

        const vehiculos = await window.VehiAmb.api.getVehiculos();
        fillVehicleSelect(documentoSelect, vehiculos);
    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(mensaje, "No fue posible cargar los vehiculos", "error");
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
        window.VehiAmb.ui.showMessage(mensaje, "Los vehiculos cargaron, pero no fue posible cargar los documentos", "error");
    } finally {
        window.VehiAmb.ui.hide(loader);
    }
}

documentoForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(documentoForm);
    const payload = Object.fromEntries(formData.entries());

    try {
        window.VehiAmb.ui.show(loader);
        await window.VehiAmb.api.createDocumento(payload);
        window.VehiAmb.ui.showMessage(mensaje, "Documento guardado correctamente");
        documentoForm.reset();
        await cargarDatos();
    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(mensaje, "Error al guardar el documento", "error");
    } finally {
        window.VehiAmb.ui.hide(loader);
    }
});

documentosFilterForm.addEventListener("submit", (event) => {
    event.preventDefault();
});

[filterDocumentoPlaca, filterDocumentoFechaDesde, filterDocumentoFechaHasta].forEach((input) => {
    input.addEventListener("input", applyDocumentosFilters);
});

clearDocumentosFiltersButton.addEventListener("click", () => {
    documentosFilterForm.reset();
    applyDocumentosFilters();
});

document.addEventListener("DOMContentLoaded", cargarDatos);
