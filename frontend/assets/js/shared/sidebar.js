// Algunas secciones colapsables (.section-card-collapsible) tienen botones o
// enlaces propios dentro del encabezado (ej. "Marcar todas leidas" en
// notificaciones.html), ademas del titulo. Sin esto, cualquier clic ahi
// tambien colapsaria/expandiria la seccion (comportamiento nativo de
// <summary>), interfiriendo con la accion real del boton.
document.addEventListener("click", (event) => {
    const summary = event.target.closest("summary.section-card-head");
    if (!summary) return;
    if (event.target.closest("button, a, input, select, textarea, label")) {
        event.preventDefault();
    }
});

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

function formatearFechaHoy() {
    return new Date().toLocaleDateString("es-CO", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
    });
}

// Version corta para la topbar movil, que tiene mucho menos espacio
// horizontal que el encabezado de escritorio (.page-header-right).
function formatearFechaCorta() {
    return new Date().toLocaleDateString("es-CO", {
        day: "numeric",
        month: "short",
        year: "numeric"
    });
}

// Coloca (o actualiza) el nombre de la empresa justo debajo de un elemento de
// fecha ya existente -- se usa tanto para el encabezado generico
// (.page-header-right) como para los dos layouts especiales de index.html
// (dashboardHome / conductorHome), que no usan .page-header.
function actualizarBloqueFechaEmpresa(fechaEl, empresaNombre) {
    if (!fechaEl) return;
    fechaEl.textContent = formatearFechaHoy();

    let empresaEl = fechaEl.nextElementSibling;
    if (!empresaEl || !empresaEl.classList.contains("page-header-empresa")) {
        empresaEl = document.createElement("p");
        empresaEl.className = "page-header-empresa";
        fechaEl.insertAdjacentElement("afterend", empresaEl);
    }
    empresaEl.textContent = empresaNombre || "";
}

