const notifPageTitle = document.getElementById("notifPageTitle");
const notifTabs = document.getElementById("notifTabs");
const notifTabCountNoLeidas = document.getElementById("notifTabCountNoLeidas");
const notifCategoryChips = document.getElementById("notifCategoryChips");

const notifSearch = document.getElementById("notifSearch");
const notifFiltrosTrigger = document.getElementById("notifFiltrosTrigger");
const notifFiltrosPopover = document.getElementById("notifFiltrosPopover");
const notifFiltroPrioridad = document.getElementById("notifFiltroPrioridad");
const notifFiltroEstadoExtra = document.getElementById("notifFiltroEstadoExtra");
const notifFiltroVehiculo = document.getElementById("notifFiltroVehiculo");
const notifFechaDesde = document.getElementById("notifFechaDesde");
const notifFechaHasta = document.getElementById("notifFechaHasta");
const notifFiltersChips = document.getElementById("notifFiltersChips");

const notifMenuTrigger = document.getElementById("notifMenuTrigger");
const notifMenuPopover = document.getElementById("notifMenuPopover");
const notifMarkAllReadButton = document.getElementById("notifMarkAllReadButton");
const notifDeleteReadButton = document.getElementById("notifDeleteReadButton");
const notifDeleteAllButton = document.getElementById("notifDeleteAllButton");

const notifCenterList = document.getElementById("notifCenterList");
const loader = document.getElementById("loader");
const mensaje = document.getElementById("mensaje");

let notifTabActivo = "no_leida";
let notifCategoriaActiva = "";

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function currentFilters() {
    return {
        estado: notifFiltroEstadoExtra.value || notifTabActivo || undefined,
        prioridad: notifFiltroPrioridad.value || undefined,
        categoria: notifCategoriaActiva || undefined,
        vehiculo_id: notifFiltroVehiculo.value || undefined,
        fecha_desde: notifFechaDesde.value || undefined,
        fecha_hasta: notifFechaHasta.value || undefined,
        search: notifSearch.value.trim() || undefined
    };
}

// "Filtros" (prioridad/estado extra/vehiculo/fechas) son distintos de la
// pestana activa y la categoria -- esos dos ya se ven marcados en su propio
// control (tab activa / chip activa), no hace falta duplicarlos como chip
// removible aparte.
function hayFiltrosPopoverActivos() {
    return Boolean(
        notifFiltroPrioridad.value ||
        notifFiltroEstadoExtra.value ||
        notifFiltroVehiculo.value ||
        notifFechaDesde.value ||
        notifFechaHasta.value
    );
}

function hayFiltrosOBusquedaActivos() {
    return Boolean(notifSearch.value.trim() || notifCategoriaActiva) || hayFiltrosPopoverActivos();
}

async function fillVehiculoFiltro() {
    try {
        const vehiculos = await window.VehiAmb.api.getVehiculosCatalogo();
        vehiculos.forEach((vehiculo) => {
            const option = document.createElement("option");
            option.value = vehiculo.id;
            option.textContent = `${vehiculo.placa} - ${vehiculo.marca} ${vehiculo.modelo}`;
            notifFiltroVehiculo.appendChild(option);
        });
    } catch (error) {
        console.error("No fue posible cargar los vehículos para el filtro:", error);
    }
}

