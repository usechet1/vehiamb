const entregaMensaje = document.getElementById("mensaje");
const entregaFormSection = document.getElementById("entregaFormSection");
const entregaFormTitle = document.getElementById("entregaFormTitle");
const entregaVehiculoSelect = document.getElementById("entregaVehiculoSelect");
const entregaHotspotsEl = document.getElementById("entregaHotspots");
const entregaPanelEl = document.getElementById("entregaPanel");
const entregaResumenEl = document.getElementById("entregaResumen");
const entregaMotivoSelect = document.getElementById("entregaMotivo");
const entregaKilometrajeInput = document.getElementById("entregaKilometraje");
const entregaKilometrajeHelp = document.getElementById("entregaKilometrajeHelp");
const entregaConductorEntregaSelect = document.getElementById("entregaConductorEntrega");
const entregaConductorRecibeSelect = document.getElementById("entregaConductorRecibe");
const entregaObservacionesInput = document.getElementById("entregaObservaciones");
const guardarEntregaButton = document.getElementById("guardarEntregaButton");
const limpiarEntregaButton = document.getElementById("limpiarEntregaButton");
const entregaHistorialList = document.getElementById("entregaHistorialList");
const entregaDrawer = document.getElementById("entregaDrawer");
const entregaDrawerBackdrop = document.getElementById("entregaDrawerBackdrop");
const entregaDrawerTitle = document.getElementById("entregaDrawerTitle");
const entregaDrawerSubtitle = document.getElementById("entregaDrawerSubtitle");
const entregaDrawerBody = document.getElementById("entregaDrawerBody");
const closeEntregaDrawer = document.getElementById("closeEntregaDrawer");
const exportEntregaDrawerButton = document.getElementById("exportEntregaDrawerButton");

let entregaVehiculoId = "";
let entregaVehiculoActual = null;
let entregaDrawerEntregaId = null;
let entregaKilometrajeActual = 0;
let entregaCatalogo = [];
let entregaMarcados = new Map();
let entregaActivo = null;
let entregaPuedeCrear = false;
let entregaDetalleCache = new Map();

const MOTIVO_LABEL = {
    cambio_conductor: "Cambio de conductor",
    vacaciones: "Vacaciones",
    retiro: "Retiro definitivo",
    otro: "Otro"
};

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

// El kilometraje del acta nunca puede ser menor al ultimo registrado en el
// vehiculo (mismo criterio que mantenimientos.js: el odometro no retrocede).
// Se valida en vivo mientras el usuario digita, ademas de en el submit.
function updateKilometrajeValidation() {
    entregaKilometrajeInput.setCustomValidity("");
    entregaKilometrajeHelp.textContent = `Kilometraje actual registrado: ${entregaKilometrajeActual.toLocaleString("es-CO")} km. El nuevo valor no puede ser menor.`;

    const value = window.VehiAmb.ui.parseFormattedNumber(entregaKilometrajeInput.value);
    if (value !== "" && Number(value) < entregaKilometrajeActual) {
        entregaKilometrajeInput.setCustomValidity(`El kilometraje debe ser mayor o igual a ${entregaKilometrajeActual.toLocaleString("es-CO")} km.`);
    }
}

function getEstadoClaseGrupo(item) {
    const estados = item.subItems.map((subItem) => entregaMarcados.get(subItem.codigo)?.estado);
    const totalMarcados = estados.filter(Boolean).length;
    if (!totalMarcados) return "";
    if (estados.includes("mal")) return "is-mal";
    if (totalMarcados === item.subItems.length) return "is-bien";
    return "is-parcial";
}

const ENTREGA_HOTSPOT_ICONOS = {
    capo: "🚗",
    techo: "⬜",
    baul: "📦",
    parabrisas_delantero: "🪟",
    parabrisas_trasero: "🪟",
    puerta_di: "🚪",
    puerta_dd: "🚪",
    puerta_ti: "🚪",
    puerta_td: "🚪",
    espejo_izquierdo: "🔍",
    espejo_derecho: "🔍",
    faro_di: "💡",
    faro_dd: "💡",
    luz_ti: "🔴",
    luz_td: "🔴",
    llanta_di: "🛞",
    llanta_dd: "🛞",
    llanta_ti: "🛞",
    llanta_td: "🛞",
    llanta_repuesto: "🛞",
    elementos_seguridad: "🧰"
};

