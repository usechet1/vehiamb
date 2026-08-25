const inspeccionMensaje = document.getElementById("mensaje");
const vehicleInspeccionSection = document.getElementById("vehicleInspeccionSection");
const inspeccionHotspotsEl = document.getElementById("inspeccionHotspots");
const inspeccionPanelEl = document.getElementById("inspeccionPanel");
const inspeccionResumenEl = document.getElementById("inspeccionResumen");
const inspeccionProgresoEl = document.getElementById("inspeccionProgreso");
const inspeccionSheetBackdropEl = document.getElementById("inspeccionSheetBackdrop");
const inspeccionSheetEl = document.getElementById("inspeccionSheet");
const inspeccionSheetBodyEl = document.getElementById("inspeccionSheetBody");
const limpiarInspeccionButton = document.getElementById("limpiarInspeccionButton");
const inspeccionHistorialList = document.getElementById("inspeccionHistorialList");

let inspeccionVehiculoId = "";
let inspeccionViajeId = "";
let inspeccionCatalogo = [];
let inspeccionMarcados = new Map();
let inspeccionActivo = null;
let inspeccionPuedeCrear = false;
let inspeccionDetalleCache = new Map();
let inspeccionCierreSheetTimeoutId = null;
// La firma ya no se captura aqui -- se movio al paso 5 (Finalizar) del
// wizard del conductor, unica para inspeccion y preoperacional. Este flag
// evita disparar "inspeccion:completa" mas de una vez mientras el conductor
// sigue tocando items (ej. corrigiendo un comentario) despues de completar.
let inspeccionCompletaDisparada = false;

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

// El panel de marcado vive en una hoja que sube desde abajo (no inline en la
// pagina) para que tocar un punto arriba del diagrama no deje los botones
// Bien/Mal fuera de la pantalla -- en un checklist de 12 puntos esto pasaba
// sistematicamente en movil.
function abrirSheet() {
    if (!inspeccionSheetEl) return;
    // Abrir un punto nuevo cancela cualquier cierre-con-retraso pendiente del
    // punto anterior -- si no, un cierre en camino podia dispararse tarde y
    // cerrar la hoja del punto que se acaba de abrir.
    if (inspeccionCierreSheetTimeoutId) {
        clearTimeout(inspeccionCierreSheetTimeoutId);
        inspeccionCierreSheetTimeoutId = null;
    }
    window.VehiAmb.ui.show(inspeccionSheetBackdropEl);
    window.VehiAmb.ui.show(inspeccionSheetEl);
    inspeccionSheetEl.setAttribute("aria-hidden", "false");
}

function cerrarSheet() {
    if (!inspeccionSheetEl) return;
    if (inspeccionCierreSheetTimeoutId) {
        clearTimeout(inspeccionCierreSheetTimeoutId);
        inspeccionCierreSheetTimeoutId = null;
    }
    window.VehiAmb.ui.hide(inspeccionSheetBackdropEl);
    window.VehiAmb.ui.hide(inspeccionSheetEl);
    inspeccionSheetEl.setAttribute("aria-hidden", "true");
    inspeccionActivo = null;
    renderHotspots();
}

inspeccionSheetBackdropEl?.addEventListener("click", cerrarSheet);
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && inspeccionSheetEl && !inspeccionSheetEl.classList.contains("hidden")) {
        cerrarSheet();
    }
});

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
            abrirSheet();
        });
    });
}

// Cierra la hoja un momento despues de marcar, no de inmediato -- asi el
// usuario alcanza a ver el boton quedar seleccionado antes de que
// desaparezca, en vez de que la hoja se le cierre "de sorpresa".
function cerrarSheetConRetraso() {
    if (inspeccionCierreSheetTimeoutId) clearTimeout(inspeccionCierreSheetTimeoutId);
    inspeccionCierreSheetTimeoutId = setTimeout(cerrarSheet, 260);
}