function renderNotifRow(notificacion, { dentroDeGrupo = false } = {}) {
    const cfg = window.VehiAmb.notifConfig;
    const prioridad = cfg.prioridadConfig(notificacion.prioridad);
    const categoria = cfg.categoriaConfig(notificacion.categoria);
    const accion = cfg.accionConfig(notificacion.accion);
    const noLeida = notificacion.estado === "no_leida";
    const archivada = notificacion.estado === "archivada";
    const esAprobacionPendiente = notificacion.tipo === "aprobacion_requerida" && noLeida;
    const placa = notificacion.vehiculo?.placa || "";

    // La accion primaria es la que resuelve la notificacion de verdad (ir al
    // documento, aprobar el mantenimiento) -- "marcar leida" queda como
    // accion secundaria de mantenimiento, no compite por atencion.
    let accionPrimaria = "";
    if (esAprobacionPendiente) {
        accionPrimaria = `
            <button type="button" class="btn-primary notif-row-primary-btn" data-notif-action="aprobar" data-notif-id="${notificacion.id}">Aprobar</button>
            <button type="button" class="btn-secondary notif-row-primary-btn" data-notif-action="rechazar" data-notif-id="${notificacion.id}">Rechazar</button>
        `;
    } else if (accion) {
        accionPrimaria = `<a class="btn-secondary notif-row-primary-btn" href="${accion.url}" data-notif-nav="${notificacion.id}">${escapeHtml(accion.label)}</a>`;
    }

    const secundarias = [];
    if (noLeida) secundarias.push(`<button type="button" class="notif-row-icon-btn" data-notif-action="leido" data-notif-id="${notificacion.id}" title="Marcar leída">✓</button>`);
    if (!archivada) secundarias.push(`<button type="button" class="notif-row-icon-btn" data-notif-action="archivar" data-notif-id="${notificacion.id}" title="Posponer / archivar">🗄</button>`);
    secundarias.push(`<button type="button" class="notif-row-icon-btn" data-notif-action="reenviar_whatsapp" data-notif-id="${notificacion.id}" title="Reenviar por WhatsApp">↗</button>`);
    secundarias.push(`<button type="button" class="notif-row-icon-btn" data-notif-action="eliminar" data-notif-id="${notificacion.id}" title="Eliminar">✕</button>`);

    return `
        <article class="notif-row ${prioridad.className}${noLeida ? "" : " notif-row--leida"}"${dentroDeGrupo ? ' data-notif-child="true"' : ""}>
            <span class="notif-row-icon" title="${escapeHtml(categoria.label)}">${categoria.icono}</span>
            <div class="notif-row-main">
                <div class="notif-row-title-line">
                    ${noLeida ? '<span class="notif-dot" title="No leída"></span>' : ""}
                    <span class="notif-row-title">${escapeHtml(notificacion.titulo)}</span>
                    ${placa ? `<span class="notif-row-placa">${escapeHtml(placa)}</span>` : ""}
                </div>
                <p class="notif-row-message">${escapeHtml(notificacion.mensaje)}</p>
            </div>
            <div class="notif-row-end">
                <span class="notif-row-time">${cfg.tiempoTranscurrido(notificacion.fecha_creacion)}</span>
                <div class="notif-row-actions">${accionPrimaria}</div>
                <div class="notif-row-secondary">${secundarias.join("")}</div>
            </div>
        </article>
    `;
}

function renderNotifEntry(notificacion) {
    if (!notificacion.agrupado) return renderNotifRow(notificacion);

    const cfg = window.VehiAmb.notifConfig;
    const prioridad = cfg.prioridadConfig(notificacion.prioridad);
    const categoria = cfg.categoriaConfig(notificacion.categoria);

    return `
        <details class="notif-row notif-row--grupo ${prioridad.className}">
            <summary>
                <span class="notif-row-icon" title="${escapeHtml(categoria.label)}">${categoria.icono}</span>
                <div class="notif-row-main">
                    <div class="notif-row-title-line">
                        <span class="notif-row-title">${escapeHtml(notificacion.titulo)}</span>
                    </div>
                    <p class="notif-row-message">${escapeHtml(notificacion.mensaje)}</p>
                </div>
                <div class="notif-row-end">
                    <span class="pill">${notificacion.items.length} notificaciones</span>
                </div>
            </summary>
            <div class="notif-grupo-items">
                ${notificacion.items.map((item) => renderNotifRow(item, { dentroDeGrupo: true })).join("")}
            </div>
        </details>
    `;
}

