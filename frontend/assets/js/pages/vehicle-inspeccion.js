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

const HOTSPOT_ICONOS = {
    llanta_di: "🛞",
    llanta_dd: "🛞",
    llanta_ti: "🛞",
    llanta_td: "🛞",
    llanta_repuesto: "🛞",
    aceite: "🛢️",
    kit_herramientas: "🧰",
    luces: "💡",
    extintor: "🧯",
    botiquin: "➕"
};

function getTotalItemsCount() {
    return inspeccionCatalogo.reduce((total, item) => total + (item.subItems ? item.subItems.length : 1), 0);
}

// Lista plana de todos los items marcables (hotspots sueltos + cada
// elemento del kit de herramientas), usada para saber por su nombre cuales
// faltan por marcar -- el kit vive detras de un solo punto del diagrama y
// es facil olvidar alguno de sus 9 elementos.
function getItemsPlanos() {
    return inspeccionCatalogo.flatMap((item) => {
        if (item.subItems) {
            return item.subItems.map((subItem) => ({ codigo: subItem.codigo, label: `${item.label}: ${subItem.label}` }));
        }
        return [{ codigo: item.codigo, label: item.label }];
    });
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
            >${HOTSPOT_ICONOS[item.codigo] || ""}</button>
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

// Cada subItem se marca con dos botones explícitos "Tiene"/"No tiene" (en
// vez de un solo botón que ciclaba vacío -> tiene -> no tiene -> vacío):
// un solo click deja el ítem en el estado que se ve en el botón, sin tener
// que adivinar en qué paso del ciclo va. Click sobre el botón ya activo lo
// vuelve a dejar vacío. El estado guardado sigue siendo "bien"/"mal" (mismo
// modelo que el resto del checklist), solo cambia cómo se marca en pantalla.
function renderPanelGrupo(item) {
    inspeccionPanelEl.innerHTML = `
        <h4>${escapeHtml(item.label)}</h4>
        <p class="field-help">Marca si el vehículo tiene o no cada elemento del kit de herramientas y equipo de carretera.</p>
        <div class="inspeccion-checklist-grupo">
            ${item.subItems.map((subItem) => {
                const estado = inspeccionMarcados.get(subItem.codigo)?.estado;
                return `
                    <div class="inspeccion-checklist-row" title="${escapeHtml(subItem.label)}">
                        <span class="inspeccion-checklist-row-label">${escapeHtml(subItem.label)}</span>
                        <div class="inspeccion-checklist-row-actions">
                            <button type="button" class="inspeccion-checklist-pill is-tiene ${estado === "bien" ? "is-active" : ""}" data-codigo="${escapeHtml(subItem.codigo)}" data-valor="bien">
                                <span aria-hidden="true">✓</span> Tiene
                            </button>
                            <button type="button" class="inspeccion-checklist-pill is-notiene ${estado === "mal" ? "is-active" : ""}" data-codigo="${escapeHtml(subItem.codigo)}" data-valor="mal">
                                <span aria-hidden="true">✕</span> No tiene
                            </button>
                        </div>
                    </div>
                `;
            }).join("")}
        </div>
    `;

    inspeccionPanelEl.querySelectorAll(".inspeccion-checklist-pill").forEach((btn) => {
        btn.addEventListener("click", () => {
            const codigo = btn.dataset.codigo;
            const estadoActual = inspeccionMarcados.get(codigo)?.estado;
            const valorBoton = btn.dataset.valor;

            if (estadoActual === valorBoton) {
                inspeccionMarcados.delete(codigo);
            } else {
                inspeccionMarcados.set(codigo, { estado: valorBoton, comentario: "", fotoFile: null, fotoNombre: null });
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
    const totalItems = getTotalItemsCount();
    const faltantes = totalItems - totalMarcados;

    if (!totalMarcados) {
        inspeccionResumenEl.innerHTML = "";
        guardarInspeccionButton.classList.add("hidden");
        return;
    }

    const itemsFaltantes = faltantes ? getItemsPlanos().filter((item) => !inspeccionMarcados.has(item.codigo)) : [];

    inspeccionResumenEl.innerHTML = `
        <span class="pill">${totalMarcados} de ${totalItems} marcados</span>
        ${faltantes ? `<span class="pill pill-warning">${faltantes} sin marcar</span>` : ""}
        ${totalMal ? `<span class="pill pill-danger">${totalMal} en mal estado</span>` : '<span class="pill pill-success">Todo bien</span>'}
        ${itemsFaltantes.length ? `<p class="field-help inspeccion-faltantes-detalle">Falta marcar: ${itemsFaltantes.map((item) => escapeHtml(item.label)).join(", ")}.</p>` : ""}
    `;

    // El boton "Guardar inspeccion" solo aparece cuando ya se marco cada
    // item del catalogo (diagrama + kit de herramientas) -- antes de eso no
    // tiene sentido ofrecer guardar una inspeccion a medio llenar.
    guardarInspeccionButton.classList.toggle("hidden", faltantes > 0);
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

// Antes de guardar, advierte si quedaron items sin revisar o si algo quedo
// marcado en mal estado -- el conductor debe confirmar explicitamente que
// quiere guardar la inspeccion asi, en vez de que quede guardada sin que se
// haya dado cuenta de un faltante o una falla.
async function confirmarAdvertenciaInspeccion() {
    const totalMal = [...inspeccionMarcados.values()].filter((item) => item.estado === "mal").length;
    const faltantes = getTotalItemsCount() - inspeccionMarcados.size;

    if (!totalMal && !faltantes) return true;

    const partes = [];
    if (faltantes) partes.push(`${faltantes} ítem${faltantes === 1 ? "" : "s"} sin marcar`);
    if (totalMal) partes.push(`${totalMal} ítem${totalMal === 1 ? "" : "s"} en mal estado`);

    return window.VehiAmb.ui.confirm({
        title: "Advertencia",
        message: `Hay ${partes.join(" y ")}. ¿Deseas guardar la inspección de todas formas?`,
        confirmText: "Guardar de todas formas"
    });
}

async function guardarInspeccion() {
    if (!inspeccionMarcados.size) return;

    if (!(await confirmarAdvertenciaInspeccion())) return;

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
        document.dispatchEvent(new CustomEvent("inspeccion:guardada"));
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

    if (!window.VehiAmb.auth?.hasPermission?.("inspections.view")) {
        vehicleInspeccionSection.classList.add("hidden");
        return;
    }

    inspeccionPuedeCrear = Boolean(window.VehiAmb.auth?.hasPermission?.("inspections.create"));
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