function getTotalItemsCount() {
    return entregaCatalogo.reduce((total, item) => total + (item.subItems ? item.subItems.length : 1), 0);
}

function getItemsPlanos() {
    return entregaCatalogo.flatMap((item) => {
        if (item.subItems) {
            return item.subItems.map((subItem) => ({ codigo: subItem.codigo, label: `${item.label}: ${subItem.label}` }));
        }
        return [{ codigo: item.codigo, label: item.label }];
    });
}

function renderHotspots() {
    entregaHotspotsEl.innerHTML = entregaCatalogo.map((item) => {
        const estadoClase = item.subItems
            ? getEstadoClaseGrupo(item)
            : (entregaMarcados.get(item.codigo) ? `is-${entregaMarcados.get(item.codigo).estado}` : "");
        return `
            <button
                type="button"
                class="inspeccion-hotspot ${estadoClase} ${item.codigo === entregaActivo ? "is-active" : ""}"
                style="left:${item.x}%; top:${item.y}%;"
                data-codigo="${escapeHtml(item.codigo)}"
                title="${escapeHtml(item.label)}"
                aria-label="${escapeHtml(item.label)}"
            >${ENTREGA_HOTSPOT_ICONOS[item.codigo] || ""}</button>
        `;
    }).join("");

    entregaHotspotsEl.querySelectorAll(".inspeccion-hotspot").forEach((el) => {
        el.addEventListener("click", () => {
            entregaActivo = el.dataset.codigo;
            renderHotspots();
            renderPanel();
        });
    });
}

