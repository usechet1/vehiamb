const controlViajeEmpty = document.getElementById("controlViajeEmpty");
const controlViajeContent = document.getElementById("controlViajeContent");
const controlPlaca = document.getElementById("controlPlaca");
const controlVehiculoNombre = document.getElementById("controlVehiculoNombre");
const controlDestino = document.getElementById("controlDestino");
const controlFecha = document.getElementById("controlFecha");
const controlVehiculoImagen = document.getElementById("controlVehiculoImagen");
const controlVehiculoImagenPlaceholder = document.getElementById("controlVehiculoImagenPlaceholder");
const controlConductorSection = document.getElementById("controlConductorSection");
const controlConductorNombre = document.getElementById("controlConductorNombre");
const controlConductorCedula = document.getElementById("controlConductorCedula");
const controlConductorLicencia = document.getElementById("controlConductorLicencia");
const controlConductorArchivo = document.getElementById("controlConductorArchivo");
const controlDocumentosGrid = document.getElementById("controlDocumentosGrid");
const loader = document.getElementById("loader");
const mensaje = document.getElementById("mensaje");

const TIPOS_DOCUMENTO_LABEL = {
    soat: "SOAT",
    tecnomecanica: "RTM",
    seguro: "Póliza Seguro",
    licencia_transito: "Licencia de tránsito"
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
    return new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString("es-CO", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

function formatFechaHora(value) {
    if (!value) return "Sin fecha";
    return new Date(value).toLocaleString("es-CO", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function daysUntil(value) {
    if (!value) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(`${String(value).slice(0, 10)}T00:00:00`);
    if (Number.isNaN(target.getTime())) return null;
    return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

function renderDocumentoCard(documento) {
    const label = TIPOS_DOCUMENTO_LABEL[documento.tipo] || documento.tipo;
    const sinVencimiento = documento.tipo === "licencia_transito";
    const days = sinVencimiento ? null : daysUntil(documento.fecha_vencimiento);

    const pillClass = sinVencimiento
        ? "pill-success"
        : days === null
            ? ""
            : days < 0
                ? "pill-danger"
                : days <= 30
                    ? "pill-warning"
                    : "pill-success";

    const statusText = sinVencimiento
        ? "No vence"
        : days === null
            ? "Sin fecha"
            : days < 0
                ? `Vencido hace ${Math.abs(days)} días`
                : `Vence en ${days} días`;

    const esVencido = !sinVencimiento && days !== null && days < 0;

    return `
        <article class="record-item control-doc-card ${esVencido ? "is-vencido" : ""}">
            <div class="record-top">
                <div>
                    <span class="record-title">${escapeHtml(label)}${documento.tipo === "seguro" ? ' <span class="field-help field-help-danger">· Llama al #324 para atención de siniestros viales.</span>' : ""}</span>
                    <span class="record-sub">${escapeHtml(documento.numero_documento) || "Sin número"}</span>
                </div>
                <span class="pill ${pillClass}">${statusText}</span>
            </div>
            <div class="record-meta">
                <span class="pill">Expedición: ${formatFecha(documento.fecha_expedicion)}</span>
                ${sinVencimiento
                    ? `<span class="pill">Propietario: ${escapeHtml(documento.propietario_tipo_identificacion)} ${escapeHtml(documento.propietario_numero_identificacion)} · ${escapeHtml(documento.propietario_nombre)}</span>`
                    : `<span class="pill">Vencimiento: ${formatFecha(documento.fecha_vencimiento)}</span>`}
            </div>
            ${documento.archivo_url ? `
                <a class="record-link" href="${escapeHtml(window.VehiAmb.api.getAssetUrl(documento.archivo_url))}" target="_blank" rel="noreferrer">
                    Ver documento
                </a>
            ` : '<span class="field-help">Sin archivo adjunto</span>'}
        </article>
    `;
}

function renderDocumentos(documentos) {
    if (!documentos.length) {
        controlDocumentosGrid.innerHTML = '<p class="dash-empty">Este vehículo no tiene documentos registrados.</p>';
        return;
    }

    controlDocumentosGrid.innerHTML = documentos.map(renderDocumentoCard).join("");
}

function renderVehiculoImagen(vehiculo) {
    const imageSource = vehiculo?.imagen_url ? window.VehiAmb.api.getAssetUrl(vehiculo.imagen_url) : "";

    if (!imageSource) {
        controlVehiculoImagen.classList.add("hidden");
        controlVehiculoImagenPlaceholder.classList.remove("hidden");
        return;
    }

    controlVehiculoImagen.onerror = () => {
        controlVehiculoImagen.removeAttribute("src");
        controlVehiculoImagen.classList.add("hidden");
        controlVehiculoImagenPlaceholder.classList.remove("hidden");
    };
    controlVehiculoImagen.src = imageSource;
    controlVehiculoImagen.alt = `Imagen del vehículo ${vehiculo.placa || ""}`;
    controlVehiculoImagen.classList.remove("hidden");
    controlVehiculoImagenPlaceholder.classList.add("hidden");
}

function renderConductor(conductor) {
    if (!conductor) {
        controlConductorSection.classList.add("hidden");
        return;
    }

    controlConductorSection.classList.remove("hidden");
    controlConductorNombre.textContent = `${conductor.nombres} ${conductor.apellidos}`.trim();
    controlConductorCedula.textContent = conductor.cedula || "--";
    controlConductorLicencia.textContent = conductor.licencia_categoria || "--";

    if (conductor.licencia_archivo_url) {
        const archivoUrl = window.VehiAmb.api.getAssetUrl(conductor.licencia_archivo_url);
        controlConductorArchivo.innerHTML = `<a class="record-link" href="${escapeHtml(archivoUrl)}" target="_blank" rel="noreferrer">Ver foto/soporte de la licencia</a>`;
        controlConductorArchivo.classList.remove("hidden");
    } else {
        controlConductorArchivo.classList.add("hidden");
        controlConductorArchivo.innerHTML = "";
    }
}

async function cargarUltimoViaje() {
    try {
        window.VehiAmb.ui.show(loader);
        const resultado = await window.VehiAmb.api.getUltimoViajeControl();

        if (!resultado) {
            controlViajeEmpty.classList.remove("hidden");
            controlViajeContent.classList.add("hidden");
            return;
        }

        controlViajeEmpty.classList.add("hidden");
        controlViajeContent.classList.remove("hidden");

        const { viaje, vehiculo, documentos, conductor } = resultado;

        controlPlaca.textContent = vehiculo?.placa || viaje.vehiculo_placa || "SIN PLACA";
        controlVehiculoNombre.textContent = `${vehiculo?.marca || viaje.vehiculo_marca || ""} ${vehiculo?.modelo || viaje.vehiculo_modelo || ""}`.trim() || "Vehículo";
        controlDestino.textContent = viaje.destino || "--";
        controlFecha.textContent = formatFechaHora(viaje.creado_en);

        renderVehiculoImagen(vehiculo);
        renderConductor(conductor);
        renderDocumentos(documentos || []);
    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudo cargar tu último viaje", "error");
    } finally {
        window.VehiAmb.ui.hide(loader);
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    await window.VehiAmb.auth.fetchCurrentUser();
    cargarUltimoViaje();
});
