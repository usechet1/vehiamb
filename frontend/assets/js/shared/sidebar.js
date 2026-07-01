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

const NOTIF_TIPO_LABEL = {
    aprobacion: "Aprobacion requerida",
    alerta: "Alerta",
    info: "Informacion"
};

function renderNotificaciones(notificaciones, body, badge) {
    const noLeidas = notificaciones.filter((notificacion) => !notificacion.leido).length;

    badge.textContent = String(noLeidas);
    badge.classList.toggle("hidden", noLeidas === 0);

    if (!notificaciones.length) {
        body.innerHTML = '<p class="dash-empty">No tienes notificaciones.</p>';
        return;
    }

    body.innerHTML = notificaciones.map((notificacion) => {
        const esAprobacionPendiente = notificacion.tipo === "aprobacion" && !notificacion.leido;
        const acciones = esAprobacionPendiente
            ? `
                <button type="button" class="btn-primary" data-notif-action="aprobar" data-notif-id="${notificacion.id}">Aprobar</button>
                <button type="button" class="btn-secondary" data-notif-action="rechazar" data-notif-id="${notificacion.id}">Rechazar</button>
            `
            : !notificacion.leido
                ? `<button type="button" class="btn-secondary" data-notif-action="leido" data-notif-id="${notificacion.id}">Marcar leida</button>`
                : "";

        return `
            <article class="notif-item notif-item--${notificacion.tipo}${notificacion.leido ? " notif-item--leido" : ""}">
                <span class="notif-item-tag">${NOTIF_TIPO_LABEL[notificacion.tipo] || notificacion.tipo}</span>
                <p>${escapeHtml(notificacion.mensaje)}</p>
                ${acciones ? `<div class="notif-item-actions">${acciones}</div>` : ""}
            </article>
        `;
    }).join("");
}

async function setupNotificaciones(aside) {
    const bellButton = aside.querySelector("#notifBellButton");
    const panel = aside.querySelector("#notifPanel");
    const badge = aside.querySelector("#notifBadge");
    const body = aside.querySelector("#notifPanelBody");
    if (!bellButton || !panel || !badge || !body) return;

    async function refrescar() {
        try {
            const notificaciones = await window.VehiAmb.api.getNotificaciones();
            renderNotificaciones(notificaciones, body, badge);
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

    body.addEventListener("click", async (event) => {
        const actionButton = event.target.closest("[data-notif-action]");
        if (!actionButton) return;

        const { notifAction, notifId } = actionButton.dataset;
        actionButton.disabled = true;

        try {
            if (notifAction === "leido") {
                await window.VehiAmb.api.marcarNotificacionLeida(notifId);
            } else if (notifAction === "aprobar") {
                await window.VehiAmb.api.aprobarNotificacion(notifId);
            } else if (notifAction === "rechazar") {
                await window.VehiAmb.api.rechazarNotificacion(notifId);
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
