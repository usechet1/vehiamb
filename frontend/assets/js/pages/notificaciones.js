const notifFilterForm = document.getElementById("notifFilterForm");
const notifSearch = document.getElementById("notifSearch");
const notifFiltroEstado = document.getElementById("notifFiltroEstado");
const notifFiltroPrioridad = document.getElementById("notifFiltroPrioridad");
const notifFiltroCategoria = document.getElementById("notifFiltroCategoria");
const notifFiltroVehiculo = document.getElementById("notifFiltroVehiculo");
const notifFechaDesde = document.getElementById("notifFechaDesde");
const notifFechaHasta = document.getElementById("notifFechaHasta");
const notifFilterSummary = document.getElementById("notifFilterSummary");
const notifClearFiltersButton = document.getElementById("notifClearFiltersButton");
const notifCenterList = document.getElementById("notifCenterList");
const notifMarkAllReadButton = document.getElementById("notifMarkAllReadButton");
const notifDeleteReadButton = document.getElementById("notifDeleteReadButton");
const loader = document.getElementById("loader");
const mensaje = document.getElementById("mensaje");

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
        estado: notifFiltroEstado.value || undefined,
        prioridad: notifFiltroPrioridad.value || undefined,
        categoria: notifFiltroCategoria.value || undefined,
        vehiculo_id: notifFiltroVehiculo.value || undefined,
        fecha_desde: notifFechaDesde.value || undefined,
        fecha_hasta: notifFechaHasta.value || undefined,
        search: notifSearch.value.trim() || undefined
    };
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

