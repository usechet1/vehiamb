const pageTitulo = document.getElementById("pageTitulo");
const pageDescripcion = document.getElementById("pageDescripcion");
const viajesEmpresaSection = document.getElementById("viajesEmpresaSection");
const viajesEmpresaList = document.getElementById("viajesEmpresaList");
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

const viajeDrawer = document.getElementById("viajeDrawer");
const viajeDrawerBackdrop = document.getElementById("viajeDrawerBackdrop");
const viajeDrawerTitle = document.getElementById("viajeDrawerTitle");
const viajeDrawerSubtitle = document.getElementById("viajeDrawerSubtitle");
const viajeDrawerBody = document.getElementById("viajeDrawerBody");
const closeViajeDrawer = document.getElementById("closeViajeDrawer");
const resumenViajeCache = new Map();

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

function renderDocumentosHtml(documentos) {
    if (!documentos.length) {
        return '<p class="dash-empty">Este vehículo no tiene documentos registrados.</p>';
    }
    return documentos.map(renderDocumentoCard).join("");
}

function renderDocumentos(documentos) {
    controlDocumentosGrid.innerHTML = renderDocumentosHtml(documentos);
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

function renderViajesEmpresa(viajes) {
    if (!viajes.length) {
        viajesEmpresaList.innerHTML = '<p class="dash-empty">Todavía no hay viajes registrados por los conductores.</p>';
        return;
    }

    viajesEmpresaList.innerHTML = viajes.map((viaje) => `
        <article class="record-item">
            <div class="record-top">
                <div>
                    <span class="record-title">${escapeHtml(viaje.vehiculo_placa) || "Sin placa"} · ${escapeHtml(viaje.vehiculo_marca)} ${escapeHtml(viaje.vehiculo_modelo)}</span>
                    <span class="record-sub">${escapeHtml(viaje.usuario_nombre) || "Conductor no registrado"} · ${escapeHtml(viaje.destino) || "Sin destino"}</span>
                </div>
                <span class="pill">${formatFechaHora(viaje.creado_en)}</span>
            </div>
            <button type="button" class="record-link btn-ver-resumen" data-viaje-id="${escapeHtml(viaje.id)}">Ver resumen</button>
        </article>
    `).join("");

    viajesEmpresaList.querySelectorAll(".btn-ver-resumen").forEach((btn) => {
        btn.addEventListener("click", () => openViajeResumen(btn.dataset.viajeId));
    });
}

function renderInspeccionHtml(inspeccion) {
    if (!inspeccion) {
        return '<p class="dash-empty">El conductor no registró una inspección preventiva para este viaje.</p>';
    }

    const items = (inspeccion.items || []).map((item) => `
        <div class="inspeccion-detalle-item">
            <span class="pill ${item.estado === "mal" ? "pill-danger" : "pill-success"}">${escapeHtml(item.item_label)}</span>
            ${item.comentario ? `<p class="field-help">${escapeHtml(item.comentario)}</p>` : ""}
            ${item.foto_url ? `<a class="record-link" href="${escapeHtml(window.VehiAmb.api.getAssetUrl(item.foto_url))}" target="_blank" rel="noreferrer">Ver foto</a>` : ""}
        </div>
    `).join("");

    return `
        <p class="field-help">${inspeccion.total_items_mal} de ${inspeccion.total_items} ítems quedaron en mal estado · ${formatFechaHora(inspeccion.fecha)}</p>
        ${items}
    `;
}

function renderPreoperacionalHtml(preoperacional) {
    if (!preoperacional) {
        return '<p class="dash-empty">El conductor no registró un preoperacional para este viaje.</p>';
    }

    const items = (preoperacional.items || []).map((item) => `
        <div class="inspeccion-detalle-item">
            <span class="pill ${item.respuesta === "no" ? "pill-danger" : "pill-success"}">${escapeHtml(item.item_label)}</span>
            ${item.observacion ? `<p class="field-help">${escapeHtml(item.observacion)}</p>` : ""}
        </div>
    `).join("");

    return `
        <p class="field-help">${preoperacional.total_items_no} de ${preoperacional.total_items} preguntas en "No" · ${formatFechaHora(preoperacional.fecha)}</p>
        ${items}
    `;
}

function renderViajeDrawerBody(resumen) {
    const { vehiculo, viaje, conductor, documentos, inspeccion, preoperacional } = resumen;
    return `
        <section class="drawer-section">
            <h3>Vehículo</h3>
            <dl class="detail-list drawer-detail-list">
                <div><dt>Placa</dt><dd>${escapeHtml(vehiculo?.placa) || "--"}</dd></div>
                <div><dt>Marca / modelo</dt><dd>${escapeHtml(vehiculo?.marca)} ${escapeHtml(vehiculo?.modelo)}</dd></div>
                <div><dt>Destino</dt><dd>${escapeHtml(viaje.destino) || "--"}</dd></div>
                <div><dt>Fecha del viaje</dt><dd>${formatFechaHora(viaje.creado_en)}</dd></div>
            </dl>
        </section>

        <section class="drawer-section">
            <h3>Conductor</h3>
            ${conductor ? `
                <dl class="detail-list drawer-detail-list">
                    <div><dt>Nombre</dt><dd>${escapeHtml(conductor.nombres)} ${escapeHtml(conductor.apellidos)}</dd></div>
                    <div><dt>Cédula</dt><dd>${escapeHtml(conductor.cedula) || "--"}</dd></div>
                    <div><dt>Categoría de licencia</dt><dd>${escapeHtml(conductor.licencia_categoria) || "--"}</dd></div>
                </dl>
            ` : '<p class="dash-empty">Este conductor no tiene ficha registrada.</p>'}
        </section>

        <section class="drawer-section">
            <h3>Inspección preventiva</h3>
            ${renderInspeccionHtml(inspeccion)}
        </section>

        <section class="drawer-section">
            <h3>Preoperacional</h3>
            ${renderPreoperacionalHtml(preoperacional)}
        </section>

        <section class="drawer-section">
            <h3>Documentos del vehículo</h3>
            <div class="control-doc-grid">${renderDocumentosHtml(documentos || [])}</div>
        </section>
    `;
}

async function obtenerResumenViaje(viajeId) {
    if (!resumenViajeCache.has(viajeId)) {
        const resumen = await window.VehiAmb.api.getResumenViaje(viajeId);
        resumenViajeCache.set(viajeId, resumen);
    }
    return resumenViajeCache.get(viajeId);
}

function closeViajeResumen() {
    window.VehiAmb.ui.hide(viajeDrawerBackdrop);
    window.VehiAmb.ui.hide(viajeDrawer);
    viajeDrawer.setAttribute("aria-hidden", "true");
}

async function openViajeResumen(viajeId) {
    viajeDrawerTitle.textContent = "Resumen del viaje";
    viajeDrawerSubtitle.textContent = "Cargando...";
    viajeDrawerBody.innerHTML = '<p class="dash-empty">Cargando...</p>';

    window.VehiAmb.ui.show(viajeDrawerBackdrop);
    window.VehiAmb.ui.show(viajeDrawer);
    viajeDrawer.setAttribute("aria-hidden", "false");
    closeViajeDrawer.focus();

    try {
        const resumen = await obtenerResumenViaje(viajeId);
        viajeDrawerTitle.textContent = `${resumen.vehiculo?.placa || resumen.viaje.vehiculo_placa || "Vehículo"}`;
        viajeDrawerSubtitle.textContent = `${resumen.viaje.usuario_nombre || "Conductor no registrado"} · ${formatFechaHora(resumen.viaje.creado_en)}`;
        viajeDrawerBody.innerHTML = renderViajeDrawerBody(resumen);
    } catch (error) {
        console.error(error);
        viajeDrawerBody.innerHTML = '<p class="dash-empty">No se pudo cargar el resumen del viaje</p>';
    }
}

closeViajeDrawer.addEventListener("click", closeViajeResumen);
viajeDrawerBackdrop.addEventListener("click", closeViajeResumen);
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !viajeDrawer.classList.contains("hidden")) {
        closeViajeResumen();
    }
});

async function cargarViajesEmpresa() {
    try {
        window.VehiAmb.ui.show(loader);
        const viajes = await window.VehiAmb.api.getViajesRecientesEmpresa();
        viajesEmpresaSection.classList.remove("hidden");
        renderViajesEmpresa(viajes || []);
    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudo cargar el historial de viajes", "error");
    } finally {
        window.VehiAmb.ui.hide(loader);
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
    const currentUser = await window.VehiAmb.auth.fetchCurrentUser();

    if (currentUser?.rol === "Conductor") {
        cargarUltimoViaje();
        return;
    }

    pageTitulo.textContent = "Viajes recientes";
    pageDescripcion.textContent = "Últimos viajes registrados por los conductores de la empresa.";
    cargarViajesEmpresa();
});
