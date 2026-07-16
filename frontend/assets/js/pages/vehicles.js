const container = document.getElementById("vehiculosContainer");
const loader = document.getElementById("loader");
const emptyState = document.getElementById("vehiculosEmptyState");
const paginationBar = document.getElementById("paginationBar");
const paginationSummary = document.getElementById("paginationSummary");
const filterSummary = document.getElementById("filterSummary");

const vehiculosFilterForm = document.getElementById("vehiculosFilterForm");
vehiculosFilterForm?.addEventListener("submit", (event) => event.preventDefault());

const searchInput = document.getElementById("searchInput");
const filterEstado = document.getElementById("filterEstado");
const filterTipoVehiculo = document.getElementById("filterTipoVehiculo");
const filterMarca = document.getElementById("filterMarca");
const sortSelect = document.getElementById("sortSelect");
const pageSizeSelect = document.getElementById("pageSizeSelect");
const clearFiltersButton = document.getElementById("clearFiltersButton");
const emptyStateClearButton = document.getElementById("emptyStateClearButton");

const paginationFirst = document.getElementById("paginationFirst");
const paginationPrev = document.getElementById("paginationPrev");
const paginationNext = document.getElementById("paginationNext");
const paginationLast = document.getElementById("paginationLast");

const STORAGE_KEY = "vehiamb.vehiculos.filtros";

const DEFAULT_FILTERS = {
    search: "",
    estado: "",
    tipo: "",
    marca: "",
    sort: "recientes",
    page: 1,
    limit: 20
};

const ESTADOS = {
    activo: { label: "Activo", badge: "badge-verde" },
    reparacion: { label: "En reparación", badge: "badge-amarillo" },
    fuera_servicio: { label: "Fuera de servicio", badge: "badge-rojo" }
};

let filters = loadFilters();
let lastMeta = { page: 1, totalPages: 1, total: 0 };

function loadFilters() {
    try {
        const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
        if (!stored || typeof stored !== "object") return { ...DEFAULT_FILTERS };
        return { ...DEFAULT_FILTERS, ...stored };
    } catch (error) {
        return { ...DEFAULT_FILTERS };
    }
}

function saveFilters() {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
}

function debounce(fn, delay) {
    let timeoutId;
    return (...args) => {
        window.clearTimeout(timeoutId);
        timeoutId = window.setTimeout(() => fn(...args), delay);
    };
}

function formatKm(value) {
    return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 }).format(Number(value || 0));
}

function applyFiltersToForm() {
    searchInput.value = filters.search;
    filterEstado.value = filters.estado;
    filterTipoVehiculo.value = filters.tipo;
    filterMarca.value = filters.marca;
    sortSelect.value = filters.sort;
    pageSizeSelect.value = String(filters.limit);
}

async function loadMarcas() {
    try {
        const marcas = await window.VehiAmb.api.getMarcasVehiculos();
        const previousValue = filters.marca;

        filterMarca.innerHTML = '<option value="">Marca: todas</option>' + marcas
            .map((marca) => `<option value="${escapeHtml(marca)}">${escapeHtml(marca)}</option>`)
            .join("");

        if (previousValue && marcas.includes(previousValue)) {
            filterMarca.value = previousValue;
        }
    } catch (error) {
        console.error("No fue posible cargar las marcas:", error);
    }
}