// Todas las paginas (menos index.html, que tiene su propio layout) usan
// .page-header; si a la pagina le faltaba el bloque de fecha (varias no lo
// tenian), se crea aqui en vez de tener que agregarlo a mano en cada HTML.
function actualizarEncabezadoPagina(empresaNombre) {
    const pageHeader = document.querySelector(".page-header");

    if (pageHeader) {
        let right = pageHeader.querySelector(".page-header-right");
        if (!right) {
            right = document.createElement("div");
            right.className = "page-header-right";
            pageHeader.appendChild(right);
        }

        let fechaEl = right.querySelector("#fecha-hoy");
        if (!fechaEl) {
            fechaEl = document.createElement("p");
            fechaEl.className = "dash-fecha";
            fechaEl.id = "fecha-hoy";
            fechaEl.setAttribute("aria-label", "Fecha de hoy");
            right.insertBefore(fechaEl, right.firstChild);
        }

        actualizarBloqueFechaEmpresa(fechaEl, empresaNombre);
        return;
    }

    actualizarBloqueFechaEmpresa(document.getElementById("fecha-hoy"), empresaNombre);
    actualizarBloqueFechaEmpresa(document.getElementById("fecha-hoy-conductor"), empresaNombre);
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
    // No toda notificacion tiene un evento real detras (ej. "usuario creado"
    // no trae referencia_tipo/referencia_id) -- sin eso no hay a que colgarle
    // el comentario, asi que el boton solo aparece cuando si aplica. Se
    // filtra ademas por permiso, igual que el resto de acciones que no todos
    // los roles pueden hacer.
    if (notificacion.referencia_tipo && notificacion.referencia_id && window.VehiAmb.auth?.hasPermission?.("notificaciones.comentar")) {
        botones.push(`<button type="button" class="btn-secondary notif-item-icon-btn" data-notif-action="comentar" data-notif-id="${notificacion.id}" data-notif-referencia-tipo="${escapeHtml(notificacion.referencia_tipo)}" data-notif-referencia-id="${notificacion.referencia_id}" title="Comentar">💬</button>`);
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

// Mismo patron visual que window.VehiAmb.ui.confirm() (ui.js) -- backdrop +
// modal, Escape/click afuera cancela -- pero con un formulario en vez de un
// mensaje, porque acá hace falta capturar texto + un archivo opcional, no
// solo confirmar o cancelar. Devuelve { comentario, foto } o null si se
// cancela.
function renderHiloComentarios(hilo) {
    const cfg = window.VehiAmb.notifConfig;

    if (!hilo.length) {
        return '<p class="dash-empty">Todavía no hay comentarios.</p>';
    }

    return hilo.map((comentario) => `
        <div class="notif-comentario-item">
            <div class="notif-comentario-meta">
                <strong>${escapeHtml(comentario.usuario_nombre || "Usuario")}</strong>
                <span class="notif-item-time">${cfg.tiempoTranscurrido(comentario.creado_en)}</span>
            </div>
            <p>${escapeHtml(comentario.comentario)}</p>
            ${comentario.foto_url ? `<a href="${escapeHtml(window.VehiAmb.api.getAssetUrl(comentario.foto_url))}" target="_blank" rel="noopener">Ver foto adjunta</a>` : ""}
        </div>
    `).join("");
}

// "hilo" son los comentarios que ya existen para este evento (referencia_tipo
// + referencia_id) -- se piden ANTES de abrir el modal (ver el handler de
// click) para que aparezca completo desde el primer render, sin un salto
// visual de "vacio" a "con contenido".
function abrirFormularioComentario(hilo = []) {
    return new Promise((resolve) => {
        const backdrop = document.createElement("div");
        backdrop.className = "confirm-backdrop";

        const modal = document.createElement("div");
        modal.className = "confirm-modal";
        modal.setAttribute("role", "dialog");
        modal.setAttribute("aria-modal", "true");
        modal.innerHTML = `
            <h3>Comentarios</h3>
            <div class="notif-comentarios-hilo">${renderHiloComentarios(hilo)}</div>
            <div class="form-group">
                <label>Nuevo comentario</label>
                <textarea rows="3" maxlength="500" placeholder="Ej: Ya se está gestionando" data-comentario-texto></textarea>
            </div>
            <div class="form-group">
                <label>Foto (opcional)</label>
                <input type="file" accept="image/png,image/jpeg,image/webp" data-comentario-foto>
            </div>
            <div class="confirm-modal-actions">
                <button type="button" class="btn-secondary" data-comentario-cancelar>Cancelar</button>
                <button type="button" class="btn-primary" data-comentario-guardar>Guardar</button>
            </div>
        `;

        backdrop.appendChild(modal);
        document.body.appendChild(backdrop);

        const textoInput = modal.querySelector("[data-comentario-texto]");
        const fotoInput = modal.querySelector("[data-comentario-foto]");

        function cleanup(resultado) {
            backdrop.remove();
            document.removeEventListener("keydown", onKeydown);
            resolve(resultado);
        }

        function onKeydown(event) {
            if (event.key === "Escape") cleanup(null);
        }

        backdrop.addEventListener("click", (event) => {
            // El backdrop/modal cuelga de document.body, fuera del <aside>
            // del panel de notificaciones -- sin cortar la propagacion aca,
            // cualquier clic adentro (el boton Guardar incluido) burbujea
            // hasta el listener de "clic afuera" (mas abajo, en
            // setupNotificaciones) y ese cierra el panel por error, como si
            // hubieras clickeado afuera de todo.
            event.stopPropagation();
            if (event.target === backdrop) cleanup(null);
        });

        modal.querySelector("[data-comentario-cancelar]").addEventListener("click", () => cleanup(null));
        modal.querySelector("[data-comentario-guardar]").addEventListener("click", () => {
            const comentario = textoInput.value.trim();
            if (!comentario) {
                textoInput.focus();
                return;
            }
            cleanup({ comentario, foto: fotoInput.files[0] || null });
        });

        document.addEventListener("keydown", onKeydown);
        textoInput.focus();
    });
}

// Los navegadores bloquean el audio hasta que haya un gesto real del
// usuario (clic, tecla, etc.) -- por eso el AudioContext se crea recien en
// el primer clic de la pagina, no al cargarla. Si el sonido intenta sonar
// antes de ese primer clic (poll automatico nada mas abrir la pagina) se
// omite en silencio en vez de fallar.
let notifAudioCtx = null;

function desbloquearAudioNotificaciones() {
    if (notifAudioCtx) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    notifAudioCtx = new AudioContextClass();
}

document.addEventListener("click", desbloquearAudioNotificaciones, { once: true });

// Timbre corto de dos notas sintetizado con Web Audio API -- sin depender de
// ningun archivo de audio externo.
function reproducirSonidoNotificacion() {
    if (!notifAudioCtx) return;
    if (notifAudioCtx.state === "suspended") notifAudioCtx.resume();

    const ahora = notifAudioCtx.currentTime;
    [
        { freq: 880, inicio: 0, duracion: 0.12 },
        { freq: 1318.5, inicio: 0.1, duracion: 0.18 }
    ].forEach(({ freq, inicio, duracion }) => {
        const osc = notifAudioCtx.createOscillator();
        const gain = notifAudioCtx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, ahora + inicio);
        gain.gain.linearRampToValueAtTime(0.18, ahora + inicio + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ahora + inicio + duracion);
        osc.connect(gain);
        gain.connect(notifAudioCtx.destination);
        osc.start(ahora + inicio);
        osc.stop(ahora + inicio + duracion + 0.02);
    });
}

async function setupNotificaciones(aside) {
    const bellButton = aside.querySelector("#notifBellButton");
    const panel = aside.querySelector("#notifPanel");
    const badge = aside.querySelector("#notifBadge");
    const body = aside.querySelector("#notifPanelBody");
    const filtrosEl = aside.querySelector("#notifPanelFiltros");
    if (!bellButton || !panel || !badge || !body) return;

    let filtroActivo = "todas";
    // null hasta el primer refrescar() exitoso, para no sonar apenas se
    // carga la pagina -- solo cuando el numero de pendientes sube respecto
    // al ultimo valor conocido (llego algo nuevo entre un poll y otro).
    let pendientesAnterior = null;

    async function refrescar() {
        try {
            const [notificaciones, contador] = await Promise.all([
                window.VehiAmb.api.getNotificaciones(NOTIF_PANEL_FILTERS[filtroActivo]),
                window.VehiAmb.api.getContadorNotificaciones()
            ]);
            renderNotificaciones(notificaciones, body, badge, contador.pendientes);

            if (pendientesAnterior !== null && contador.pendientes > pendientesAnterior) {
                reproducirSonidoNotificacion();
            }
            pendientesAnterior = contador.pendientes;
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
        const { notifAction, notifId, notifReferenciaTipo, notifReferenciaId } = actionButton.dataset;

        // "comentar" abre un formulario antes de decidir si hay algo que
        // mandar -- si el usuario cancela, no hay que deshabilitar el boton
        // ni tocar la red, a diferencia del resto de acciones que son
        // inmediatas.
        if (notifAction === "comentar") {
            actionButton.disabled = true;
            let hilo = [];
            try {
                hilo = await window.VehiAmb.api.getComentariosNotificacion(notifReferenciaTipo, notifReferenciaId);
            } catch (error) {
                console.error(error);
            } finally {
                actionButton.disabled = false;
            }

            const resultado = await abrirFormularioComentario(hilo);
            if (!resultado) return;

            actionButton.disabled = true;
            try {
                const formData = new FormData();
                formData.append("comentario", resultado.comentario);
                if (resultado.foto) formData.append("foto", resultado.foto);

                await window.VehiAmb.api.comentarNotificacion(notifReferenciaTipo, notifReferenciaId, formData);
                await refrescar();
            } catch (error) {
                console.error(error);
            } finally {
                actionButton.disabled = false;
            }
            return;
        }

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

function setupMobileNav(aside) {
    const layout = document.querySelector(".layout");
    if (!layout || document.querySelector(".mobile-topbar")) return;

    const topbar = document.createElement("div");
    topbar.className = "mobile-topbar";
    topbar.innerHTML = `
        <button type="button" class="mobile-menu-toggle" id="mobileMenuToggle" aria-label="Abrir menú" aria-expanded="false">
            <span class="mobile-menu-icon"></span>
        </button>
        <img src="img/vehiamb_white.png" alt="Vehiamb" class="mobile-topbar-logo">
        <div class="mobile-topbar-right">
            <p class="mobile-topbar-empresa" id="mobileTopbarEmpresa"></p>
            <p class="mobile-topbar-fecha" id="mobileTopbarFecha">${formatearFechaCorta()}</p>
        </div>
    `;
    layout.insertBefore(topbar, layout.firstChild);

    const backdrop = document.createElement("div");
    backdrop.className = "sidebar-backdrop";
    document.body.appendChild(backdrop);

    const toggleButton = topbar.querySelector("#mobileMenuToggle");

    function closeMenu() {
        aside.classList.remove("is-open");
        backdrop.classList.remove("is-visible");
        document.body.classList.remove("sidebar-open-lock");
        toggleButton.setAttribute("aria-expanded", "false");
    }

    function openMenu() {
        aside.classList.add("is-open");
        backdrop.classList.add("is-visible");
        document.body.classList.add("sidebar-open-lock");
        toggleButton.setAttribute("aria-expanded", "true");
    }

    toggleButton.addEventListener("click", () => {
        if (aside.classList.contains("is-open")) {
            closeMenu();
        } else {
            openMenu();
        }
    });

    backdrop.addEventListener("click", closeMenu);

    aside.addEventListener("click", (event) => {
        if (event.target.closest("button[data-page]")) closeMenu();
    });

    window.addEventListener("resize", () => {
        if (window.innerWidth > 900) closeMenu();
    });
}

// Solo visible para quien tiene "empresas.switch" (rol SuperAdministrador).
// Cambiar de empresa activa guarda la seleccion (auth.js la manda como
// header X-Empresa-Id en cada llamada) y recarga la pagina -- no hay SPA
// routing en este proyecto, asi que recargar es la forma mas simple de que
// todo (datos, permisos, nombre de empresa) quede consistente con la nueva
// empresa activa.
async function setupEmpresaSwitcher(aside, user) {
    const wrap = aside.querySelector("#sidebarEmpresaSwitcher");
    const select = aside.querySelector("#sidebarEmpresaSelect");
    if (!wrap || !select) return;

    if (!window.VehiAmb.auth.hasPermission("empresas.switch")) {
        wrap.classList.add("hidden");
        return;
    }

    try {
        const empresas = await window.VehiAmb.api.getEmpresas();

        select.innerHTML = empresas
            .filter((empresa) => empresa.activo)
            .map((empresa) => `<option value="${empresa.id}">${escapeHtml(empresa.nombre)}</option>`)
            .join("");

        select.value = String(user.empresa_id);
        wrap.classList.remove("hidden");

        select.addEventListener("change", () => {
            window.VehiAmb.auth.setEmpresaActivaId(select.value);
            window.location.reload();
        });
    } catch (error) {
        console.error("No fue posible cargar el selector de empresas:", error);
    }
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
                <button data-page="conductores.html" data-permission="conductores.view">Conductores</button>
                <button data-page="entrega-recibida.html" data-permission="delivery.view" disabled>Actas de vehículo</button>
                <button data-page="asignaciones.html" data-permission="asignaciones.view">Asignación de rutas</button>
                <button data-page="mi-viaje.html" data-permission="trips.view">Mi último viaje</button>
                <button data-page="costos.html" data-permission="costs.view">Gastos</button>
                <button data-page="importaciones.html" data-permission="imports.view">Importaciones</button>
                <button data-page="notificaciones.html" data-permission="dashboard.view">Notificaciones</button>
                <button data-page="repuestos.html" data-permission="inventory.view">Catalogo de Repuestos</button>
                <button data-page="stock-importaciones.html" data-permission="inventory.import">Importacion de Stock</button>
                <button data-page="admin-usuarios.html" data-permission="users.manage">Usuarios</button>
            </nav>
        `;
    }

    setupMobileNav(aside);

    const nameEl = aside.querySelector("#sidebarUserName");
    const roleEl = aside.querySelector("#sidebarUserRole");
    const empresaEl = aside.querySelector("#sidebarUserEmpresa");
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
        if (empresaEl) empresaEl.textContent = user.empresa_nombre || "";
        const mobileTopbarEmpresaEl = document.getElementById("mobileTopbarEmpresa");
        if (mobileTopbarEmpresaEl) mobileTopbarEmpresaEl.textContent = user.empresa_nombre || "";
        if (avatarEl) {
            avatarEl.innerHTML = user.foto_url
                ? `<img src="${window.VehiAmb.api.getAssetUrl(user.foto_url)}" alt="">`
                : getInitials(user.nombre);
        }
        actualizarEncabezadoPagina(user.empresa_nombre);

        await setupEmpresaSwitcher(aside, user);

        // Conductor necesita maintenance.view/documents.view/vehicles.view para
        // ver esas secciones DENTRO de la ficha del vehiculo (y para el
        // desplegable de "que vehiculo vas a usar" en Inicio), pero no debe
        // tener los modulos completos de Mantenimientos/Documentos/Ver vehiculos
        // (con datos de toda la flota) como opciones propias del menu -- son el
        // mismo permiso, asi que el filtro por permiso no alcanza; esta
        // excepcion puntual por rol oculta esos botones solo para Conductor.
        // El bloqueo real de acceso directo por URL vive en auth.js
        // (PAGINAS_BLOQUEADAS_POR_ROL), esto solo oculta el boton del menu.
        const paginasOcultasPorRol = {
            Conductor: ["mantenimientos.html", "documentos.html", "dashboard.html", "conductores.html", "notificaciones.html"]
        };

        aside.querySelectorAll("button[data-permission]").forEach((btn) => {
            const ocultoPorRol = paginasOcultasPorRol[user.rol]?.includes(btn.dataset.page);
            if (ocultoPorRol || !window.VehiAmb.auth.hasPermission(btn.dataset.permission)) {
                btn.remove();
            }
        });

        // El Conductor no debe tener la campana de notificaciones -- ni el
        // modulo completo (ya oculto arriba) ni este acceso rapido, que es un
        // elemento aparte del sidebar-footer, no un boton mas del <nav>.
        if (user.rol === "Conductor") {
            aside.querySelector(".notif-bell-wrap")?.remove();
        }

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
