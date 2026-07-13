const inspeccionMensaje = document.getElementById("mensaje");
const vehicleInspeccionSection = document.getElementById("vehicleInspeccionSection");
const inspeccionHotspotsEl = document.getElementById("inspeccionHotspots");
const inspeccionPanelEl = document.getElementById("inspeccionPanel");
const inspeccionResumenEl = document.getElementById("inspeccionResumen");
const guardarInspeccionButton = document.getElementById("guardarInspeccionButton");
const limpiarInspeccionButton = document.getElementById("limpiarInspeccionButton");
const inspeccionHistorialList = document.getElementById("inspeccionHistorialList");

let inspeccionVehiculoId = "";
let inspeccionCatalogo = [];
let inspeccionMarcados = new Map();
let inspeccionActivo = null;
let inspeccionPuedeCrear = false;
let inspeccionDetalleCache = new Map();

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatFecha(value) {
    if (!value) return "Sin fecha";
    return new Date(value).toLocaleString("es-CO", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function getEstadoClaseGrupo(item) {
    const estados = item.subItems.map((subItem) => inspeccionMarcados.get(subItem.codigo)?.estado);
    const totalMarcados = estados.filter(Boolean).length;
    if (!totalMarcados) return "";
    if (estados.includes("mal")) return "is-mal";
    if (totalMarcados === item.subItems.length) return "is-bien";
    return "is-parcial";
}

function getTotalItemsCount() {
    return inspeccionCatalogo.reduce((total, item) => total + (item.subItems ? item.subItems.length : 1), 0);
}

function renderHotspots() {
    inspeccionHotspotsEl.innerHTML = inspeccionCatalogo.map((item) => {
        const estadoClase = item.subItems
            ? getEstadoClaseGrupo(item)
            : (inspeccionMarcados.get(item.codigo) ? `is-${inspeccionMarcados.get(item.codigo).estado}` : "");
        return `
            <button
                type="button"
                class="inspeccion-hotspot ${estadoClase} ${item.codigo === inspeccionActivo ? "is-active" : ""}"
                style="left:${item.x}%; top:${item.y}%;"
                data-codigo="${escapeHtml(item.codigo)}"
                title="${escapeHtml(item.label)}"
                aria-label="${escapeHtml(item.label)}"
            ></button>
        `;
    }).join("");

    inspeccionHotspotsEl.querySelectorAll(".inspeccion-hotspot").forEach((el) => {
        el.addEventListener("click", () => {
            inspeccionActivo = el.dataset.codigo;
            renderHotspots();
            renderPanel();
        });
    });
}

function renderPanel() {
    if (!inspeccionActivo) {
        inspeccionPanelEl.innerHTML = '<p class="dash-empty">Selecciona un punto del diagrama para marcar su estado.</p>';
        return;
    }

    const item = inspeccionCatalogo.find((catalogoItem) => catalogoItem.codigo === inspeccionActivo);
    if (!item) return;

    if (item.subItems) {
        renderPanelGrupo(item);
        return;
    }

    const marcado = inspeccionMarcados.get(item.codigo);

    inspeccionPanelEl.innerHTML = `
        <h4>${escapeHtml(item.label)}</h4>
        <div class="inspeccion-panel-actions">
            <button type="button" class="btn-secondary inspeccion-estado-btn ${marcado?.estado === "bien" ? "is-selected-bien" : ""}" data-estado="bien">Bien</button>
            <button type="button" class="btn-secondary inspeccion-estado-btn ${marcado?.estado === "mal" ? "is-selected-mal" : ""}" data-estado="mal">Mal</button>
        </div>
        ${marcado ? `
            <div class="form-group">
                <label>Comentario (opcional)</label>
                <textarea id="inspeccionComentarioInput" rows="2" placeholder="Detalle del hallazgo...">${escapeHtml(marcado.comentario || "")}</textarea>
            </div>
            <div class="form-group">
                <label>Foto (opcional)</label>
                <input type="file" id="inspeccionFotoInput" accept="image/png,image/jpeg,image/webp">
                ${marcado.fotoNombre ? `<span class="field-help">Archivo: ${escapeHtml(marcado.fotoNombre)}</span>` : ""}
            </div>
            <button type="button" class="record-link" id="inspeccionQuitarButton">Quitar marca</button>
        ` : '<p class="field-help">Marca Bien o Mal para registrar este ítem.</p>'}
    `;

    inspeccionPanelEl.querySelectorAll(".inspeccion-estado-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            const existente = inspeccionMarcados.get(item.codigo);
            inspeccionMarcados.set(item.codigo, {
                estado: btn.dataset.estado,
                comentario: existente?.comentario || "",
                fotoFile: existente?.fotoFile || null,
                fotoNombre: existente?.fotoNombre || null
            });
            renderHotspots();
            renderPanel();
            renderResumen();
        });
    });

    const comentarioInput = document.getElementById("inspeccionComentarioInput");
    comentarioInput?.addEventListener("input", () => {
        const entrada = inspeccionMarcados.get(item.codigo);
        if (entrada) entrada.comentario = comentarioInput.value;
    });

    const fotoInput = document.getElementById("inspeccionFotoInput");
    fotoInput?.addEventListener("change", () => {
        const entrada = inspeccionMarcados.get(item.codigo);
        if (!entrada) return;
        const file = fotoInput.files?.[0] || null;
        entrada.fotoFile = file;
        entrada.fotoNombre = file?.name || null;
        renderPanel();
    });

    document.getElementById("inspeccionQuitarButton")?.addEventListener("click", () => {
        inspeccionMarcados.delete(item.codigo);
        renderHotspots();
        renderPanel();
        renderResumen();
    });
}