function renderPanel() {
    if (!entregaActivo) {
        entregaPanelEl.innerHTML = '<p class="dash-empty">Selecciona un punto del diagrama para marcar su estado.</p>';
        return;
    }

    const item = entregaCatalogo.find((catalogoItem) => catalogoItem.codigo === entregaActivo);
    if (!item) return;

    if (item.subItems) {
        renderPanelGrupo(item);
        return;
    }

    const marcado = entregaMarcados.get(item.codigo);

    entregaPanelEl.innerHTML = `
        <h4>${escapeHtml(item.label)}</h4>
        <div class="inspeccion-panel-actions">
            <button type="button" class="btn-secondary inspeccion-estado-btn ${marcado?.estado === "bien" ? "is-selected-bien" : ""}" data-estado="bien">Sin novedad</button>
            <button type="button" class="btn-secondary inspeccion-estado-btn ${marcado?.estado === "mal" ? "is-selected-mal" : ""}" data-estado="mal">Con novedad</button>
        </div>
        ${marcado ? `
            <div class="form-group">
                <label>Comentario (rayón, golpe, faltante, etc.)</label>
                <textarea id="entregaComentarioInput" rows="2" placeholder="Detalle de la novedad...">${escapeHtml(marcado.comentario || "")}</textarea>
            </div>
            <div class="form-group">
                <label>Foto (opcional)</label>
                <input type="file" id="entregaFotoInput" accept="image/png,image/jpeg,image/webp">
                ${marcado.fotoNombre ? `<span class="field-help">Archivo: ${escapeHtml(marcado.fotoNombre)}</span>` : ""}
            </div>
            <button type="button" class="record-link" id="entregaQuitarButton">Quitar marca</button>
        ` : '<p class="field-help">Marca "Sin novedad" o "Con novedad" para registrar este ítem.</p>'}
    `;

    entregaPanelEl.querySelectorAll(".inspeccion-estado-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            const existente = entregaMarcados.get(item.codigo);
            entregaMarcados.set(item.codigo, {
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

    const comentarioInput = document.getElementById("entregaComentarioInput");
    comentarioInput?.addEventListener("input", () => {
        const entrada = entregaMarcados.get(item.codigo);
        if (entrada) entrada.comentario = comentarioInput.value;
    });

    const fotoInput = document.getElementById("entregaFotoInput");
    fotoInput?.addEventListener("change", () => {
        const entrada = entregaMarcados.get(item.codigo);
        if (!entrada) return;
        const file = fotoInput.files?.[0] || null;
        entrada.fotoFile = file;
        entrada.fotoNombre = file?.name || null;
        renderPanel();
    });

    document.getElementById("entregaQuitarButton")?.addEventListener("click", () => {
        entregaMarcados.delete(item.codigo);
        renderHotspots();
        renderPanel();
        renderResumen();
    });
}

function renderPanelGrupo(item) {
    entregaPanelEl.innerHTML = `
        <h4>${escapeHtml(item.label)}</h4>
        <p class="field-help">Marca si cada elemento está presente y en buen estado, o si tiene alguna novedad.</p>
        <div class="inspeccion-checklist-grupo">
            ${item.subItems.map((subItem) => {
                const estado = entregaMarcados.get(subItem.codigo)?.estado;
                return `
                    <div class="inspeccion-checklist-row" title="${escapeHtml(subItem.label)}">
                        <span class="inspeccion-checklist-row-label">${escapeHtml(subItem.label)}</span>
                        <div class="inspeccion-checklist-row-actions">
                            <button type="button" class="inspeccion-checklist-pill is-tiene ${estado === "bien" ? "is-active" : ""}" data-codigo="${escapeHtml(subItem.codigo)}" data-valor="bien">
                                <span aria-hidden="true">✓</span> Bien
                            </button>
                            <button type="button" class="inspeccion-checklist-pill is-notiene ${estado === "mal" ? "is-active" : ""}" data-codigo="${escapeHtml(subItem.codigo)}" data-valor="mal">
                                <span aria-hidden="true">✕</span> Novedad
                            </button>
                        </div>
                    </div>
                `;
            }).join("")}
        </div>
    `;

    entregaPanelEl.querySelectorAll(".inspeccion-checklist-pill").forEach((btn) => {
        btn.addEventListener("click", () => {
            const codigo = btn.dataset.codigo;
            const estadoActual = entregaMarcados.get(codigo)?.estado;
            const valorBoton = btn.dataset.valor;

            if (estadoActual === valorBoton) {
                entregaMarcados.delete(codigo);
            } else {
                entregaMarcados.set(codigo, { estado: valorBoton, comentario: "", fotoFile: null, fotoNombre: null });
            }
            renderHotspots();
            renderPanel();
            renderResumen();
        });
    });
}

function renderResumen() {
    const totalMarcados = entregaMarcados.size;
    const totalMal = [...entregaMarcados.values()].filter((item) => item.estado === "mal").length;
    const totalItems = getTotalItemsCount();
    const faltantes = totalItems - totalMarcados;

    if (!totalMarcados) {
        entregaResumenEl.innerHTML = "";
        guardarEntregaButton.classList.add("hidden");
        return;
    }

    const itemsFaltantes = faltantes ? getItemsPlanos().filter((item) => !entregaMarcados.has(item.codigo)) : [];

    entregaResumenEl.innerHTML = `
        <span class="pill">${totalMarcados} de ${totalItems} marcados</span>
        ${faltantes ? `<span class="pill pill-warning">${faltantes} sin marcar</span>` : ""}
        ${totalMal ? `<span class="pill pill-danger">${totalMal} con novedad</span>` : '<span class="pill pill-success">Sin novedades</span>'}
        ${itemsFaltantes.length ? `<p class="field-help inspeccion-faltantes-detalle">Falta marcar: ${itemsFaltantes.map((item) => escapeHtml(item.label)).join(", ")}.</p>` : ""}
    `;

    guardarEntregaButton.classList.toggle("hidden", faltantes > 0);
    guardarEntregaButton.disabled = !entregaPuedeCrear;
}

// ── Firma digital (canvas) ──────────────────────────────────────────────
function crearFirmaPad(canvas) {
    const ctx = canvas.getContext("2d");
    let dibujando = false;
    let tieneTrazo = false;
    let bloqueada = false;

    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#20242c";

    function posicion(event) {
        const rect = canvas.getBoundingClientRect();
        const escalaX = canvas.width / rect.width;
        const escalaY = canvas.height / rect.height;
        return {
            x: (event.clientX - rect.left) * escalaX,
            y: (event.clientY - rect.top) * escalaY
        };
    }

    function iniciar(event) {
        if (bloqueada) return;
        dibujando = true;
        tieneTrazo = true;
        // Captura el puntero en el canvas: el trazo sigue recibiendo
        // pointermove/pointerup aunque el cursor salga del rectangulo del
        // canvas a mitad de la firma (muy comun al firmar rapido cerca del
        // borde), en vez de cortarse ahi como pasaba solo con pointerleave.
        canvas.setPointerCapture?.(event.pointerId);
        const { x, y } = posicion(event);
        ctx.beginPath();
        ctx.moveTo(x, y);
        event.preventDefault();
    }

    function mover(event) {
        if (!dibujando) return;
        const { x, y } = posicion(event);
        ctx.lineTo(x, y);
        ctx.stroke();
        event.preventDefault();
    }

    function terminar(event) {
        dibujando = false;
        if (event?.pointerId !== undefined) {
            canvas.releasePointerCapture?.(event.pointerId);
        }
    }

    canvas.addEventListener("pointerdown", iniciar);
    canvas.addEventListener("pointermove", mover);
    canvas.addEventListener("pointerup", terminar);
    canvas.addEventListener("pointercancel", terminar);

    return {
        limpiar() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            tieneTrazo = false;
            bloqueada = false;
            canvas.classList.remove("entrega-firma-guardada");
        },
        estaVacia() {
            return !tieneTrazo;
        },
        estaBloqueada() {
            return bloqueada;
        },
        // "Guardar firma" congela el trazo (ya no se puede seguir dibujando
        // encima por accidente) hasta que se use "Limpiar firma", que
        // desbloquea de nuevo. El guardado real del acta sigue ocurriendo
        // al enviar el formulario completo (aBlob se llama ahi).
        bloquear() {
            bloqueada = true;
            canvas.classList.add("entrega-firma-guardada");
        },
        aBlob() {
            return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
        }
    };
}

let firmaEntregaPad = null;
let firmaRecibePad = null;

async function resetEntrega({ confirmar = false } = {}) {
    if (confirmar && (entregaMarcados.size || !firmaEntregaPad?.estaVacia() || !firmaRecibePad?.estaVacia())) {
        const confirmado = await window.VehiAmb.ui.confirm({
            title: "Limpiar acta",
            message: "Se perderán las marcas, observaciones y firmas que no hayas guardado. ¿Continuar?",
            confirmText: "Limpiar"
        });
        if (!confirmado) return;
    }

    entregaMarcados = new Map();
    entregaActivo = null;
    entregaMotivoSelect.value = "cambio_conductor";
    entregaKilometrajeInput.value = "";
    updateKilometrajeValidation();
    entregaConductorEntregaSelect.value = "";
    entregaConductorRecibeSelect.value = "";
    entregaObservacionesInput.value = "";
    firmaEntregaPad?.limpiar();
    firmaRecibePad?.limpiar();
    renderHotspots();
    renderPanel();
    renderResumen();
}

async function confirmarAdvertenciaEntrega() {
    const totalMal = [...entregaMarcados.values()].filter((item) => item.estado === "mal").length;
    if (!totalMal) return true;

    return window.VehiAmb.ui.confirm({
        title: "Novedades registradas",
        message: `Hay ${totalMal} ítem${totalMal === 1 ? "" : "s"} con novedad. ¿Deseas guardar el acta de todas formas?`,
        confirmText: "Guardar de todas formas"
    });
}

async function guardarEntrega() {
    if (!entregaVehiculoId || !entregaMarcados.size) return;

    updateKilometrajeValidation();
    if (!entregaKilometrajeInput.checkValidity()) {
        entregaKilometrajeInput.focus();
        entregaKilometrajeInput.scrollIntoView({ behavior: "smooth", block: "center" });
        window.VehiAmb.ui.showMessage(entregaMensaje, entregaKilometrajeInput.validationMessage, "error");
        return;
    }

    if (!entregaConductorEntregaSelect.value || !entregaConductorRecibeSelect.value) {
        window.VehiAmb.ui.showMessage(entregaMensaje, "Selecciona quién entrega y quién recibe el vehículo", "error");
        return;
    }

    if (entregaConductorEntregaSelect.value === entregaConductorRecibeSelect.value) {
        window.VehiAmb.ui.showMessage(entregaMensaje, "Quien entrega y quien recibe no pueden ser la misma persona", "error");
        return;
    }

    if (firmaEntregaPad?.estaVacia() || firmaRecibePad?.estaVacia()) {
        window.VehiAmb.ui.showMessage(entregaMensaje, "Se requiere la firma de quien entrega y de quien recibe", "error");
        return;
    }

    if (!(await confirmarAdvertenciaEntrega())) return;

    const items = [];
    const formData = new FormData();

    entregaMarcados.forEach((data, codigo) => {
        items.push({ item_codigo: codigo, estado: data.estado, comentario: data.comentario || "" });
        if (data.fotoFile) {
            formData.append(`foto_${codigo}`, data.fotoFile);
        }
    });

    formData.append("items", JSON.stringify(items));
    formData.append("motivo", entregaMotivoSelect.value);
    formData.append("usuario_entrega_id", entregaConductorEntregaSelect.value);
    formData.append("usuario_recibe_id", entregaConductorRecibeSelect.value);
    const kilometrajeValue = window.VehiAmb.ui.parseFormattedNumber(entregaKilometrajeInput.value);
    if (kilometrajeValue !== "") formData.append("kilometraje", kilometrajeValue);
    formData.append("observaciones", entregaObservacionesInput.value.trim());

    try {
        guardarEntregaButton.disabled = true;
        window.VehiAmb.ui.showMessage(entregaMensaje, "Guardando acta...");

        const [firmaEntregaBlob, firmaRecibeBlob] = await Promise.all([firmaEntregaPad.aBlob(), firmaRecibePad.aBlob()]);
        formData.append("firma_entrega", firmaEntregaBlob, "firma_entrega.png");
        formData.append("firma_recibe", firmaRecibeBlob, "firma_recibe.png");

        await window.VehiAmb.api.crearEntregaRecibida(entregaVehiculoId, formData);
        window.VehiAmb.ui.showMessage(entregaMensaje, "Acta de vehículo guardada correctamente");
        await resetEntrega();
        await cargarHistorial();
    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(entregaMensaje, error.message || "No se pudo guardar el acta", "error");
    } finally {
        guardarEntregaButton.disabled = !entregaPuedeCrear;
    }
}

function detailRow(label, value) {
    return `
        <div>
            <dt>${escapeHtml(label)}</dt>
            <dd>${escapeHtml(value || "--")}</dd>
        </div>
    `;
}

function renderEntregaDrawerBody(detalle) {
    const items = detalle.items.map((item) => `
        <div class="inspeccion-detalle-item">
            <span class="pill ${item.estado === "mal" ? "pill-danger" : "pill-success"}">${escapeHtml(item.item_label)}</span>
            ${item.comentario ? `<p class="field-help">${escapeHtml(item.comentario)}</p>` : ""}
            ${item.foto_url ? `<a class="record-link" href="${escapeHtml(window.VehiAmb.api.getAssetUrl(item.foto_url))}" target="_blank" rel="noreferrer">Ver foto</a>` : ""}
        </div>
    `).join("");

    return `
        <dl class="detail-list drawer-detail-list">
            ${detailRow("Motivo", MOTIVO_LABEL[detalle.motivo] || detalle.motivo)}
            ${detailRow("Entrega", detalle.usuario_entrega?.nombre || "Sin registrar")}
            ${detailRow("Recibe", detalle.usuario_recibe?.nombre || "Sin registrar")}
            ${detailRow("Kilometraje", detalle.kilometraje != null ? `${Number(detalle.kilometraje).toLocaleString("es-CO")} km` : "No registrado")}
            ${detailRow("Registrado por", detalle.usuario_nombre)}
            ${detailRow("Fecha", formatFecha(detalle.fecha))}
        </dl>

        ${detalle.observaciones ? `
            <section class="drawer-section">
                <h3>Observaciones</h3>
                <p>${escapeHtml(detalle.observaciones)}</p>
            </section>
        ` : ""}

        <section class="drawer-section">
            <h3>Firmas</h3>
            <p>
                ${detalle.firma_entrega_url ? `<a class="record-link" href="${escapeHtml(window.VehiAmb.api.getAssetUrl(detalle.firma_entrega_url))}" target="_blank" rel="noreferrer">Ver firma de quien entrega</a>` : "Sin firma de quien entrega"}
                ${detalle.firma_recibe_url ? ` · <a class="record-link" href="${escapeHtml(window.VehiAmb.api.getAssetUrl(detalle.firma_recibe_url))}" target="_blank" rel="noreferrer">Ver firma de quien recibe</a>` : ""}
            </p>
        </section>

        <section class="drawer-section">
            <h3>Checklist del vehículo</h3>
            ${items}
        </section>
    `;
}

async function obtenerDetalleEntrega(id) {
    if (!entregaDetalleCache.has(id)) {
        const detalle = await window.VehiAmb.api.getEntregaDetalle(id);
        entregaDetalleCache.set(id, detalle);
    }
    return entregaDetalleCache.get(id);
}

function closeEntregaDetalle() {
    window.VehiAmb.ui.hide(entregaDrawerBackdrop);
    window.VehiAmb.ui.hide(entregaDrawer);
    entregaDrawer.setAttribute("aria-hidden", "true");
    entregaDrawerEntregaId = null;
}

async function openEntregaDetalle(item) {
    entregaDrawerEntregaId = item.id;
    entregaDrawerTitle.textContent = `Acta del ${formatFecha(item.fecha)}`;
    entregaDrawerSubtitle.textContent = `${MOTIVO_LABEL[item.motivo] || item.motivo} · ${item.usuario_entrega?.nombre || "?"} → ${item.usuario_recibe?.nombre || "?"}`;
    entregaDrawerBody.innerHTML = '<p class="dash-empty">Cargando...</p>';

    window.VehiAmb.ui.show(entregaDrawerBackdrop);
    window.VehiAmb.ui.show(entregaDrawer);
    entregaDrawer.setAttribute("aria-hidden", "false");
    closeEntregaDrawer.focus();

    try {
        const detalle = await obtenerDetalleEntrega(item.id);
        entregaDrawerBody.innerHTML = renderEntregaDrawerBody(detalle);
    } catch (error) {
        entregaDrawerBody.innerHTML = '<p class="dash-empty">No se pudo cargar el detalle</p>';
    }
}

closeEntregaDrawer.addEventListener("click", closeEntregaDetalle);
entregaDrawerBackdrop.addEventListener("click", closeEntregaDetalle);
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !entregaDrawer.classList.contains("hidden")) {
        closeEntregaDetalle();
    }
});

