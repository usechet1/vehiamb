const mantenimientoForm = document.getElementById("mantenimientoForm");
const mantenimientosFilterForm = document.getElementById("mantenimientosFilterForm");
const mantenimientoSelect = document.getElementById("vehiculoMantenimiento");
const mantenimientosList = document.getElementById("mantenimientosList");
const filterPlaca = document.getElementById("filterPlaca");
const filterFechaDesde = document.getElementById("filterFechaDesde");
const filterFechaHasta = document.getElementById("filterFechaHasta");
const filterSummary = document.getElementById("filterSummary");
const clearFiltersButton = document.getElementById("clearFiltersButton");
const loader = document.getElementById("loader");
const mensaje = document.getElementById("mensaje");
const repuestosData = document.getElementById("repuestosData");
const repuestoInput = document.getElementById("repuestoInput");
const repuestoValorInput = document.getElementById("repuestoValorInput");
const repuestoNotasInput = document.getElementById("repuestoNotasInput");
const addRepuestoButton = document.getElementById("addRepuestoButton");
const repuestosList = document.getElementById("repuestosList");
const repuestosEmpty = document.getElementById("repuestosEmpty");

let repuestosState = [];
let mantenimientosState = [];

const tiposMantenimiento = {
    revision: "Revision general",
    preventivo: "Preventivo",
    correctivo: "Correctivo",
    cambio_aceite: "Cambio de aceite",
    frenos: "Frenos",
    llantas: "Llantas",
    otro: "Otro"
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
    return new Date(`${value}T00:00:00`).toLocaleDateString("es-CO", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

function fillVehicleSelect(select, vehiculos, placeholder = "Selecciona un vehiculo", valueField = "id") {
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
}

function parseRepuestos(value) {
    if (!value) return [];

    if (Array.isArray(value)) {
        return value
            .filter(Boolean)
            .map((item) => {
                if (typeof item === "string") {
                    return { repuesto: item.trim(), valor: "", notas: "" };
                }

                return {
                    repuesto: String(item.repuesto || item.nombre || "").trim(),
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
            .map((item) => ({ repuesto: item.trim(), valor: "", notas: "" }))
            .filter((item) => item.repuesto);
    }

    return [];
}

function syncRepuestosField() {
    repuestosData.value = JSON.stringify(repuestosState);
}

function renderRepuestosBuilder() {
    repuestosList.innerHTML = repuestosState.map((item, index) => `
        <li class="simple-checklist-item">
            <div class="simple-checklist-content">
                <span class="simple-checklist-label">${item.repuesto}</span>
                <span class="simple-checklist-detail">${item.valor ? formatCurrency(item.valor) : "Sin valor"}</span>
                <span class="simple-checklist-detail">${item.notas || "Sin notas"}</span>
            </div>
            <button type="button" class="simple-checklist-remove" data-index="${index}">Quitar</button>
        </li>
    `).join("");

    repuestosEmpty.classList.toggle("hidden", repuestosState.length > 0);
    syncRepuestosField();

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
    const valor = repuestoValorInput.value.trim();
    const notas = repuestoNotasInput.value.trim();

    if (!repuesto) return;

    repuestosState.push({ repuesto, valor, notas });
    repuestoInput.value = "";
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

function renderMantenimientos(mantenimientos) {
    if (!mantenimientos.length) {
        mantenimientosList.innerHTML = '<p class="dash-empty">No hay mantenimientos para los filtros seleccionados</p>';
        return;
    }

    mantenimientosList.innerHTML = mantenimientos.map((item) => `
        <article class="record-item">
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
                ${renderRepuestosMeta(item.repuestos)}
                <span class="pill">Autorizado por: ${item.autorizado_por || "No registrado"}</span>
                <span class="pill">Hecho por: ${item.hecho_por || "No registrado"}</span>
                ${item.soporte_url ? '<span class="pill">Soporte adjunto</span>' : ""}
            </div>
            ${renderAttachment(item)}
        </article>
    `).join("");
}

function maintenanceMatchesFilters(item) {
    const placa = filterPlaca.value.trim().toLowerCase();
    const fechaDesde = filterFechaDesde.value;
    const fechaHasta = filterFechaHasta.value;
    const itemPlaca = String(item.placa || "").toLowerCase();
    const itemFecha = String(item.fecha || "").slice(0, 10);

    if (placa && itemPlaca !== placa) return false;
    if (fechaDesde && (!itemFecha || itemFecha < fechaDesde)) return false;
    if (fechaHasta && (!itemFecha || itemFecha > fechaHasta)) return false;

    return true;
}

function updateFilterSummary(filteredCount) {
    const total = mantenimientosState.length;
    const hasFilters = Boolean(
        filterPlaca.value.trim() ||
        filterFechaDesde.value ||
        filterFechaHasta.value
    );

    if (!total) {
        filterSummary.textContent = "Aun no hay mantenimientos registrados.";
        return;
    }

    filterSummary.textContent = hasFilters
        ? `Mostrando ${filteredCount} de ${total} mantenimientos.`
        : `Mostrando todos los mantenimientos (${total}).`;
}

function applyMaintenanceFilters() {
    const filtered = mantenimientosState.filter(maintenanceMatchesFilters);
    renderMantenimientos(filtered);
    updateFilterSummary(filtered.length);
}

async function cargarDatos() {
    try {
        window.VehiAmb.ui.show(loader);

        const vehiculos = await window.VehiAmb.api.getVehiculos();
        fillVehicleSelect(mantenimientoSelect, vehiculos);
        fillVehicleSelect(filterPlaca, vehiculos, "Todas las placas", "placa");
    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(mensaje, "No fue posible cargar los vehiculos", "error");
        window.VehiAmb.ui.hide(loader);
        return;
    }

    try {
        const mantenimientos = await window.VehiAmb.api.getMantenimientos();
        mantenimientosState = mantenimientos;
        applyMaintenanceFilters();
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

    const formData = new FormData(mantenimientoForm);

    try {
        window.VehiAmb.ui.show(loader);
        await window.VehiAmb.api.createMantenimiento(formData);
        window.VehiAmb.ui.showMessage(mensaje, "Mantenimiento guardado correctamente");
        mantenimientoForm.reset();
        repuestosState = [];
        renderRepuestosBuilder();
        await cargarDatos();
    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(mensaje, "Error al guardar el mantenimiento", "error");
    } finally {
        window.VehiAmb.ui.hide(loader);
    }
});

mantenimientosFilterForm.addEventListener("submit", (event) => {
    event.preventDefault();
});

[filterPlaca, filterFechaDesde, filterFechaHasta].forEach((input) => {
    input.addEventListener("input", applyMaintenanceFilters);
    input.addEventListener("change", applyMaintenanceFilters);
});

clearFiltersButton.addEventListener("click", () => {
    mantenimientosFilterForm.reset();
    applyMaintenanceFilters();
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
    cargarDatos();
});
