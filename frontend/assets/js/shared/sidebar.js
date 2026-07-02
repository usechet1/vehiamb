function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function getInitials(name) {
    return String(name || "VA")
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() || "")
        .join("");
}

function findNextButton(element) {
    let next = element.nextElementSibling;

    while (next) {
        if (next.matches("button[data-page]")) return next;
        if (next.matches(".nav-divider, .nav-label")) return null;
        next = next.nextElementSibling;
    }

    return null;
}

const NOTIF_PANEL_FILTERS = {
    todas: {},
    no_leidas: { estado: "no_leida" },
    criticas: { prioridad: "critica" }
};

function renderNotifItem(notificacion, { dentroDeGrupo = false } = {}) {
    const cfg = window.VehiAmb.notifConfig;
    const prioridad = cfg.prioridadConfig(notificacion.prioridad);
    const categoria = cfg.categoriaConfig(notificacion.categoria);
    const accion = cfg.accionConfig(notificacion.accion);
    const noLeida = notificacion.estado === "no_leida";

    const esAprobacionPendiente = notificacion.tipo === "aprobacion_requerida" && noLeida;

    const botones = [];
    if (esAprobacionPendiente) {
        botones.push(`<button type="button" class="btn-primary" data-notif-action="aprobar" data-notif-id="${notificacion.id}">Aprobar</button>`);
        botones.push(`<button type="button" class="btn-secondary" data-notif-action="rechazar" data-notif-id="${notificacion.id}">Rechazar</button>`);
    } else {
        if (accion) {
            botones.push(`<a class="btn-secondary" href="${accion.url}" data-notif-nav="${notificacion.id}">${escapeHtml(accion.label)}</a>`);
        }
        if (noLeida) {
            botones.push(`<button type="button" class="btn-secondary" data-notif-action="leido" data-notif-id="${notificacion.id}">Marcar leida</button>`);
        }
    }
    botones.push(`<button type="button" class="btn-secondary notif-item-icon-btn" data-notif-action="eliminar" data-notif-id="${notificacion.id}" title="Eliminar">✕</button>`);

    const vehiculoLabel = notificacion.vehiculo
        ? `${notificacion.vehiculo.placa || ""} ${notificacion.vehiculo.marca || ""} ${notificacion.vehiculo.modelo || ""}`.trim()
        : "";

    return `
        <article class="notif-item ${prioridad.className}${noLeida ? "" : " notif-item--leido"}"${dentroDeGrupo ? ' data-notif-child="true"' : ""}>
            <div class="notif-item-head">
                <span class="notif-item-tag">${categoria.icono} ${escapeHtml(categoria.label)}</span>
                <span class="notif-item-prioridad" title="Prioridad ${escapeHtml(prioridad.label)}">${prioridad.icono}</span>
            </div>
            <strong class="notif-item-titulo">${escapeHtml(notificacion.titulo)}</strong>
            <p>${escapeHtml(notificacion.mensaje)}</p>
            <div class="notif-item-meta">
                ${vehiculoLabel ? `<span class="pill">${escapeHtml(vehiculoLabel)}</span>` : ""}
                <span class="notif-item-time">${cfg.tiempoTranscurrido(notificacion.fecha_creacion)}</span>
            </div>
            ${botones.length ? `<div class="notif-item-actions">${botones.join("")}</div>` : ""}
        </article>
    `;
}

function renderNotifEntry(notificacion) {
    if (!notificacion.agrupado) return renderNotifItem(notificacion);

    const cfg = window.VehiAmb.notifConfig;
    const prioridad = cfg.prioridadConfig(notificacion.prioridad);
    const categoria = cfg.categoriaConfig(notificacion.categoria);

    return `
        <details class="notif-item notif-item--grupo ${prioridad.className}">
            <summary>
                <div class="notif-item-head">
                    <span class="notif-item-tag">${categoria.icono} ${escapeHtml(categoria.label)}</span>
                    <span class="notif-item-prioridad">${prioridad.icono}</span>
                </div>
                <strong class="notif-item-titulo">${escapeHtml(notificacion.titulo)}</strong>
                <p>${escapeHtml(notificacion.mensaje)}</p>
            </summary>
            <div class="notif-grupo-items">
                ${notificacion.items.map((item) => renderNotifItem(item, { dentroDeGrupo: true })).join("")}
            </div>
        </details>
    `;
}

function renderNotificaciones(notificaciones, body, badge, pendientes) {
    badge.textContent = String(pendientes);
    badge.classList.toggle("hidden", pendientes === 0);

    if (!notificaciones.length) {
        body.innerHTML = '<p class="dash-empty">No tienes notificaciones.</p>';
        return;
    }

    body.innerHTML = notificaciones.map(renderNotifEntry).join("");
}