function contarNotificaciones(notificaciones) {
    return notificaciones.reduce((total, item) => total + (item.agrupado ? item.items.length : 1), 0);
}

// Dos vacios muy distintos: "no hay nada que coincida con lo que filtraste"
// (hay un filtro/busqueda de por medio, se ofrece limpiarlo) vs "no tienes
// nada" (pestana por defecto, sin filtros -- un buen estado, no una
// disculpa). Mostrar el mensaje de filtro cuando en realidad no hay ningun
// filtro aplicado es el peor cruce posible: parece que el usuario hizo algo
// mal cuando no hizo nada.
function renderEmptyState() {
    if (hayFiltrosOBusquedaActivos()) {
        return `
            <div class="dash-empty notif-empty">
                <p>No hay notificaciones que coincidan con estos filtros.</p>
                <button type="button" class="record-link" id="notifEmptyClearButton">Limpiar filtros</button>
            </div>
        `;
    }
    if (notifTabActivo === "no_leida") {
        return '<p class="dash-empty">Estás al día. No tienes notificaciones sin leer.</p>';
    }
    return '<p class="dash-empty">No tienes notificaciones. Te avisaremos aquí cuando haya algo nuevo.</p>';
}

function actualizarBotonesMasivos(vacio) {
    notifMarkAllReadButton.disabled = vacio;
    notifDeleteReadButton.disabled = vacio;
    notifDeleteAllButton.disabled = vacio;
}

async function cargarNotificaciones() {
    try {
        window.VehiAmb.ui.show(loader);
        const filtros = currentFilters();
        const notificaciones = await window.VehiAmb.api.getNotificaciones(filtros);

        actualizarBotonesMasivos(!notificaciones.length);

        notifCenterList.innerHTML = notificaciones.length
            ? notificaciones.map(renderNotifEntry).join("")
            : renderEmptyState();
    } catch (error) {
        console.error(error);
        notifCenterList.innerHTML = '<p class="dash-empty">No fue posible cargar las notificaciones</p>';
        actualizarBotonesMasivos(true);
        window.VehiAmb.ui.showMessage(mensaje, error.message || "Error al cargar las notificaciones", "error");
    } finally {
        window.VehiAmb.ui.hide(loader);
    }
}

// El contador del titulo/pestana y los chips de categoria se calculan aparte
// de la lista visible: siempre reflejan el total real de no leidas, sin
// importar que filtro este activo en ese momento (igual que la campanita del
// sidebar).
async function cargarResumen() {
    try {
        const contador = await window.VehiAmb.api.getContadorNotificaciones();
        const pendientes = contador.pendientes || 0;

        notifPageTitle.textContent = pendientes > 0
            ? `Centro de notificaciones · ${pendientes} sin leer`
            : "Centro de notificaciones";

        notifTabCountNoLeidas.textContent = pendientes > 0 ? String(pendientes) : "";
        notifTabCountNoLeidas.classList.toggle("hidden", pendientes === 0);
    } catch (error) {
        console.error("No fue posible cargar el contador de notificaciones:", error);
    }

    try {
        const noLeidas = await window.VehiAmb.api.getNotificaciones({ estado: "no_leida", agrupar: false });
        renderCategoryChips(noLeidas);
    } catch (error) {
        console.error("No fue posible cargar el resumen por categoria:", error);
    }
}

function renderCategoryChips(noLeidas) {
    const cfg = window.VehiAmb.notifConfig;
    const counts = {};
    noLeidas.forEach((item) => {
        counts[item.categoria] = (counts[item.categoria] || 0) + 1;
    });

    const categorias = Object.keys(counts);
    if (!categorias.length) {
        notifCategoryChips.innerHTML = "";
        notifCategoryChips.classList.add("hidden");
        return;
    }

    notifCategoryChips.classList.remove("hidden");
    notifCategoryChips.innerHTML = categorias
        .sort((a, b) => counts[b] - counts[a])
        .map((categoria) => {
            const info = cfg.categoriaConfig(categoria);
            const activa = notifCategoriaActiva === categoria;
            return `<button type="button" class="notif-filtro-chip${activa ? " active" : ""}" data-notif-categoria="${categoria}">${info.icono} ${escapeHtml(info.label)} (${counts[categoria]})</button>`;
        })
        .join("");
}