function renderNotifCard(notificacion, { dentroDeGrupo = false } = {}) {
    const cfg = window.VehiAmb.notifConfig;
    const prioridad = cfg.prioridadConfig(notificacion.prioridad);
    const categoria = cfg.categoriaConfig(notificacion.categoria);
    const accion = cfg.accionConfig(notificacion.accion);
    const noLeida = notificacion.estado === "no_leida";
    const archivada = notificacion.estado === "archivada";

    const esAprobacionPendiente = notificacion.tipo === "aprobacion_requerida" && noLeida;

    const botones = [];
    if (esAprobacionPendiente) {
        botones.push(`<button type="button" class="btn-primary" data-notif-action="aprobar" data-notif-id="${notificacion.id}">Aprobar</button>`);
        botones.push(`<button type="button" class="btn-secondary" data-notif-action="rechazar" data-notif-id="${notificacion.id}">Rechazar</button>`);
    } else if (accion) {
        botones.push(`<a class="btn-secondary" href="${accion.url}">${escapeHtml(accion.label)}</a>`);
    }

    if (noLeida) {
        botones.push(`<button type="button" class="btn-secondary" data-notif-action="leido" data-notif-id="${notificacion.id}">Marcar leída</button>`);
    }
    if (!archivada) {
        botones.push(`<button type="button" class="btn-secondary" data-notif-action="archivar" data-notif-id="${notificacion.id}">Posponer / Archivar</button>`);
    }
    botones.push(`<button type="button" class="btn-secondary" data-notif-action="eliminar" data-notif-id="${notificacion.id}">Eliminar</button>`);

    const vehiculoLabel = notificacion.vehiculo
        ? `${notificacion.vehiculo.placa || ""} ${notificacion.vehiculo.marca || ""} ${notificacion.vehiculo.modelo || ""}`.trim()
        : "";

    const fecha = notificacion.fecha_creacion
        ? new Date(notificacion.fecha_creacion).toLocaleString("es-CO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
        : "";

    return `
        <article class="record-item notif-center-item ${prioridad.className}${noLeida ? "" : " notif-item--leido"}"${dentroDeGrupo ? ' data-notif-child="true"' : ""}>
            <div class="record-top">
                <div>
                    <span class="record-title">${prioridad.icono} ${escapeHtml(notificacion.titulo)}</span>
                    <span class="record-sub">${categoria.icono} ${escapeHtml(categoria.label)} - ${escapeHtml(prioridad.label)}</span>
                </div>
                <span class="pill">${fecha}</span>
            </div>
            <p>${escapeHtml(notificacion.mensaje)}</p>
            <div class="record-meta">
                ${vehiculoLabel ? `<span class="pill">${escapeHtml(vehiculoLabel)}</span>` : ""}
                <span class="pill">${cfg.tiempoTranscurrido(notificacion.fecha_creacion)}</span>
                <span class="pill">${notificacion.estado === "no_leida" ? "No leída" : notificacion.estado === "leida" ? "Leída" : "Archivada"}</span>
            </div>
            ${botones.length ? `<div class="notif-item-actions">${botones.join("")}</div>` : ""}
        </article>
    `;
}

function renderNotifEntry(notificacion) {
    if (!notificacion.agrupado) return renderNotifCard(notificacion);

    const cfg = window.VehiAmb.notifConfig;
    const prioridad = cfg.prioridadConfig(notificacion.prioridad);
    const categoria = cfg.categoriaConfig(notificacion.categoria);

    return `
        <details class="record-item notif-center-item notif-item--grupo ${prioridad.className}">
            <summary>
                <div class="record-top">
                    <div>
                        <span class="record-title">${prioridad.icono} ${escapeHtml(notificacion.titulo)}</span>
                        <span class="record-sub">${categoria.icono} ${escapeHtml(categoria.label)}</span>
                    </div>
                    <span class="pill">${notificacion.items.length} notificaciones</span>
                </div>
                <p>${escapeHtml(notificacion.mensaje)}</p>
            </summary>
            <div class="notif-grupo-items">
                ${notificacion.items.map((item) => renderNotifCard(item, { dentroDeGrupo: true })).join("")}
            </div>
        </details>
    `;
}

function contarNotificaciones(notificaciones) {
    return notificaciones.reduce((total, item) => total + (item.agrupado ? item.items.length : 1), 0);
}

async function cargarNotificaciones() {
    try {
        window.VehiAmb.ui.show(loader);
        const filtros = currentFilters();
        const notificaciones = await window.VehiAmb.api.getNotificaciones(filtros);

        if (!notificaciones.length) {
            notifCenterList.innerHTML = '<p class="dash-empty">No hay notificaciones para los filtros seleccionados</p>';
            notifFilterSummary.textContent = "No hay notificaciones para los filtros seleccionados.";
            return;
        }

        notifCenterList.innerHTML = notificaciones.map(renderNotifEntry).join("");
        notifFilterSummary.textContent = `Mostrando ${contarNotificaciones(notificaciones)} notificaciones.`;
    } catch (error) {
        console.error(error);
        notifCenterList.innerHTML = '<p class="dash-empty">No fue posible cargar las notificaciones</p>';
        window.VehiAmb.ui.showMessage(mensaje, error.message || "Error al cargar las notificaciones", "error");
    } finally {
        window.VehiAmb.ui.hide(loader);
    }
}

notifFilterForm.addEventListener("submit", (event) => event.preventDefault());

[notifFiltroEstado, notifFiltroPrioridad, notifFiltroCategoria, notifFiltroVehiculo, notifFechaDesde, notifFechaHasta].forEach((input) => {
    input.addEventListener("change", cargarNotificaciones);
});

let searchDebounce;
notifSearch.addEventListener("input", () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(cargarNotificaciones, 300);
});

notifClearFiltersButton.addEventListener("click", () => {
    notifFilterForm.reset();
    cargarNotificaciones();
});

notifMarkAllReadButton.addEventListener("click", async () => {
    try {
        await window.VehiAmb.api.marcarTodasNotificacionesLeidas();
        await cargarNotificaciones();
    } catch (error) {
        window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudieron marcar las notificaciones", "error");
    }
});

notifDeleteReadButton.addEventListener("click", async () => {
    try {
        await window.VehiAmb.api.eliminarNotificacionesLeidas();
        await cargarNotificaciones();
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
        } else if (notifAction === "aprobar") {
            await window.VehiAmb.api.aprobarNotificacion(notifId);
        } else if (notifAction === "rechazar") {
            await window.VehiAmb.api.rechazarNotificacion(notifId);
        }
        await cargarNotificaciones();
    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudo completar la accion", "error");
        actionButton.disabled = false;
    }
});

document.addEventListener("DOMContentLoaded", async () => {
    await fillVehiculoFiltro();
    await cargarNotificaciones();
});