async function setupNotificaciones(aside) {
    const bellButton = aside.querySelector("#notifBellButton");
    const panel = aside.querySelector("#notifPanel");
    const badge = aside.querySelector("#notifBadge");
    const body = aside.querySelector("#notifPanelBody");
    const filtrosEl = aside.querySelector("#notifPanelFiltros");
    if (!bellButton || !panel || !badge || !body) return;

    let filtroActivo = "todas";

    async function refrescar() {
        try {
            const [notificaciones, contador] = await Promise.all([
                window.VehiAmb.api.getNotificaciones(NOTIF_PANEL_FILTERS[filtroActivo]),
                window.VehiAmb.api.getContadorNotificaciones()
            ]);
            renderNotificaciones(notificaciones, body, badge, contador.pendientes);
        } catch (error) {
            console.error("No fue posible cargar las notificaciones:", error);
        }
    }

    bellButton.addEventListener("click", () => {
        panel.classList.toggle("hidden");
    });

    document.addEventListener("click", (event) => {
        if (panel.classList.contains("hidden")) return;
        if (panel.contains(event.target) || bellButton.contains(event.target)) return;
        panel.classList.add("hidden");
    });

    filtrosEl?.addEventListener("click", (event) => {
        const chip = event.target.closest("[data-notif-filtro]");
        if (!chip) return;

        filtroActivo = chip.dataset.notifFiltro;
        filtrosEl.querySelectorAll("[data-notif-filtro]").forEach((el) => el.classList.toggle("active", el === chip));
        refrescar();
    });

    body.addEventListener("click", async (event) => {
        if (event.target.closest("[data-notif-nav]")) {
            panel.classList.add("hidden");
            return;
        }

        const actionButton = event.target.closest("[data-notif-action]");
        if (!actionButton) return;

        event.preventDefault();
        const { notifAction, notifId } = actionButton.dataset;
        actionButton.disabled = true;

        try {
            if (notifAction === "leido") {
                await window.VehiAmb.api.marcarNotificacionLeida(notifId);
            } else if (notifAction === "aprobar") {
                await window.VehiAmb.api.aprobarNotificacion(notifId);
            } else if (notifAction === "rechazar") {
                await window.VehiAmb.api.rechazarNotificacion(notifId);
            } else if (notifAction === "eliminar") {
                await window.VehiAmb.api.eliminarNotificacion(notifId);
            }
            await refrescar();
        } catch (error) {
            console.error(error);
            actionButton.disabled = false;
        }
    });

    await refrescar();
    setInterval(refrescar, 60000);
}

function removeEmptyMenuGroups(aside) {
    aside.querySelectorAll(".sidebar-menu").forEach((menu) => {
        menu.querySelectorAll(".nav-divider, .nav-label").forEach((marker) => {
            if (!findNextButton(marker)) {
                marker.remove();
            }
        });
    });
}

async function cargarSidebar() {
    const aside = document.getElementById("sidebar");
    if (!aside) return;

    try {
        const res = await fetch(`components/sidebar.html?v=${Date.now()}`, {
            cache: "no-store"
        });
        if (!res.ok) {
            throw new Error("No se pudo cargar el sidebar");
        }

        aside.innerHTML = await res.text();
    } catch (error) {
        console.error(error);
        aside.innerHTML = `
            <nav class="sidebar-menu">
                <button data-page="index.html" data-permission="dashboard.view">Inicio</button>
                <button data-page="add.html" data-permission="vehicles.create">Anadir vehiculo</button>
                <button data-page="dashboard.html" data-permission="vehicles.view">Ver vehiculos</button>
                <button data-page="mantenimientos.html" data-permission="maintenance.view">Mantenimientos</button>
                <button data-page="documentos.html" data-permission="documents.view">Documentos</button>
                <button data-page="simit.html" data-permission="simit.view">Consulta SIMIT</button>
                <button data-page="admin-usuarios.html" data-permission="users.manage">Usuarios</button>
            </nav>
        `;
    }

    const nameEl = aside.querySelector("#sidebarUserName");
    const roleEl = aside.querySelector("#sidebarUserRole");
    const avatarEl = aside.querySelector("#userAvatar");
    const logoutButton = aside.querySelector("#logoutButton");

    logoutButton?.addEventListener("click", () => {
        window.VehiAmb.auth.logout();
    });

    try {
        const user = await window.VehiAmb.auth.fetchCurrentUser();
        if (!user) return;

        if (nameEl) nameEl.textContent = user.nombre;
        if (roleEl) roleEl.textContent = user.rol || "Usuario";
        if (avatarEl) avatarEl.textContent = getInitials(user.nombre);

        aside.querySelectorAll("button[data-permission]").forEach((btn) => {
            if (!window.VehiAmb.auth.hasPermission(btn.dataset.permission)) {
                btn.remove();
            }
        });

        removeEmptyMenuGroups(aside);
        await setupNotificaciones(aside);
    } catch (error) {
        console.error("No fue posible cargar el usuario del sidebar:", error);
    }

    const paginaActual = window.location.pathname.split("/").pop() || "index.html";
    aside.querySelectorAll("button[data-page]").forEach((btn) => {
        if (btn.dataset.page === paginaActual) {
            btn.classList.add("active");
        }

        btn.addEventListener("click", () => {
            if (btn.disabled) return;
            window.location.href = btn.dataset.page;
        });
    });
}

cargarSidebar();
