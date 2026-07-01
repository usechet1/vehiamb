const documentoForm = document.getElementById("documentoForm");
const documentosFilterForm = document.getElementById("documentosFilterForm");
const documentoSelect = document.getElementById("vehiculoDocumento");
const documentosList = document.getElementById("documentosList");
const filterDocumentoPlaca = document.getElementById("filterDocumentoPlaca");
const filterDocumentoTipo = document.getElementById("filterDocumentoTipo");
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
        option.textContent = `${vehiculo.placa} - ${vehiculo.marca} ${vehiculo.modelo}`;
        select.appendChild(option);
    });

    if (previousValue && Array.from(select.options).some((option) => option.value === previousValue)) {
        select.value = previousValue;
    }
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
                    ${item.archivo_url ? '<span class="pill">Adjunto disponible</span>' : ""}
                </div>
                ${item.archivo_url ? `
                    <a class="record-link" href="${window.VehiAmb.api.getAssetUrl(item.archivo_url)}" target="_blank" rel="noreferrer">
                        ${item.archivo_nombre || "Ver adjunto"}
                    </a>
                ` : ""}
            </article>
        `;
    }).join("");
}

function documentMatchesFilters(item) {
    const placa = filterDocumentoPlaca.value;
    const tipo = filterDocumentoTipo.value;
    const fechaDesde = filterDocumentoFechaDesde.value;
    const fechaHasta = filterDocumentoFechaHasta.value;
    const itemFecha = String(item.fecha_vencimiento || "").slice(0, 10);

    if (placa && item.placa !== placa) return false;
    if (tipo && item.tipo !== tipo) return false;
    if (fechaDesde && (!itemFecha || itemFecha < fechaDesde)) return false;
    if (fechaHasta && (!itemFecha || itemFecha > fechaHasta)) return false;

    return true;
}

function updateDocumentosFilterSummary(filteredCount) {
    const total = documentosState.length;
    const hasFilters = Boolean(
        filterDocumentoPlaca.value ||
        filterDocumentoTipo.value ||
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

        const vehiculos = await window.VehiAmb.api.getVehiculosCatalogo();
        fillVehicleSelect(documentoSelect, vehiculos);
        fillVehicleSelect(filterDocumentoPlaca, vehiculos, "Todas las placas", "placa");
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

    try {
        window.VehiAmb.ui.show(loader);
        await window.VehiAmb.api.createDocumento(formData);
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

[filterDocumentoFechaDesde, filterDocumentoFechaHasta].forEach((input) => {
    input.addEventListener("input", applyDocumentosFilters);
});

[filterDocumentoPlaca, filterDocumentoTipo].forEach((select) => {
    select.addEventListener("change", applyDocumentosFilters);
});

clearDocumentosFiltersButton.addEventListener("click", () => {
    documentosFilterForm.reset();
    applyDocumentosFilters();
});

document.addEventListener("DOMContentLoaded", cargarDatos);