// Cada subItem se marca con un solo botón tipo casilla que cicla sin
// marcar -> bien -> mal -> sin marcar, en vez de dos botones "Bien"/"Mal"
// más un textarea de comentario que hacían crecer cada fila a un alto
// distinto. Así todos los ítems del kit quedan con el mismo tamaño.
function renderPanelGrupo(item) {
    inspeccionPanelEl.innerHTML = `
        <h4>${escapeHtml(item.label)}</h4>
        <p class="field-help">Marca el estado de cada elemento del kit de herramientas y equipo de carretera.</p>
        <div class="inspeccion-checklist-grupo">
            ${item.subItems.map((subItem) => {
                const estado = inspeccionMarcados.get(subItem.codigo)?.estado;
                const estadoClase = estado ? `is-${estado}` : "";
                const estadoLabel = estado === "bien" ? "Bien" : estado === "mal" ? "Mal" : "Marcar";
                return `
                    <button type="button" class="inspeccion-checklist-toggle ${estadoClase}" data-codigo="${escapeHtml(subItem.codigo)}" title="${escapeHtml(subItem.label)}">
                        <span class="inspeccion-checklist-toggle-check" aria-hidden="true"></span>
                        <span class="inspeccion-checklist-toggle-label">${escapeHtml(subItem.label)}</span>
                        <span class="inspeccion-checklist-toggle-estado">${estadoLabel}</span>
                    </button>
                `;
            }).join("")}
        </div>
    `;

    inspeccionPanelEl.querySelectorAll(".inspeccion-checklist-toggle").forEach((btn) => {
        btn.addEventListener("click", () => {
            const codigo = btn.dataset.codigo;
            const estadoActual = inspeccionMarcados.get(codigo)?.estado;
            const siguienteEstado = !estadoActual ? "bien" : estadoActual === "bien" ? "mal" : null;

            if (siguienteEstado === null) {
                inspeccionMarcados.delete(codigo);
            } else {
                inspeccionMarcados.set(codigo, { estado: siguienteEstado, comentario: "", fotoFile: null, fotoNombre: null });
            }
            renderHotspots();
            renderPanel();
            renderResumen();
        });
    });
}

function renderResumen() {
    const totalMarcados = inspeccionMarcados.size;
    const totalMal = [...inspeccionMarcados.values()].filter((item) => item.estado === "mal").length;

    if (!totalMarcados) {
        inspeccionResumenEl.innerHTML = "";
        guardarInspeccionButton.disabled = true;
        return;
    }

    inspeccionResumenEl.innerHTML = `
        <span class="pill">${totalMarcados} de ${getTotalItemsCount()} marcados</span>
        ${totalMal ? `<span class="pill pill-danger">${totalMal} en mal estado</span>` : '<span class="pill pill-success">Todo bien</span>'}
    `;
    guardarInspeccionButton.disabled = !inspeccionPuedeCrear;
}

async function resetInspeccion({ confirmar = false } = {}) {
    if (confirmar && inspeccionMarcados.size) {
        const confirmado = await window.VehiAmb.ui.confirm({
            title: "Limpiar checklist",
            message: "Se perderán las marcas que no hayas guardado. ¿Continuar?",
            confirmText: "Limpiar"
        });
        if (!confirmado) return;
    }

    inspeccionMarcados = new Map();
    inspeccionActivo = null;
    renderHotspots();
    renderPanel();
    renderResumen();
}

async function guardarInspeccion() {
    if (!inspeccionMarcados.size) return;

    const items = [];
    const formData = new FormData();

    inspeccionMarcados.forEach((data, codigo) => {
        items.push({ item_codigo: codigo, estado: data.estado, comentario: data.comentario || "" });
        if (data.fotoFile) {
            formData.append(`foto_${codigo}`, data.fotoFile);
        }
    });

    formData.append("items", JSON.stringify(items));

    try {
        guardarInspeccionButton.disabled = true;
        await window.VehiAmb.api.crearInspeccion(inspeccionVehiculoId, formData);
        window.VehiAmb.ui.showMessage(inspeccionMensaje, "Inspección guardada correctamente");
        await resetInspeccion();
        await cargarHistorial();
    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(inspeccionMensaje, error.message || "No se pudo guardar la inspección", "error");
        guardarInspeccionButton.disabled = false;
    }
}

