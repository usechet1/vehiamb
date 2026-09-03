const pageTitulo = document.getElementById("pageTitulo");
const pageDescripcion = document.getElementById("pageDescripcion");
const viajesEmpresaSection = document.getElementById("viajesEmpresaSection");
const viajesEmpresaFilterForm = document.getElementById("viajesEmpresaFilterForm");
const viajesFiltroDesde = document.getElementById("viajesFiltroDesde");
const viajesFiltroHasta = document.getElementById("viajesFiltroHasta");
const viajesFiltroSummary = document.getElementById("viajesFiltroSummary");
const viajesFiltroClearButton = document.getElementById("viajesFiltroClearButton");
const exportViajesPdfButton = document.getElementById("exportViajesPdfButton");
const exportViajesExcelButton = document.getElementById("exportViajesExcelButton");
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
const controlConductorLicencias = document.getElementById("controlConductorLicencias");
const controlDocumentosGrid = document.getElementById("controlDocumentosGrid");
const offlineBanner = document.getElementById("offlineBanner");
const offlineBannerFecha = document.getElementById("offlineBannerFecha");
const loader = document.getElementById("loader");
const mensaje = document.getElementById("mensaje");

const viajeDrawer = document.getElementById("viajeDrawer");
const viajeDrawerBackdrop = document.getElementById("viajeDrawerBackdrop");
const viajeDrawerTitle = document.getElementById("viajeDrawerTitle");
const viajeDrawerSubtitle = document.getElementById("viajeDrawerSubtitle");
const viajeDrawerBody = document.getElementById("viajeDrawerBody");
const closeViajeDrawer = document.getElementById("closeViajeDrawer");
const resumenViajeCache = new Map();
let viajesEmpresaState = [];
let viajesEmpresaRequestToken = 0;

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

    const urlDocumento = documento.archivo_url
        ? (documento._urlOffline !== undefined ? documento._urlOffline : window.VehiAmb.api.getAssetUrl(documento.archivo_url))
        : "";

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
            ${urlDocumento
                ? `<a class="record-link" href="${escapeHtml(urlDocumento)}" target="_blank" rel="noreferrer">Ver documento</a>`
                : documento.archivo_url
                    ? '<span class="field-help">Documento no disponible sin conexión</span>'
                    : '<span class="field-help">Sin archivo adjunto</span>'}
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
    const imageSource = vehiculo?.imagen_url
        ? (vehiculo._urlOffline !== undefined ? vehiculo._urlOffline : window.VehiAmb.api.getAssetUrl(vehiculo.imagen_url))
        : "";

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

function renderLicenciaCard(licencia) {
    const days = daysUntil(licencia.fecha_vencimiento);
    const pillClass = days === null ? "" : days < 0 ? "pill-danger" : days <= 30 ? "pill-warning" : "pill-success";
    const statusText = days === null ? "Sin fecha de vencimiento" : days < 0 ? `Vencida hace ${Math.abs(days)} días` : `Vence en ${days} días`;

    const urlLicencia = licencia.archivo_url
        ? (licencia._urlOffline !== undefined ? licencia._urlOffline : window.VehiAmb.api.getAssetUrl(licencia.archivo_url))
        : "";

    return `
        <article class="record-item control-doc-card ${days !== null && days < 0 ? "is-vencido" : ""}">
            <div class="record-top">
                <div>
                    <span class="record-title">Licencia ${escapeHtml(licencia.categoria)}</span>
                </div>
                <span class="pill ${pillClass}">${statusText}</span>
            </div>
            <div class="record-meta">
                <span class="pill">Vencimiento: ${formatFecha(licencia.fecha_vencimiento)}</span>
            </div>
            ${urlLicencia
                ? `<a class="record-link" href="${escapeHtml(urlLicencia)}" target="_blank" rel="noreferrer">Ver foto/soporte de la licencia</a>`
                : licencia.archivo_url
                    ? '<span class="field-help">Documento no disponible sin conexión</span>'
                    : '<span class="field-help">Sin archivo adjunto</span>'}
        </article>
    `;
}

