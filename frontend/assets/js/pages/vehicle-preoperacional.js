const preopMensaje = document.getElementById("mensaje");
const wizardStepPreoperacionalEl = document.getElementById("wizardStepPreoperacional");
const preopChecklistEl = document.getElementById("preopChecklist");
const preopHistorialList = document.getElementById("preopHistorialList");

let preopVehiculoId = "";
let preopViajeId = "";
let preopCatalogo = [];
let preopRespuestas = new Map();
let preopPuedeCrear = false;
let preopDetalleCache = new Map();
// La firma ya no se captura aqui -- se movio al paso 5 (Finalizar) del
// wizard del conductor, unica para inspeccion y preoperacional. Este flag
// evita disparar "preoperacional:completo" mas de una vez.
let preopCompletoDisparado = false;

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

function renderChecklist() {
    preopChecklistEl.innerHTML = preopCatalogo.map((item) => {
        const marcado = preopRespuestas.get(item.codigo);
        const necesitaObservacion = marcado?.respuesta === "no";
        return `
            <div class="preop-item" data-codigo="${escapeHtml(item.codigo)}">
                <p class="preop-item-label">${escapeHtml(item.label)}</p>
                <div class="inspeccion-checklist-row-actions">
                    <button type="button" class="inspeccion-checklist-pill is-tiene ${marcado?.respuesta === "si" ? "is-active" : ""}" data-valor="si">
                        <span aria-hidden="true">✓</span> Sí
                    </button>
                    <button type="button" class="inspeccion-checklist-pill is-notiene ${marcado?.respuesta === "no" ? "is-active" : ""}" data-valor="no">
                        <span aria-hidden="true">✕</span> No
                    </button>
                </div>
                ${necesitaObservacion ? `
                    <div class="form-group preop-item-observacion">
                        <label>¿Por qué? (obligatorio)</label>
                        <textarea rows="2" data-observacion placeholder="Cuéntanos qué pasó...">${escapeHtml(marcado.observacion || "")}</textarea>
                    </div>
                ` : ""}
            </div>
        `;
    }).join("");

    preopChecklistEl.querySelectorAll(".preop-item").forEach((row) => {
        const codigo = row.dataset.codigo;

        row.querySelectorAll(".inspeccion-checklist-pill").forEach((btn) => {
            btn.addEventListener("click", () => {
                const existente = preopRespuestas.get(codigo);
                preopRespuestas.set(codigo, {
                    respuesta: btn.dataset.valor,
                    observacion: btn.dataset.valor === "no" ? (existente?.observacion || "") : ""
                });
                renderChecklist();
                evaluarCompletitudPreoperacional();
            });
        });

        row.querySelector("[data-observacion]")?.addEventListener("input", (event) => {
            const entrada = preopRespuestas.get(codigo);
            if (entrada) entrada.observacion = event.target.value;
            evaluarCompletitudPreoperacional();
        });
    });
}

// Habilita "Guardar preoperacional" solo cuando las 9 preguntas ya tienen
// respuesta, y cada "No" trae su observacion explicada (igual de exigente
// que la inspeccion preventiva, que tampoco deja guardar a medias).
function checklistCompleto() {
    if (preopRespuestas.size !== preopCatalogo.length) return false;

    for (const [, valor] of preopRespuestas) {
        if (valor.respuesta === "no" && !valor.observacion?.trim()) return false;
    }
    return true;
}

// Una vez las 9 preguntas tienen respuesta (con observacion en cada "No"),
// avanza automaticamente al paso 5 (Finalizar) -- el guardado real (con
// firma) queda diferido a ese paso, ver window.VehiAmb.wizardPreoperacional.
function evaluarCompletitudPreoperacional() {
    if (!preopPuedeCrear || preopCompletoDisparado || !checklistCompleto()) return;

    preopCompletoDisparado = true;
    document.dispatchEvent(new CustomEvent("preoperacional:completo"));
}

// Llamada desde el paso 5 del wizard una vez el conductor firma -- la firma
// ya viene capturada (un solo pad compartido con la inspeccion), asi que
// aqui solo arma el resto del payload y sube.
async function guardarPreoperacionalConFirma(firmaBlob) {
    if (!checklistCompleto()) {
        throw new Error("El checklist del preoperacional no está completo");
    }

    const items = preopCatalogo.map((item) => {
        const valor = preopRespuestas.get(item.codigo);
        return { item_codigo: item.codigo, respuesta: valor.respuesta, observacion: valor.observacion || "" };
    });

    const formData = new FormData();
    formData.append("items", JSON.stringify(items));
    if (preopViajeId) formData.append("viaje_id", preopViajeId);
    formData.append("firma", firmaBlob, "firma.png");

    await window.VehiAmb.api.crearPreoperacional(preopVehiculoId, formData);
}