async function exportarActaEntrega(id, btn) {
    btn.disabled = true;
    try {
        const detalle = await obtenerDetalleEntrega(id);
        await window.VehiAmb.entregaExport.exportEntregaPdf({ vehiculo: entregaVehiculoActual, entrega: detalle });
    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(entregaMensaje, error.message || "No se pudo exportar el acta", "error");
    } finally {
        btn.disabled = false;
    }
}

exportEntregaDrawerButton.addEventListener("click", () => {
    if (!entregaDrawerEntregaId) return;
    exportarActaEntrega(entregaDrawerEntregaId, exportEntregaDrawerButton);
});

function renderHistorial(entregas) {
    if (!entregas.length) {
        entregaHistorialList.innerHTML = '<p class="dash-empty">Este vehículo aún no tiene actas de vehículo registradas</p>';
        return;
    }

    entregaHistorialList.innerHTML = entregas.map((item) => `
        <article class="record-item">
            <div class="record-top">
                <div>
                    <span class="record-title">Acta del ${formatFecha(item.fecha)} · ${escapeHtml(MOTIVO_LABEL[item.motivo] || item.motivo)}</span>
                    <span class="record-sub">${escapeHtml(item.usuario_entrega?.nombre) || "?"} → ${escapeHtml(item.usuario_recibe?.nombre) || "?"}</span>
                </div>
                <span class="pill ${item.total_items_mal > 0 ? "pill-danger" : "pill-success"}">
                    ${item.total_items_mal > 0 ? `${item.total_items_mal} con novedad` : "Sin novedades"}
                </span>
            </div>
            <div class="record-meta">
                <span class="pill">${item.total_items} ítems revisados</span>
                ${item.kilometraje != null ? `<span class="pill">${Number(item.kilometraje).toLocaleString("es-CO")} km</span>` : ""}
            </div>
            <div class="record-actions">
                <button type="button" class="btn-secondary" data-entrega-id="${item.id}">Ver detalle</button>
                <button type="button" class="btn-secondary" data-exportar-entrega-id="${item.id}">Exportar PDF</button>
            </div>
        </article>
    `).join("");

    entregaHistorialList.querySelectorAll("[data-entrega-id]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const id = btn.dataset.entregaId;
            const item = entregas.find((entrega) => String(entrega.id) === String(id));
            if (item) openEntregaDetalle(item);
        });
    });

    entregaHistorialList.querySelectorAll("[data-exportar-entrega-id]").forEach((btn) => {
        btn.addEventListener("click", () => {
            exportarActaEntrega(btn.dataset.exportarEntregaId, btn);
        });
    });
}