function renderConductor(conductor) {
    if (!conductor) {
        controlConductorSection.classList.add("hidden");
        return;
    }

    controlConductorSection.classList.remove("hidden");
    controlConductorNombre.textContent = `${conductor.nombres} ${conductor.apellidos}`.trim();
    controlConductorCedula.textContent = conductor.cedula || "--";

    const licencias = conductor.licencias || [];
    controlConductorLicencias.innerHTML = licencias.length
        ? licencias.map(renderLicenciaCard).join("")
        : '<p class="dash-empty">Este conductor no tiene licencias registradas.</p>';
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

function renderComentarioItem(comentario) {
    return `
        <div class="notif-comentario-item">
            <div class="notif-comentario-meta">
                <strong>${escapeHtml(comentario.usuario_nombre) || "Usuario"}</strong>
                <span class="notif-item-time">${formatFechaHora(comentario.creado_en)}</span>
            </div>
            <p>${escapeHtml(comentario.comentario)}</p>
            ${comentario.foto_url ? `<a class="record-link" href="${escapeHtml(window.VehiAmb.api.getAssetUrl(comentario.foto_url))}" target="_blank" rel="noreferrer">Ver foto adjunta</a>` : ""}
        </div>
    `;
}

function renderComentariosHilo(comentarios) {
    if (!comentarios.length) {
        return '<p class="dash-empty">Todavía no hay comentarios para este viaje.</p>';
    }
    return comentarios.map(renderComentarioItem).join("");
}

function renderViajeDrawerBody(resumen) {
    const { vehiculo, viaje, conductor, documentos, inspeccion, preoperacional } = resumen;
    // Reutiliza el mismo permiso/tabla del hilo de comentarios de
    // notificaciones (referencia_tipo/referencia_id generico) -- ver
    // notificaciones.service.js. Se decidio que solo Administrador/Operador
    // puedan dejar anotacion (mismo set de roles que ya tiene ese permiso),
    // el resto de roles con acceso a este drawer solo puede leer el hilo.
    const puedeComentar = window.VehiAmb.auth.hasPermission("notificaciones.comentar");
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
                    <div><dt>Licencias</dt><dd>${(conductor.licencias || []).map((licencia) => escapeHtml(licencia.categoria)).join(", ") || "--"}</dd></div>
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

        ${puedeComentar ? `
            <section class="drawer-section">
                <h3>Comentarios</h3>
                <div id="viajeComentariosHilo" class="notif-comentarios-hilo">
                    <p class="dash-empty">Cargando comentarios...</p>
                </div>
                <div class="form-group">
                    <label>Nuevo comentario</label>
                    <textarea id="viajeComentarioTexto" rows="2" maxlength="500" placeholder="Responde a una novedad de este viaje..."></textarea>
                </div>
                <div class="form-group">
                    <label>Foto (opcional)</label>
                    <input type="file" id="viajeComentarioFoto" accept="image/png,image/jpeg,image/webp">
                </div>
                <button type="button" id="viajeComentarioEnviar" class="btn-primary">Enviar</button>
            </section>
        ` : ""}
    `;
}

let comentariosViajeRequestToken = 0;

async function cargarComentariosHilo(viajeId) {
    const requestToken = ++comentariosViajeRequestToken;
    const hiloEl = document.getElementById("viajeComentariosHilo");
    if (!hiloEl) return;

    try {
        const comentarios = await window.VehiAmb.api.getComentariosNotificacion("viaje", viajeId);
        if (requestToken !== comentariosViajeRequestToken) return;
        hiloEl.innerHTML = renderComentariosHilo(comentarios);
    } catch (error) {
        if (requestToken !== comentariosViajeRequestToken) return;
        console.error(error);
        hiloEl.innerHTML = '<p class="dash-empty">No se pudieron cargar los comentarios.</p>';
    }
}

// El boton se crea una sola vez por apertura del drawer (renderViajeDrawerBody
// reemplaza todo #viajeDrawerBody via innerHTML) -- por eso el listener se
// engancha aca, aparte de cargarComentariosHilo, que se vuelve a llamar tras
// cada envio y solo toca el contenido del hilo, nunca el boton.
function setupComentarioForm(viajeId) {
    const enviarBtn = document.getElementById("viajeComentarioEnviar");
    if (!enviarBtn) return;

    enviarBtn.addEventListener("click", async () => {
        const textoInput = document.getElementById("viajeComentarioTexto");
        const fotoInput = document.getElementById("viajeComentarioFoto");
        const texto = textoInput.value.trim();
        if (!texto) {
            textoInput.focus();
            return;
        }

        enviarBtn.disabled = true;
        try {
            const formData = new FormData();
            formData.append("comentario", texto);
            if (fotoInput.files[0]) formData.append("foto", fotoInput.files[0]);

            await window.VehiAmb.api.comentarNotificacion("viaje", viajeId, formData);
            textoInput.value = "";
            fotoInput.value = "";
            await cargarComentariosHilo(viajeId);
        } catch (error) {
            console.error(error);
            window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudo guardar el comentario", "error");
        } finally {
            enviarBtn.disabled = false;
        }
    });
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
        // La seccion de comentarios ni siquiera se renderiza sin este mismo
        // permiso (ver renderViajeDrawerBody) -- se repite el chequeo aca
        // para no pedirle el hilo a una API que va a responder 403.
        if (window.VehiAmb.auth.hasPermission("notificaciones.comentar")) {
            cargarComentariosHilo(resumen.viaje.id);
            setupComentarioForm(resumen.viaje.id);
        }
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

function currentViajesFilters() {
    return {
        fecha_desde: viajesFiltroDesde.value,
        fecha_hasta: viajesFiltroHasta.value
    };
}

function updateViajesFiltroSummary(cantidad) {
    const filtros = currentViajesFilters();
    const hayFiltros = Boolean(filtros.fecha_desde || filtros.fecha_hasta);

    viajesFiltroSummary.textContent = hayFiltros
        ? `Mostrando ${cantidad} viaje(s) en el rango seleccionado.`
        : `Mostrando los ${cantidad} viajes más recientes. Filtra por fecha para exportar un rango completo.`;
}

async function cargarViajesEmpresa() {
    const requestToken = ++viajesEmpresaRequestToken;

    try {
        window.VehiAmb.ui.show(loader);
        const viajes = await window.VehiAmb.api.getViajesRecientesEmpresa(currentViajesFilters());
        if (requestToken !== viajesEmpresaRequestToken) return;

        viajesEmpresaSection.classList.remove("hidden");
        viajesEmpresaState = viajes || [];
        renderViajesEmpresa(viajesEmpresaState);
        updateViajesFiltroSummary(viajesEmpresaState.length);
    } catch (error) {
        if (requestToken !== viajesEmpresaRequestToken) return;

        console.error(error);
        window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudo cargar el historial de viajes", "error");
        updateViajesFiltroSummary(0);
    } finally {
        if (requestToken === viajesEmpresaRequestToken) window.VehiAmb.ui.hide(loader);
    }
}

viajesEmpresaFilterForm.addEventListener("submit", (event) => event.preventDefault());

[viajesFiltroDesde, viajesFiltroHasta].forEach((input) => {
    input.addEventListener("change", cargarViajesEmpresa);
});

viajesFiltroClearButton.addEventListener("click", () => {
    viajesFiltroDesde.value = "";
    viajesFiltroHasta.value = "";
    cargarViajesEmpresa();
});

async function exportarViajes(boton, exportFn) {
    const originalLabel = boton.textContent;
    boton.disabled = true;
    boton.textContent = "Generando...";

    try {
        await exportFn(viajesEmpresaState, currentViajesFilters());
    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudo exportar el historial de viajes", "error");
    } finally {
        boton.disabled = false;
        boton.textContent = originalLabel;
    }
}

exportViajesPdfButton.addEventListener("click", () => exportarViajes(exportViajesPdfButton, window.VehiAmb.miViajeExport.exportViajesPdf));
exportViajesExcelButton.addEventListener("click", () => exportarViajes(exportViajesExcelButton, window.VehiAmb.miViajeExport.exportViajesExcel));

function ocultarOfflineBanner() {
    window.VehiAmb.ui.hide(offlineBanner);
}

function mostrarOfflineBanner(guardadoEn) {
    offlineBannerFecha.textContent = guardadoEn ? formatFechaHora(guardadoEn) : "--";
    window.VehiAmb.ui.show(offlineBanner);
}

function pintarUltimoViaje(resultado) {
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
}

// Descarga en segundo plano las fotos/PDFs del vehiculo, documentos y
// licencias para poder mostrarlos sin conexion la proxima vez -- no bloquea
// el render de la pantalla actual, que ya usa datos frescos de la red.
async function cachearArchivosUltimoViaje(resultado) {
    const urls = [];
    if (resultado.vehiculo?.imagen_url) {
        urls.push(window.VehiAmb.api.getAssetUrl(resultado.vehiculo.imagen_url));
    }
    (resultado.documentos || []).forEach((documento) => {
        if (documento.archivo_url) urls.push(window.VehiAmb.api.getAssetUrl(documento.archivo_url));
    });
    (resultado.conductor?.licencias || []).forEach((licencia) => {
        if (licencia.archivo_url) urls.push(window.VehiAmb.api.getAssetUrl(licencia.archivo_url));
    });

    await Promise.all(urls.map((url) => window.VehiAmb.offline.guardarArchivo(url)));
}

// Resuelve las URLs de archivos contra lo que ya se guardo en IndexedDB,
// para que las tarjetas de documentos/licencias/imagen usen blob: URLs en
// vez de pegarle a la red (que sabemos que no responde en este momento).
async function resolverArchivosOffline(resultado) {
    if (resultado.vehiculo?.imagen_url) {
        resultado.vehiculo._urlOffline = await window.VehiAmb.offline.obtenerArchivoUrl(
            window.VehiAmb.api.getAssetUrl(resultado.vehiculo.imagen_url)
        );
    }

    for (const documento of resultado.documentos || []) {
        if (documento.archivo_url) {
            documento._urlOffline = await window.VehiAmb.offline.obtenerArchivoUrl(
                window.VehiAmb.api.getAssetUrl(documento.archivo_url)
            );
        }
    }

    for (const licencia of resultado.conductor?.licencias || []) {
        if (licencia.archivo_url) {
            licencia._urlOffline = await window.VehiAmb.offline.obtenerArchivoUrl(
                window.VehiAmb.api.getAssetUrl(licencia.archivo_url)
            );
        }
    }

    return resultado;
}

async function cargarUltimoViaje(usuarioId) {
    try {
        window.VehiAmb.ui.show(loader);
        const resultado = await window.VehiAmb.api.getUltimoViajeControl();
        ocultarOfflineBanner();

        if (!resultado) {
            controlViajeEmpty.classList.remove("hidden");
            controlViajeContent.classList.add("hidden");
            return;
        }

        pintarUltimoViaje(resultado);

        window.VehiAmb.offline.guardarControlViaje(usuarioId, resultado)
            .then(() => cachearArchivosUltimoViaje(resultado))
            .catch((error) => console.error("No se pudo preparar el modo sin conexión:", error));
    } catch (error) {
        console.error(error);

        const cache = error.message === "Sesion expirada"
            ? null
            : await window.VehiAmb.offline.obtenerControlViaje(usuarioId);

        if (cache?.resultado) {
            const resultadoOffline = await resolverArchivosOffline(cache.resultado);
            mostrarOfflineBanner(cache.guardadoEn);
            pintarUltimoViaje(resultadoOffline);
            return;
        }

        window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudo cargar tu último viaje", "error");
    } finally {
        window.VehiAmb.ui.hide(loader);
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    const currentUser = await window.VehiAmb.auth.fetchCurrentUser();

    if (currentUser?.rol === "Conductor") {
        cargarUltimoViaje(currentUser.id);
        return;
    }

    pageTitulo.textContent = "Viajes recientes";
    pageDescripcion.textContent = "Últimos viajes registrados por los conductores de la empresa.";
    cargarViajesEmpresa();
});