function renderFiltersChips() {
    const chips = [];

    if (notifFiltroPrioridad.value) {
        chips.push({ id: "prioridad", label: window.VehiAmb.notifConfig.prioridadConfig(notifFiltroPrioridad.value).label });
    }
    if (notifFiltroEstadoExtra.value) {
        chips.push({ id: "estadoExtra", label: notifFiltroEstadoExtra.options[notifFiltroEstadoExtra.selectedIndex].textContent });
    }
    if (notifFiltroVehiculo.value) {
        chips.push({ id: "vehiculo", label: notifFiltroVehiculo.options[notifFiltroVehiculo.selectedIndex].textContent });
    }
    if (notifFechaDesde.value || notifFechaHasta.value) {
        chips.push({ id: "fechas", label: `${notifFechaDesde.value || "…"} → ${notifFechaHasta.value || "…"}` });
    }

    notifFiltersChips.classList.toggle("hidden", chips.length === 0);
    notifFiltersChips.innerHTML = chips.map((chip) => `
        <span class="pill">${escapeHtml(chip.label)} <button type="button" class="pill-remove" data-remove-notif-chip="${chip.id}" aria-label="Quitar filtro">×</button></span>
    `).join("");
}

function cerrarPopoversNotif() {
    notifFiltrosPopover.classList.add("hidden");
    notifMenuPopover.classList.add("hidden");
}

notifTabs.addEventListener("click", (event) => {
    const boton = event.target.closest("[data-notif-tab]");
    if (!boton) return;

    notifTabActivo = boton.dataset.notifTab;
    notifTabs.querySelectorAll(".notif-tab").forEach((tab) => tab.classList.toggle("is-active", tab === boton));
    notifFiltroEstadoExtra.value = "";
    renderFiltersChips();
    cargarNotificaciones();
});

notifCategoryChips.addEventListener("click", (event) => {
    const chip = event.target.closest("[data-notif-categoria]");
    if (!chip) return;

    notifCategoriaActiva = notifCategoriaActiva === chip.dataset.notifCategoria ? "" : chip.dataset.notifCategoria;
    chip.parentElement.querySelectorAll(".notif-filtro-chip").forEach((c) => {
        c.classList.toggle("active", c.dataset.notifCategoria === notifCategoriaActiva);
    });
    cargarNotificaciones();
});

notifFiltrosTrigger.addEventListener("click", (event) => {
    event.stopPropagation();
    const estabaAbierto = !notifFiltrosPopover.classList.contains("hidden");
    cerrarPopoversNotif();
    notifFiltrosPopover.classList.toggle("hidden", estabaAbierto);
});

notifMenuTrigger.addEventListener("click", (event) => {
    event.stopPropagation();
    const estabaAbierto = !notifMenuPopover.classList.contains("hidden");
    cerrarPopoversNotif();
    notifMenuPopover.classList.toggle("hidden", estabaAbierto);
});

document.addEventListener("click", (event) => {
    if (!event.target.closest(".doc-filter-popover-wrap")) cerrarPopoversNotif();
});

[notifFiltroPrioridad, notifFiltroEstadoExtra, notifFiltroVehiculo, notifFechaDesde, notifFechaHasta].forEach((input) => {
    input.addEventListener("change", () => {
        renderFiltersChips();
        cargarNotificaciones();
    });
});

let searchDebounce;
notifSearch.addEventListener("input", () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(cargarNotificaciones, 300);
});