async function cargarHistorial() {
    try {
        const entregas = await window.VehiAmb.api.getEntregasByVehicle(entregaVehiculoId);
        renderHistorial(entregas);
    } catch (error) {
        console.error(error);
        entregaHistorialList.innerHTML = '<p class="dash-empty">No se pudo cargar el historial de actas</p>';
    }
}

function renderConductorOptions(select, usuarios) {
    const seleccionActual = select.value;
    select.innerHTML = '<option value="">Selecciona...</option>' + usuarios.map((usuario) => `
        <option value="${usuario.id}">${escapeHtml(usuario.nombre)}${usuario.email ? ` (${escapeHtml(usuario.email)})` : ""}</option>
    `).join("");
    select.value = seleccionActual;
}

let conductoresCargados = false;

async function cargarConductores() {
    if (conductoresCargados) return;

    try {
        const usuarios = await window.VehiAmb.api.getEntregaUsuariosDisponibles();
        renderConductorOptions(entregaConductorEntregaSelect, usuarios);
        renderConductorOptions(entregaConductorRecibeSelect, usuarios);
        conductoresCargados = true;
    } catch (error) {
        console.error(error);
    }
}

let entregaVehiculosCatalogo = [];

function renderVehiculoOptions(vehiculos) {
    entregaVehiculosCatalogo = vehiculos;
    entregaVehiculoSelect.innerHTML = '<option value="">Selecciona un vehículo...</option>' + vehiculos.map((vehiculo) => `
        <option value="${vehiculo.id}">${escapeHtml(vehiculo.placa)} · ${escapeHtml(vehiculo.marca)} ${escapeHtml(vehiculo.modelo)}</option>
    `).join("");
}