function renderCard(vehiculo) {
    const estadoInfo = ESTADOS[vehiculo.estado] || ESTADOS.activo;
    const fotoPlaceholder = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 13l1.5-4.5A2 2 0 0 1 6.4 7h11.2a2 2 0 0 1 1.9 1.5L21 13"/>
            <path d="M3 13h18v5a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1H6v1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/>
            <circle cx="7.5" cy="16" r="1.2"/>
            <circle cx="16.5" cy="16" r="1.2"/>
        </svg>
    `;
    const foto = vehiculo.imagen_url
        ? `<img src="${escapeHtml(window.VehiAmb.api.getAssetUrl(vehiculo.imagen_url))}" alt="Imagen de ${escapeHtml(vehiculo.placa) || "vehículo"}">`
        : fotoPlaceholder;

    const puedeEditar = window.VehiAmb.auth.hasPermission("vehicles.edit");
    const puedeRegistrarMantenimiento = window.VehiAmb.auth.hasPermission("maintenance.create");

    return `
        <article class="vehicle-card" data-id="${vehiculo.id}">
            <div class="vehicle-card-photo">
                ${foto}
            </div>

            <div class="vehicle-card-top">
                <span class="plate">${escapeHtml(vehiculo.placa) || "SIN PLACA"}</span>
                <select class="vehicle-status-select badge ${estadoInfo.badge}" data-id="${vehiculo.id}">
                    ${Object.entries(ESTADOS).map(([value, info]) => `
                        <option value="${value}" ${vehiculo.estado === value ? "selected" : ""}>${info.label}</option>
                    `).join("")}
                </select>
            </div>

            <h3>${escapeHtml(vehiculo.marca) || "Marca"} ${escapeHtml(vehiculo.modelo) || "Modelo"}</h3>

            <dl class="vehicle-meta">
                <div>
                    <dt>Código</dt>
                    <dd>${escapeHtml(vehiculo.codigo_interno) || "--"}</dd>
                </div>
                <div>
                    <dt>Modelo</dt>
                    <dd>${vehiculo.anio || "--"}</dd>
                </div>
                <div>
                    <dt>Kilometraje</dt>
                    <dd>${formatKm(vehiculo.kilometraje_actual)} km</dd>
                </div>
            </dl>

            <div class="vehicle-card-actions">
                <a class="vehicle-card-icon-btn" href="vehiculo.html?id=${vehiculo.id}" title="Ver detalle" aria-label="Ver detalle">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"/>
                        <circle cx="12" cy="12" r="3"/>
                    </svg>
                </a>
                ${puedeEditar ? `
                <a class="vehicle-card-icon-btn" href="add.html?id=${vehiculo.id}" title="Editar" aria-label="Editar">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="3"/>
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/>
                    </svg>
                </a>` : ""}
                ${puedeRegistrarMantenimiento ? `
                <a class="vehicle-card-icon-btn" href="mantenimientos.html?vehiculo=${vehiculo.id}" title="Registrar mantenimiento" aria-label="Registrar mantenimiento">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-9"/>
                        <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L13 14l-4 1 1-4Z"/>
                    </svg>
                </a>` : ""}
            </div>
        </article>
    `;
}

function renderPagination(meta) {
    lastMeta = meta;

    if (!meta.total) {
        window.VehiAmb.ui.hide(paginationBar);
        return;
    }

    window.VehiAmb.ui.show(paginationBar);
    paginationSummary.textContent = `Página ${meta.page} de ${meta.totalPages} · ${meta.total} vehículos encontrados`;

    paginationFirst.disabled = meta.page <= 1;
    paginationPrev.disabled = meta.page <= 1;
    paginationNext.disabled = meta.page >= meta.totalPages;
    paginationLast.disabled = meta.page >= meta.totalPages;
}

async function cargarVehiculos() {
    try {
        window.VehiAmb.ui.show(loader);
        filterSummary.textContent = "Cargando vehículos...";

        const resultado = await window.VehiAmb.api.getVehiculos(filters);

        if (filters.page > resultado.totalPages) {
            filters.page = resultado.totalPages;
            saveFilters();
        }

        if (!resultado.items.length) {
            container.innerHTML = "";
            window.VehiAmb.ui.show(emptyState);
            window.VehiAmb.ui.hide(paginationBar);
            filterSummary.textContent = "0 vehículos encontrados.";
            return;
        }

        window.VehiAmb.ui.hide(emptyState);
        container.innerHTML = resultado.items.map(renderCard).join("");
        renderPagination(resultado);
        filterSummary.textContent = `${resultado.total} vehículos encontrados.`;
    } catch (error) {
        console.error("Error cargando vehiculos:", error);
        container.innerHTML = '<p class="dash-empty">No fue posible cargar los vehículos</p>';
        window.VehiAmb.ui.hide(emptyState);
        window.VehiAmb.ui.hide(paginationBar);
        filterSummary.textContent = "No fue posible cargar los vehículos.";
    } finally {
        window.VehiAmb.ui.hide(loader);
    }
}

function goToPage(page) {
    filters.page = Math.max(1, page);
    saveFilters();
    cargarVehiculos();
}

function resetFilters() {
    filters = { ...DEFAULT_FILTERS };
    saveFilters();
    applyFiltersToForm();
    cargarVehiculos();
}

const debouncedSearch = debounce(() => {
    filters.search = searchInput.value;
    filters.page = 1;
    saveFilters();
    cargarVehiculos();
}, 300);

searchInput.addEventListener("input", debouncedSearch);

filterEstado.addEventListener("change", () => {
    filters.estado = filterEstado.value;
    filters.page = 1;
    saveFilters();
    cargarVehiculos();
});

filterTipoVehiculo.addEventListener("change", () => {
    filters.tipo = filterTipoVehiculo.value;
    filters.page = 1;
    saveFilters();
    cargarVehiculos();
});

filterMarca.addEventListener("change", () => {
    filters.marca = filterMarca.value;
    filters.page = 1;
    saveFilters();
    cargarVehiculos();
});

sortSelect.addEventListener("change", () => {
    filters.sort = sortSelect.value;
    filters.page = 1;
    saveFilters();
    cargarVehiculos();
});

pageSizeSelect.addEventListener("change", () => {
    filters.limit = Number(pageSizeSelect.value);
    filters.page = 1;
    saveFilters();
    cargarVehiculos();
});

clearFiltersButton.addEventListener("click", resetFilters);
emptyStateClearButton.addEventListener("click", resetFilters);

paginationFirst.addEventListener("click", () => goToPage(1));
paginationPrev.addEventListener("click", () => goToPage(lastMeta.page - 1));
paginationNext.addEventListener("click", () => goToPage(lastMeta.page + 1));
paginationLast.addEventListener("click", () => goToPage(lastMeta.totalPages));

container.addEventListener("change", async (event) => {
    const select = event.target.closest(".vehicle-status-select");
    if (!select) return;

    const { id } = select.dataset;
    const nuevoEstado = select.value;
    const estadoInfo = ESTADOS[nuevoEstado];

    select.className = `vehicle-status-select badge ${estadoInfo.badge}`;
    select.disabled = true;

    try {
        await window.VehiAmb.api.updateEstadoVehiculo(id, nuevoEstado);
    } catch (error) {
        console.error("No fue posible actualizar el estado:", error);
        cargarVehiculos();
    } finally {
        select.disabled = false;
    }
});

document.addEventListener("DOMContentLoaded", async () => {
    await window.VehiAmb.auth.fetchCurrentUser();
    applyFiltersToForm();
    loadMarcas();
    cargarVehiculos();
});