function renderHistorialDetalle(container, detalle) {
    const items = detalle.items.map((item) => `
        <div class="inspeccion-detalle-item">
            <span class="pill ${item.respuesta === "no" ? "pill-danger" : "pill-success"}">${escapeHtml(item.item_label)}</span>
            ${item.observacion ? `<p class="field-help">${escapeHtml(item.observacion)}</p>` : ""}
        </div>
    `).join("");

    const firma = `<p><strong>Firma:</strong> ${detalle.firma_url ? `<a class="record-link" href="${escapeHtml(window.VehiAmb.api.getAssetUrl(detalle.firma_url))}" target="_blank" rel="noreferrer">Ver firma del conductor</a>` : "Sin firma"}</p>`;

    container.innerHTML = firma + items;
}

function renderHistorial(preoperacionales) {
    if (!preoperacionales.length) {
        preopHistorialList.innerHTML = '<p class="dash-empty">Este vehículo aún no tiene preoperacionales registrados</p>';
        return;
    }

    preopHistorialList.innerHTML = preoperacionales.map((item) => `
        <article class="record-item">
            <div class="record-top">
                <div>
                    <span class="record-title">Preoperacional del ${formatFecha(item.fecha)}</span>
                    <span class="record-sub">${escapeHtml(item.usuario_nombre) || "Usuario no registrado"}</span>
                </div>
                <span class="pill ${item.total_items_no > 0 ? "pill-danger" : "pill-success"}">
                    ${item.total_items_no > 0 ? `${item.total_items_no} en "No"` : "Todo bien"}
                </span>
            </div>
            <button type="button" class="record-link" data-preop-id="${item.id}">Ver detalle</button>
            <div class="inspeccion-detalle hidden" id="preopDetalle-${item.id}"></div>
        </article>
    `).join("");

    preopHistorialList.querySelectorAll("[data-preop-id]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const id = btn.dataset.preopId;
            const container = document.getElementById(`preopDetalle-${id}`);
            if (!container) return;

            const yaVisible = !container.classList.contains("hidden");
            if (yaVisible) {
                container.classList.add("hidden");
                return;
            }

            if (!preopDetalleCache.has(id)) {
                container.innerHTML = '<p class="dash-empty">Cargando...</p>';
                container.classList.remove("hidden");
                try {
                    const detalle = await window.VehiAmb.api.getPreoperacionalDetalle(id);
                    preopDetalleCache.set(id, detalle);
                } catch (error) {
                    container.innerHTML = '<p class="dash-empty">No se pudo cargar el detalle</p>';
                    return;
                }
            }

            renderHistorialDetalle(container, preopDetalleCache.get(id));
            container.classList.remove("hidden");
        });
    });
}

async function cargarHistorial() {
    try {
        const preoperacionales = await window.VehiAmb.api.getPreoperacionalesByVehicle(preopVehiculoId);
        renderHistorial(preoperacionales);
    } catch (error) {
        console.error(error);
        preopHistorialList.innerHTML = '<p class="dash-empty">No se pudo cargar el historial de preoperacionales</p>';
    }
}

async function initPreoperacional() {
    if (!wizardStepPreoperacionalEl) return;

    if (!window.VehiAmb.auth?.hasPermission?.("preoperacional.view")) {
        wizardStepPreoperacionalEl.classList.add("hidden");
        return;
    }

    preopPuedeCrear = Boolean(window.VehiAmb.auth?.hasPermission?.("preoperacional.create"));
    preopVehiculoId = new URLSearchParams(window.location.search).get("id") || "";
    preopViajeId = new URLSearchParams(window.location.search).get("viaje") || "";
    if (!preopVehiculoId) return;

    // Expuesto para que el paso 5 del wizard (vehicle-conductor-wizard.js)
    // pueda saber si ya se puede finalizar y, al firmar, disparar el guardado
    // real con la firma capturada alli.
    window.VehiAmb.wizardPreoperacional = {
        estaCompleta: () => preopPuedeCrear && checklistCompleto(),
        guardar: guardarPreoperacionalConFirma
    };

    try {
        preopCatalogo = await window.VehiAmb.api.getPreoperacionalCatalogo();
        renderChecklist();
    } catch (error) {
        console.error(error);
    }

    await cargarHistorial();
}

document.addEventListener("DOMContentLoaded", initPreoperacional);