// Cambiar de vehiculo reinicia por completo el checklist/firmas: son actas
// independientes, no tiene sentido arrastrar marcas de un vehiculo a otro.
async function onVehiculoSeleccionado() {
    entregaVehiculoId = entregaVehiculoSelect.value;
    entregaVehiculoActual = entregaVehiculosCatalogo.find((vehiculo) => String(vehiculo.id) === entregaVehiculoId) || null;

    if (!entregaVehiculoId) {
        entregaFormSection.classList.add("hidden");
        return;
    }

    entregaFormSection.classList.remove("hidden");
    entregaFormTitle.textContent = `Acta de vehículo — ${entregaVehiculoSelect.selectedOptions[0].textContent}`;
    entregaKilometrajeActual = Number(entregaVehiculoActual?.kilometraje_actual || 0);

    await resetEntrega();
    updateKilometrajeValidation();
    await cargarConductores();
    await cargarHistorial();

    entregaFormSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function initEntrega() {
    if (!entregaFormSection) return;

    if (!window.VehiAmb.auth?.hasPermission?.("delivery.view")) {
        document.querySelector(".page-header").insertAdjacentHTML(
            "afterend",
            '<p class="dash-empty">No tienes permiso para ver esta sección.</p>'
        );
        document.querySelectorAll(".section-card").forEach((el) => el.classList.add("hidden"));
        return;
    }

    entregaPuedeCrear = Boolean(window.VehiAmb.auth?.hasPermission?.("delivery.create"));

    firmaEntregaPad = crearFirmaPad(document.getElementById("entregaFirmaEntregaCanvas"));
    firmaRecibePad = crearFirmaPad(document.getElementById("entregaFirmaRecibeCanvas"));

    document.querySelectorAll("[data-limpiar-firma]").forEach((btn) => {
        btn.addEventListener("click", () => {
            (btn.dataset.limpiarFirma === "entrega" ? firmaEntregaPad : firmaRecibePad)?.limpiar();
        });
    });

    document.querySelectorAll("[data-guardar-firma]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const pad = btn.dataset.guardarFirma === "entrega" ? firmaEntregaPad : firmaRecibePad;
            if (!pad || pad.estaVacia()) {
                window.VehiAmb.ui.showMessage(entregaMensaje, "Primero dibuja la firma antes de guardarla", "error");
                return;
            }
            pad.bloquear();
            window.VehiAmb.ui.showMessage(entregaMensaje, "Firma guardada");
        });
    });

    if (!entregaPuedeCrear) {
        document.querySelector("#entregaFormSection .inspeccion-diagram-wrap")?.classList.add("hidden");
        entregaPanelEl.classList.add("hidden");
        entregaResumenEl.classList.add("hidden");
        guardarEntregaButton.classList.add("hidden");
        limpiarEntregaButton.classList.add("hidden");
        document.querySelectorAll("#entregaFormSection .entrega-firmas-grid, #entregaFormSection .form-grid-4, #entregaFormSection textarea").forEach((el) => el.classList.add("hidden"));
    }

    guardarEntregaButton.addEventListener("click", guardarEntrega);
    limpiarEntregaButton.addEventListener("click", () => resetEntrega({ confirmar: true }));
    entregaKilometrajeInput.addEventListener("input", () => {
        window.VehiAmb.ui.formatearNumeroEnVivo(entregaKilometrajeInput);
        updateKilometrajeValidation();
    });
    entregaVehiculoSelect.addEventListener("change", onVehiculoSeleccionado);

    try {
        entregaCatalogo = await window.VehiAmb.api.getEntregaChecklistCatalogo();
    } catch (error) {
        console.error(error);
    }

    try {
        const vehiculos = await window.VehiAmb.api.getVehiculosCatalogo();
        renderVehiculoOptions(vehiculos);
    } catch (error) {
        console.error(error);
        entregaVehiculoSelect.innerHTML = '<option value="">No se pudieron cargar los vehículos</option>';
    }
}

document.addEventListener("DOMContentLoaded", initEntrega);