function renderHistorialDetalle(container, detalle) {
    container.innerHTML = detalle.items.map((item) => `
        <div class="inspeccion-detalle-item">
            <span class="pill ${item.estado === "mal" ? "pill-danger" : "pill-success"}">${escapeHtml(item.item_label)}</span>
            ${item.comentario ? `<p class="field-help">${escapeHtml(item.comentario)}</p>` : ""}
            ${item.foto_url ? `<a class="record-link" href="${escapeHtml(window.VehiAmb.api.getAssetUrl(item.foto_url))}" target="_blank" rel="noreferrer">Ver foto</a>` : ""}
        </div>
    `).join("");
}

function renderHistorial(inspecciones) {
    if (!inspecciones.length) {
        inspeccionHistorialList.innerHTML = '<p class="dash-empty">Este vehículo aún no tiene inspecciones registradas</p>';
        return;
    }

    inspeccionHistorialList.innerHTML = inspecciones.map((item) => `
        <article class="record-item">
            <div class="record-top">
                <div>
                    <span class="record-title">Inspección del ${formatFecha(item.fecha)}</span>
                    <span class="record-sub">${escapeHtml(item.usuario_nombre) || "Usuario no registrado"}</span>
                </div>
                <span class="pill ${item.total_items_mal > 0 ? "pill-danger" : "pill-success"}">
                    ${item.total_items_mal > 0 ? `${item.total_items_mal} en mal estado` : "Todo bien"}
                </span>
            </div>
            <div class="record-meta">
                <span class="pill">${item.total_items} ítems revisados</span>
            </div>
            <button type="button" class="record-link" data-inspeccion-id="${item.id}">Ver detalle</button>
            <div class="inspeccion-detalle hidden" id="inspeccionDetalle-${item.id}"></div>
        </article>
    `).join("");

    inspeccionHistorialList.querySelectorAll("[data-inspeccion-id]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const id = btn.dataset.inspeccionId;
            const container = document.getElementById(`inspeccionDetalle-${id}`);
            if (!container) return;

            const yaVisible = !container.classList.contains("hidden");
            if (yaVisible) {
                container.classList.add("hidden");
                return;
            }

            if (!inspeccionDetalleCache.has(id)) {
                container.innerHTML = '<p class="dash-empty">Cargando...</p>';
                container.classList.remove("hidden");
                try {
                    const detalle = await window.VehiAmb.api.getInspeccionDetalle(id);
                    inspeccionDetalleCache.set(id, detalle);
                } catch (error) {
                    container.innerHTML = '<p class="dash-empty">No se pudo cargar el detalle</p>';
                    return;
                }
            }

            renderHistorialDetalle(container, inspeccionDetalleCache.get(id));
            container.classList.remove("hidden");
        });
    });
}

async function cargarHistorial() {
    try {
        const inspecciones = await window.VehiAmb.api.getInspeccionesByVehicle(inspeccionVehiculoId);
        renderHistorial(inspecciones);
    } catch (error) {
        console.error(error);
        inspeccionHistorialList.innerHTML = '<p class="dash-empty">No se pudo cargar el historial de inspecciones</p>';
    }
}

async function initInspeccion() {
    if (!vehicleInspeccionSection) return;

    if (!window.VehiAmb.auth?.hasPermission?.("maintenance.view")) {
        vehicleInspeccionSection.classList.add("hidden");
        return;
    }

    inspeccionPuedeCrear = Boolean(window.VehiAmb.auth?.hasPermission?.("maintenance.create"));
    inspeccionVehiculoId = new URLSearchParams(window.location.search).get("id") || "";
    if (!inspeccionVehiculoId) return;

    if (!inspeccionPuedeCrear) {
        document.querySelector(".inspeccion-diagram-wrap")?.classList.add("hidden");
        inspeccionPanelEl.classList.add("hidden");
        inspeccionResumenEl.classList.add("hidden");
        guardarInspeccionButton.classList.add("hidden");
        limpiarInspeccionButton.classList.add("hidden");
    }

    guardarInspeccionButton.addEventListener("click", guardarInspeccion);
    limpiarInspeccionButton.addEventListener("click", () => resetInspeccion({ confirmar: true }));

    try {
        inspeccionCatalogo = await window.VehiAmb.api.getChecklistCatalogo();
        renderHotspots();
        renderPanel();
        renderResumen();
    } catch (error) {
        console.error(error);
    }

    await cargarHistorial();
}

document.addEventListener("DOMContentLoaded", initInspeccion);