function renderPanel() {
    if (!inspeccionActivo) {
        inspeccionSheetBodyEl.innerHTML = "";
        return;
    }

    const item = inspeccionCatalogo.find((catalogoItem) => catalogoItem.codigo === inspeccionActivo);
    if (!item) return;

    if (item.subItems) {
        renderPanelGrupo(item);
        return;
    }

    const marcado = inspeccionMarcados.get(item.codigo);

    inspeccionSheetBodyEl.innerHTML = `
        <h3 class="inspeccion-sheet-title">${escapeHtml(item.label)}</h3>
        <div class="inspeccion-sheet-actions">
            <button type="button" class="inspeccion-sheet-btn is-bien ${marcado?.estado === "bien" ? "is-selected" : ""}" data-estado="bien">
                <span class="inspeccion-sheet-btn-icon" aria-hidden="true">✓</span> Bien
            </button>
            <button type="button" class="inspeccion-sheet-btn is-mal ${marcado?.estado === "mal" ? "is-selected" : ""}" data-estado="mal">
                <span class="inspeccion-sheet-btn-icon" aria-hidden="true">✕</span> Mal
            </button>
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
        ` : ""}
    `;

    inspeccionSheetBodyEl.querySelectorAll(".inspeccion-sheet-btn").forEach((btn) => {
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
            cerrarSheetConRetraso();
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
        cerrarSheetConRetraso();
    });
}

// Cada subItem se marca con dos botones explícitos "Tiene"/"No tiene" (en
// vez de un solo botón que ciclaba vacío -> tiene -> no tiene -> vacío):
// un solo click deja el ítem en el estado que se ve en el botón, sin tener
// que adivinar en qué paso del ciclo va. Click sobre el botón ya activo lo
// vuelve a dejar vacío. El estado guardado sigue siendo "bien"/"mal" (mismo
// modelo que el resto del checklist), solo cambia cómo se marca en pantalla.
// A diferencia de un punto suelto, aca hay 9 elementos que marcar en la
// misma visita -- cerrar la hoja en cada toque obligaria a reabrirla 9
// veces, asi que esta se queda abierta hasta que el usuario la cierra con
// el boton "Listo" (o tocando afuera).
function renderPanelGrupo(item) {
    inspeccionSheetBodyEl.innerHTML = `
        <h3 class="inspeccion-sheet-title">${escapeHtml(item.label)}</h3>
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
        <button type="button" class="btn-primary inspeccion-sheet-listo-btn" id="inspeccionSheetListoButton">Listo</button>
    `;

    inspeccionSheetBodyEl.querySelectorAll(".inspeccion-checklist-pill").forEach((btn) => {
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

    document.getElementById("inspeccionSheetListoButton")?.addEventListener("click", cerrarSheet);
}

// Una vez marcados todos los items (sin faltantes), avanza automaticamente
// al paso 4 (Preoperacional) -- el guardado real (con firma) queda diferido
// al paso 5, ver window.VehiAmb.wizardInspeccion.guardar. Si quedo algun
// item en mal estado, se le avisa antes de avanzar (mismo criterio que
// antes tenia el guardado manual), pero ya no se le pregunta por items
// faltantes porque a este punto no puede haber ninguno.
async function evaluarCompletitudInspeccion() {
    if (!inspeccionPuedeCrear || inspeccionCompletaDisparada) return;

    const faltantes = getTotalItemsCount() - inspeccionMarcados.size;
    if (faltantes > 0 || !inspeccionMarcados.size) return;

    if (!(await confirmarAdvertenciaInspeccion())) return;

    inspeccionCompletaDisparada = true;
    document.dispatchEvent(new CustomEvent("inspeccion:completa"));
}

// Fijo arriba de la seccion, visible desde antes de marcar el primer punto
// (a diferencia de #inspeccionResumen, que solo aparece una vez hay algo
// marcado) -- sin esto no hay forma de saber cuanto falta ni de saber que
// ya se termino, y las inspecciones quedaban incompletas sin que nadie se
// diera cuenta.
function renderProgreso() {
    if (!inspeccionProgresoEl) return;

    const totalItems = getTotalItemsCount();
    const totalMarcados = inspeccionMarcados.size;
    const faltantes = totalItems - totalMarcados;
    const pct = totalItems ? Math.round((totalMarcados / totalItems) * 100) : 0;

    inspeccionProgresoEl.innerHTML = `
        <div class="inspeccion-progreso-top">
            <span class="inspeccion-progreso-label">${totalMarcados} de ${totalItems} revisados</span>
            <button type="button" id="inspeccionSiguienteButton" class="btn-secondary" ${faltantes === 0 ? "disabled" : ""}>
                Siguiente sin marcar →
            </button>
        </div>
        <div class="inspeccion-progreso-track">
            <div class="inspeccion-progreso-fill${pct === 100 ? " is-completo" : ""}" style="width:${pct}%"></div>
        </div>
    `;

    document.getElementById("inspeccionSiguienteButton")?.addEventListener("click", irASiguienteSinMarcar);
}

// Primer item del catalogo (o primer sub-item del kit) que todavia no tiene
// marca -- lo activa igual que un click sobre el punto del diagrama y lo
// deja a la vista, para no tener que ir buscando a ojo cual quedo pendiente.
function irASiguienteSinMarcar() {
    const siguiente = inspeccionCatalogo.find((item) => item.subItems
        ? item.subItems.some((subItem) => !inspeccionMarcados.has(subItem.codigo))
        : !inspeccionMarcados.has(item.codigo));
    if (!siguiente) return;

    inspeccionActivo = siguiente.codigo;
    renderHotspots();
    renderPanel();
    document.querySelector(".inspeccion-diagram-wrap")?.scrollIntoView({ behavior: "smooth", block: "center" });
}

function renderResumen() {
    renderProgreso();

    const totalMarcados = inspeccionMarcados.size;
    const totalMal = [...inspeccionMarcados.values()].filter((item) => item.estado === "mal").length;
    const totalItems = getTotalItemsCount();
    const faltantes = totalItems - totalMarcados;

    if (!totalMarcados) {
        inspeccionResumenEl.innerHTML = "";
        return;
    }

    const itemsFaltantes = faltantes ? getItemsPlanos().filter((item) => !inspeccionMarcados.has(item.codigo)) : [];

    inspeccionResumenEl.innerHTML = `
        <span class="pill">${totalMarcados} de ${totalItems} marcados</span>
        ${faltantes ? `<span class="pill pill-warning">${faltantes} sin marcar</span>` : ""}
        ${totalMal ? `<span class="pill pill-danger">${totalMal} en mal estado</span>` : '<span class="pill pill-success">Todo bien</span>'}
        ${itemsFaltantes.length ? `<p class="field-help inspeccion-faltantes-detalle">Falta marcar: ${itemsFaltantes.map((item) => escapeHtml(item.label)).join(", ")}.</p>` : ""}
    `;

    evaluarCompletitudInspeccion();
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
    inspeccionCompletaDisparada = false;
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

// Toma la posicion GPS del dispositivo del conductor en el momento de
// guardar la inspeccion. Si el navegador no soporta geolocalizacion o el
// conductor niega el permiso, se resuelve con null en vez de rechazar: la
// ubicacion es un dato adicional, nunca debe bloquear el guardado del
// checklist.
function obtenerUbicacion() {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            resolve(null);
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    latitud: position.coords.latitude,
                    longitud: position.coords.longitude,
                    precision: position.coords.accuracy
                });
            },
            () => resolve(null),
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
        );
    });
}

// Llamada desde el paso 5 del wizard (vehicle-conductor-wizard.js) una vez
// el conductor firma -- ver window.VehiAmb.wizardInspeccion mas abajo. La
// firma ya viene capturada (un solo pad compartido con el preoperacional),
// asi que aqui solo arma el resto del payload y sube.
async function guardarInspeccionConFirma(firmaBlob) {
    if (!inspeccionMarcados.size) {
        throw new Error("No hay items marcados en la inspección");
    }

    const items = [];
    const formData = new FormData();

    inspeccionMarcados.forEach((data, codigo) => {
        items.push({ item_codigo: codigo, estado: data.estado, comentario: data.comentario || "" });
        if (data.fotoFile) {
            formData.append(`foto_${codigo}`, data.fotoFile);
        }
    });

    formData.append("items", JSON.stringify(items));
    if (inspeccionViajeId) {
        formData.append("viaje_id", inspeccionViajeId);
    }

    const ubicacion = await obtenerUbicacion();
    if (ubicacion) {
        formData.append("latitud", ubicacion.latitud);
        formData.append("longitud", ubicacion.longitud);
        formData.append("ubicacion_precision", ubicacion.precision);
    }
    formData.append("firma", firmaBlob, "firma.png");

    await window.VehiAmb.api.crearInspeccion(inspeccionVehiculoId, formData);
}

function renderHistorialDetalle(container, detalle) {
    const cabecera = `
        <div class="inspeccion-detalle-cabecera">
            <p><strong>Conductor:</strong> ${escapeHtml(detalle.usuario_nombre) || "Usuario no registrado"}</p>
            <p><strong>Punto de partida:</strong> ${
                detalle.latitud != null && detalle.longitud != null
                    ? `<a class="record-link" href="https://www.google.com/maps?q=${detalle.latitud},${detalle.longitud}" target="_blank" rel="noreferrer">📍 Ver en el mapa</a>`
                    : "Sin ubicación registrada"
            }</p>
            <p><strong>Punto de llegada:</strong> ${detalle.destino ? escapeHtml(detalle.destino) : "Sin viaje asociado"}</p>
            <p><strong>Firma:</strong> ${detalle.firma_url ? `<a class="record-link" href="${escapeHtml(window.VehiAmb.api.getAssetUrl(detalle.firma_url))}" target="_blank" rel="noreferrer">Ver firma del conductor</a>` : "Sin firma"}</p>
        </div>
    `;

    const items = detalle.items.map((item) => `
        <div class="inspeccion-detalle-item">
            <span class="pill ${item.estado === "mal" ? "pill-danger" : "pill-success"}">${escapeHtml(item.item_label)}</span>
            ${item.comentario ? `<p class="field-help">${escapeHtml(item.comentario)}</p>` : ""}
            ${item.foto_url ? `<a class="record-link" href="${escapeHtml(window.VehiAmb.api.getAssetUrl(item.foto_url))}" target="_blank" rel="noreferrer">Ver foto</a>` : ""}
        </div>
    `).join("");

    container.innerHTML = cabecera + items;
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
            ${item.latitud != null && item.longitud != null ? `<a class="record-link" href="https://www.google.com/maps?q=${item.latitud},${item.longitud}" target="_blank" rel="noreferrer">📍 Ver ubicación</a>` : ""}
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

    // "inspections.create" tambien la tienen Administrador/Operador (pueden
    // registrar inspecciones manualmente si hiciera falta), pero el diagrama
    // interactivo (el "carrito") es parte del wizard del Conductor -- en la
    // ficha normal del vehiculo el resto de roles solo debe ver el
    // historial, no el checklist para marcar.
    const user = await window.VehiAmb.auth.fetchCurrentUser();
    const esConductor = user?.rol === "Conductor";

    inspeccionPuedeCrear = esConductor && Boolean(window.VehiAmb.auth?.hasPermission?.("inspections.create"));
    inspeccionVehiculoId = new URLSearchParams(window.location.search).get("id") || "";
    inspeccionViajeId = new URLSearchParams(window.location.search).get("viaje") || "";
    if (!inspeccionVehiculoId) return;

    // El marcado ahora vive en la hoja (#inspeccionSheet), no en este panel
    // inline -- se deja oculto para todos los roles.
    inspeccionPanelEl?.classList.add("hidden");

    if (!esConductor) {
        document.querySelector(".inspeccion-diagram-wrap")?.classList.add("hidden");
        document.querySelector(".inspeccion-diagram-legend")?.classList.add("hidden");
        inspeccionResumenEl.classList.add("hidden");
        inspeccionProgresoEl?.classList.add("hidden");
        limpiarInspeccionButton.classList.add("hidden");

        const descripcionEl = document.getElementById("inspeccionSectionDescripcion");
        if (descripcionEl) descripcionEl.textContent = "Historial de inspecciones preventivas registradas para este vehículo.";

        // Sin el diagrama, el historial es el unico contenido de la seccion --
        // que se vea desplegado de una vez, sin un clic extra para abrirlo.
        document.querySelector(".inspeccion-historial")?.setAttribute("open", "");
    }

    limpiarInspeccionButton.addEventListener("click", () => resetInspeccion({ confirmar: true }));

    // Expuesto para que el paso 5 del wizard (vehicle-conductor-wizard.js)
    // pueda saber si ya se puede finalizar y, al firmar, disparar el guardado
    // real con la firma capturada alli.
    window.VehiAmb.wizardInspeccion = {
        estaCompleta: () => inspeccionPuedeCrear && inspeccionMarcados.size > 0 && getTotalItemsCount() - inspeccionMarcados.size === 0,
        guardar: guardarInspeccionConFirma
    };

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