notifFiltersChips.addEventListener("click", (event) => {
    const boton = event.target.closest("[data-remove-notif-chip]");
    if (!boton) return;

    const mapa = {
        prioridad: notifFiltroPrioridad,
        estadoExtra: notifFiltroEstadoExtra,
        vehiculo: notifFiltroVehiculo,
        fechas: null
    };

    if (boton.dataset.removeNotifChip === "fechas") {
        notifFechaDesde.value = "";
        notifFechaHasta.value = "";
    } else {
        const campo = mapa[boton.dataset.removeNotifChip];
        if (campo) campo.value = "";
    }

    renderFiltersChips();
    cargarNotificaciones();
});

notifCenterList.addEventListener("click", (event) => {
    const limpiarButton = event.target.closest("#notifEmptyClearButton");
    if (!limpiarButton) return;

    notifSearch.value = "";
    notifCategoriaActiva = "";
    notifFiltroPrioridad.value = "";
    notifFiltroEstadoExtra.value = "";
    notifFiltroVehiculo.value = "";
    notifFechaDesde.value = "";
    notifFechaHasta.value = "";
    renderFiltersChips();
    cargarResumen();
    cargarNotificaciones();
});

notifMarkAllReadButton.addEventListener("click", async () => {
    cerrarPopoversNotif();
    try {
        await window.VehiAmb.api.marcarTodasNotificacionesLeidas();
        await Promise.all([cargarResumen(), cargarNotificaciones()]);
    } catch (error) {
        window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudieron marcar las notificaciones", "error");
    }
});

notifDeleteReadButton.addEventListener("click", async () => {
    cerrarPopoversNotif();
    try {
        await window.VehiAmb.api.eliminarNotificacionesLeidas();
        await Promise.all([cargarResumen(), cargarNotificaciones()]);
    } catch (error) {
        window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudieron eliminar las notificaciones", "error");
    }
});

notifDeleteAllButton.addEventListener("click", async () => {
    cerrarPopoversNotif();
    const confirmado = await window.VehiAmb.ui.confirm({
        title: "Eliminar todas las notificaciones",
        message: "¿Eliminar todas tus notificaciones, leídas y no leídas? Esta acción no se puede deshacer.",
        confirmText: "Eliminar todas"
    });
    if (!confirmado) return;

    try {
        await window.VehiAmb.api.eliminarTodasNotificaciones();
        await Promise.all([cargarResumen(), cargarNotificaciones()]);
    } catch (error) {
        window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudieron eliminar las notificaciones", "error");
    }
});

notifCenterList.addEventListener("click", async (event) => {
    const actionButton = event.target.closest("[data-notif-action]");
    if (!actionButton) return;

    event.preventDefault();
    const { notifAction, notifId } = actionButton.dataset;
    actionButton.disabled = true;

    try {
        if (notifAction === "leido") {
            await window.VehiAmb.api.marcarNotificacionLeida(notifId);
        } else if (notifAction === "archivar") {
            await window.VehiAmb.api.archivarNotificacion(notifId);
        } else if (notifAction === "eliminar") {
            await window.VehiAmb.api.eliminarNotificacion(notifId);
        } else if (notifAction === "reenviar_whatsapp") {
            await window.VehiAmb.api.reenviarNotificacionWhatsapp(notifId);
            window.VehiAmb.ui.showMessage(mensaje, "Notificación reenviada por WhatsApp");
        } else if (notifAction === "aprobar") {
            await window.VehiAmb.api.aprobarNotificacion(notifId);
        } else if (notifAction === "rechazar") {
            await window.VehiAmb.api.rechazarNotificacion(notifId);
        }
        await Promise.all([cargarResumen(), cargarNotificaciones()]);
    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudo completar la accion", "error");
        actionButton.disabled = false;
    }
});

document.addEventListener("DOMContentLoaded", async () => {
    await fillVehiculoFiltro();
    await Promise.all([cargarResumen(), cargarNotificaciones()]);
});
