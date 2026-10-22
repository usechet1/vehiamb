const pageTitulo = document.getElementById("pageTitulo");
const pageDescripcion = document.getElementById("pageDescripcion");
const viajesEmpresaSection = document.getElementById("viajesEmpresaSection");
const viajesEmpresaFilterForm = document.getElementById("viajesEmpresaFilterForm");
const viajesFiltroDesde = document.getElementById("viajesFiltroDesde");
const viajesFiltroHasta = document.getElementById("viajesFiltroHasta");
const viajesFiltroConductor = document.getElementById("viajesFiltroConductor");
const viajesFiltroPlaca = document.getElementById("viajesFiltroPlaca");
const viajesFiltroSummary = document.getElementById("viajesFiltroSummary");
const viajesFiltroClearButton = document.getElementById("viajesFiltroClearButton");
const exportViajesPdfButton = document.getElementById("exportViajesPdfButton");
const exportViajesExcelButton = document.getElementById("exportViajesExcelButton");
const viajesEmpresaList = document.getElementById("viajesEmpresaList");
const viajesResumenFiltro = document.getElementById("viajesResumenFiltro");
const viajesResumenFiltroTexto = document.getElementById("viajesResumenFiltroTexto");
const viajesResumenFiltroQuitar = document.getElementById("viajesResumenFiltroQuitar");
const resumenDiaButton = document.getElementById("resumenDiaButton");
const resumenDiaDrawer = document.getElementById("resumenDiaDrawer");
const resumenDiaBackdrop = document.getElementById("resumenDiaBackdrop");
const resumenDiaTitle = document.getElementById("resumenDiaTitle");
const resumenDiaSubtitle = document.getElementById("resumenDiaSubtitle");
const resumenDiaBody = document.getElementById("resumenDiaBody");
const resumenDiaCompartir = document.getElementById("resumenDiaCompartir");
const resumenDiaCompartirTexto = document.getElementById("resumenDiaCompartirTexto");
const resumenDiaPdf = document.getElementById("resumenDiaPdf");
const resumenDiaLive = document.getElementById("resumenDiaLive");
const closeResumenDia = document.getElementById("closeResumenDia");
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
const conductorViajesRecientesSection = document.getElementById("conductorViajesRecientesSection");
const conductorViajesRecientesList = document.getElementById("conductorViajesRecientesList");
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

// conductor.nombres/apellidos vienen en MAYUSCULAS (mismo caso que
// usuarios.nombre en el sidebar) -- se capitaliza para mostrar, nunca se
// guarda asi.
function capitalizarNombre(value) {
    return String(value || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((palabra) => palabra.charAt(0).toUpperCase() + palabra.slice(1).toLowerCase())
        .join(" ");
}

// Mismo silueta que usa vehicles.js cuando el vehiculo no tiene foto -- para
// que el "sin foto" del resumen del viaje se vea consistente con el resto.
const VEHICULO_FOTO_PLACEHOLDER = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 13l1.5-4.5A2 2 0 0 1 6.4 7h11.2a2 2 0 0 1 1.9 1.5L21 13"/>
        <path d="M3 13h18v5a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1H6v1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/>
        <circle cx="7.5" cy="16" r="1.2"/>
        <circle cx="16.5" cy="16" r="1.2"/>
    </svg>
`;

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

// Resumen plegable de la inspeccion preventiva, directo en la fila del
// viaje -- antes, para saber que items quedaron en mal/bien estado habia
// que abrir el drawer "Ver resumen" viaje por viaje. listarRecientesEmpresa
// ya trae inspeccion_items completo (lo usaba solo el exportable PDF/Excel),
// asi que esto no pide nada nuevo al backend. El listado propio del
// conductor (listarRecientes) no trae ese detalle -- ahi simplemente no
// se muestra nada, en vez de romper.
function renderInspeccionResumenRapido(viaje) {
    if (!viaje.inspeccion_realizada || !Array.isArray(viaje.inspeccion_items) || !viaje.inspeccion_items.length) {
        return "";
    }

    const hayMalos = viaje.inspeccion_items_mal > 0;
    const resumenTexto = `${viaje.inspeccion_items_mal} ítem(s) en mal estado`;

    const pills = viaje.inspeccion_items.map((item) => `
        <span class="pill ${item.estado === "mal" ? "pill-danger" : "pill-success"}">${escapeHtml(item.item_label)}</span>
    `).join("");

    return `
        <details class="record-inspeccion-resumen ${hayMalos ? "has-malos" : ""}">
            <summary>${resumenTexto}</summary>
            <div class="record-meta">${pills}</div>
        </details>
    `;
}

function renderViajesList(viajes, contenedor, vacioHtml, onDeleted) {
    if (!viajes.length) {
        contenedor.innerHTML = vacioHtml;
        return;
    }

    const puedeEliminar = Boolean(window.VehiAmb.auth.hasPermission("trips.delete"));

    contenedor.innerHTML = viajes.map((viaje) => `
        <article class="record-item">
            <div class="record-top">
                <div>
                    <span class="record-title">${escapeHtml(viaje.vehiculo_placa) || "Sin placa"} · ${escapeHtml(viaje.vehiculo_marca)} ${escapeHtml(viaje.vehiculo_modelo)}</span>
                    <span class="record-sub">${escapeHtml(viaje.usuario_nombre) || "Conductor no registrado"} · ${escapeHtml(viaje.destino) || "Sin destino"}</span>
                </div>
                <span class="pill">${formatFechaHora(viaje.creado_en)}</span>
            </div>
            ${renderInspeccionResumenRapido(viaje)}
            <div class="record-actions">
                <button type="button" class="record-link btn-ver-resumen" data-viaje-id="${escapeHtml(viaje.id)}">Ver resumen</button>
                ${puedeEliminar ? `<button type="button" class="record-link btn-eliminar-viaje" data-viaje-id="${escapeHtml(viaje.id)}">Eliminar</button>` : ""}
            </div>
        </article>
    `).join("");

    contenedor.querySelectorAll(".btn-ver-resumen").forEach((btn) => {
        btn.addEventListener("click", () => openViajeResumen(btn.dataset.viajeId));
    });

    // Solo Administrador (permiso trips.delete). Tras eliminar se recarga la
    // lista completa (onDeleted) en vez de solo quitar la fila del DOM, para
    // que el conteo/resumen de filtros ("Mostrando X viajes...") tambien
    // quede al dia.
    contenedor.querySelectorAll(".btn-eliminar-viaje").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const confirmado = await window.VehiAmb.ui.confirm({
                title: "Eliminar viaje",
                message: "¿Eliminar este viaje? Esta acción no se puede deshacer.",
                confirmText: "Eliminar"
            });
            if (!confirmado) return;

            btn.disabled = true;
            try {
                await window.VehiAmb.api.eliminarViaje(btn.dataset.viajeId);
                window.VehiAmb.ui.showMessage(mensaje, "Viaje eliminado correctamente");
                await onDeleted?.();
            } catch (error) {
                console.error(error);
                window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudo eliminar el viaje", "error");
                btn.disabled = false;
            }
        });
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
        ${inspeccion.observaciones ? `<p class="field-help"><strong>Observaciones del conductor:</strong> ${escapeHtml(inspeccion.observaciones)}</p>` : ""}
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
        ${preoperacional.observaciones ? `<p class="field-help"><strong>Observaciones del conductor:</strong> ${escapeHtml(preoperacional.observaciones)}</p>` : ""}
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
    // puedan dejar anotacion (mismo set de roles que ya tiene ese permiso).
    // El Conductor tambien ve el hilo, pero en solo lectura (sin permiso
    // notificaciones.comentar) -- ver cargarComentariosHiloSoloLectura.
    const puedeComentar = window.VehiAmb.auth.hasPermission("notificaciones.comentar");
    const esConductor = window.VehiAmb.auth.getUser()?.rol === "Conductor";
    return `
        <section class="drawer-section">
            <h3>Vehículo</h3>
            <dl class="detail-list detail-list-plain">
                <div>
                    <div class="user-list-identity drawer-identity">
                        <div class="vehiculo-foto">
                            ${vehiculo?.imagen_url
                                ? `<img src="${escapeHtml(window.VehiAmb.api.getAssetUrl(vehiculo.imagen_url))}" alt="">`
                                : VEHICULO_FOTO_PLACEHOLDER}
                        </div>
                        <div>
                            <span class="record-title">${escapeHtml(vehiculo?.placa) || "--"}</span>
                            <span class="record-sub">${escapeHtml(vehiculo?.marca)} ${escapeHtml(vehiculo?.modelo)}</span>
                        </div>
                    </div>
                </div>
                <div><dt>Destino</dt><dd>${escapeHtml(viaje.destino) || "--"}</dd></div>
            </dl>
        </section>

        <section class="drawer-section">
            <h3>Conductor</h3>
            ${conductor ? `
                <div class="user-list-identity drawer-identity">
                    <div class="user-avatar">
                        ${conductor.foto_url
                            ? `<img src="${escapeHtml(window.VehiAmb.api.getAssetUrl(conductor.foto_url))}" alt="" style="object-position: ${escapeHtml(conductor.foto_posicion || "50% 50%")}">`
                            : window.getInitials(`${conductor.nombres} ${conductor.apellidos}`)}
                    </div>
                    <div>
                        <span class="record-title">${escapeHtml(capitalizarNombre(conductor.nombres))} ${escapeHtml(capitalizarNombre(conductor.apellidos))}</span>
                        <span class="record-sub">${escapeHtml(conductor.cedula) || "--"}</span>
                    </div>
                </div>
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

        ${(puedeComentar || esConductor) ? `
            <section class="drawer-section">
                <h3>Comentarios</h3>
                <div id="viajeComentariosHilo" class="notif-comentarios-hilo">
                    <p class="dash-empty">Cargando comentarios...</p>
                </div>
                ${puedeComentar ? `
                    <div class="form-group">
                        <label>Nuevo comentario</label>
                        <div class="mnt-textarea-voice-wrap">
                            <textarea id="viajeComentarioTexto" rows="2" maxlength="500" placeholder="Responde a una novedad de este viaje..."></textarea>
                            <button type="button" id="viajeComentarioVozButton" class="mnt-voice-button" title="Dictar por voz" aria-label="Dictar comentario por voz">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/></svg>
                            </button>
                        </div>
                        <span id="viajeComentarioVozHelp" class="field-help field-help-danger hidden"></span>
                    </div>
                    <div class="form-group">
                        <label>Foto (opcional)</label>
                        <input type="file" id="viajeComentarioFoto" accept="image/png,image/jpeg,image/webp">
                    </div>
                    <button type="button" id="viajeComentarioEnviar" class="btn-primary">Enviar</button>
                ` : ""}
            </section>
        ` : ""}
    `;
}

let comentariosViajeRequestToken = 0;

async function cargarComentariosHiloConFetch(fetchFn) {
    const requestToken = ++comentariosViajeRequestToken;
    const hiloEl = document.getElementById("viajeComentariosHilo");
    if (!hiloEl) return;

    try {
        const comentarios = await fetchFn();
        if (requestToken !== comentariosViajeRequestToken) return;
        hiloEl.innerHTML = renderComentariosHilo(comentarios);
    } catch (error) {
        if (requestToken !== comentariosViajeRequestToken) return;
        console.error(error);
        hiloEl.innerHTML = '<p class="dash-empty">No se pudieron cargar los comentarios.</p>';
    }
}

// Administrador/Operador: lee y escribe por /notificaciones/referencia/viaje/:id.
function cargarComentariosHilo(viajeId) {
    return cargarComentariosHiloConFetch(() => window.VehiAmb.api.getComentariosNotificacion("viaje", viajeId));
}

// Conductor: mismo hilo, pero por /viajes/:id/comentarios (solo lectura,
// el backend valida que el viaje sea suyo -- ver viajes.service.js).
function cargarComentariosHiloSoloLectura(viajeId) {
    return cargarComentariosHiloConFetch(() => window.VehiAmb.api.getComentariosViaje(viajeId));
}

// El boton se crea una sola vez por apertura del drawer (renderViajeDrawerBody
// reemplaza todo #viajeDrawerBody via innerHTML) -- por eso el listener se
// engancha aca, aparte de cargarComentariosHilo, que se vuelve a llamar tras
// cada envio y solo toca el contenido del hilo, nunca el boton.
function setupComentarioForm(viajeId) {
    const enviarBtn = document.getElementById("viajeComentarioEnviar");
    if (!enviarBtn) return;

    window.VehiAmb.ui.setupDictadoVoz(
        document.getElementById("viajeComentarioVozButton"),
        document.getElementById("viajeComentarioTexto"),
        document.getElementById("viajeComentarioVozHelp")
    );

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
        // La seccion de comentarios ni siquiera se renderiza para quien no
        // entra en ninguno de estos dos casos (ver renderViajeDrawerBody) --
        // se repite el chequeo aca para no pedirle el hilo a una API que va
        // a responder 403.
        if (window.VehiAmb.auth.hasPermission("notificaciones.comentar")) {
            cargarComentariosHilo(resumen.viaje.id);
            setupComentarioForm(resumen.viaje.id);
        } else if (window.VehiAmb.auth.getUser()?.rol === "Conductor") {
            cargarComentariosHiloSoloLectura(resumen.viaje.id);
        }
    } catch (error) {
        console.error(error);
        viajeDrawerBody.innerHTML = '<p class="dash-empty">No se pudo cargar el resumen del viaje</p>';
    }
}

closeViajeDrawer.addEventListener("click", closeViajeResumen);
viajeDrawerBackdrop.addEventListener("click", closeViajeResumen);
document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!viajeDrawer.classList.contains("hidden")) {
        closeViajeResumen();
    } else if (!resumenDiaDrawer.classList.contains("hidden")) {
        cerrarResumenDia();
    }
});

function currentViajesFilters() {
    return {
        fecha_desde: viajesFiltroDesde.value,
        fecha_hasta: viajesFiltroHasta.value,
        conductor_id: viajesFiltroConductor.value,
        // Solo para el encabezado del PDF/Excel (ver describeFiltros en
        // mi-viaje-export.js) -- la consulta al backend solo usa conductor_id.
        conductor_nombre: viajesFiltroConductor.value
            ? viajesFiltroConductor.options[viajesFiltroConductor.selectedIndex]?.textContent || ""
            : "",
        placa: viajesFiltroPlaca.value
    };
}

function updateViajesFiltroSummary(cantidad) {
    const filtros = currentViajesFilters();
    const hayFiltros = Boolean(filtros.fecha_desde || filtros.fecha_hasta || filtros.conductor_id || filtros.placa);

    viajesFiltroSummary.textContent = hayFiltros
        ? `Mostrando ${cantidad} viaje(s) que coinciden con los filtros.`
        : `Mostrando los ${cantidad} viajes más recientes. Filtra por fecha para exportar un rango completo.`;
}

// Catalogos del filtro (conductor/placa): se cargan una sola vez, aparte de
// cargarViajesEmpresa (que solo trae los VIAJES ya filtrados) -- si se
// recalcularan a partir de la lista filtrada, elegir una placa vaciaria las
// opciones de Conductor y viceversa.
async function cargarFiltrosViajesEmpresa() {
    try {
        const [conductores, vehiculos] = await Promise.all([
            window.VehiAmb.api.getConductoresConViajesEmpresa(),
            window.VehiAmb.api.getVehiculosCatalogo()
        ]);

        viajesFiltroConductor.innerHTML = '<option value="">Todos los conductores</option>' + (conductores || [])
            .map((conductor) => `<option value="${conductor.id}">${escapeHtml(conductor.nombre)}</option>`)
            .join("");

        viajesFiltroPlaca.innerHTML = '<option value="">Todas las placas</option>' + (vehiculos || [])
            .map((vehiculo) => `<option value="${escapeHtml(vehiculo.placa)}">${escapeHtml(vehiculo.placa)}</option>`)
            .join("");
    } catch (error) {
        console.error("No fue posible cargar los filtros de conductor/placa:", error);
    }
}

// Filtro que aplica una metrica del "Resumen del dia" (ej. "Hallazgos") sobre
// la lista ya cargada: se queda solo con los viajes de esos vehiculos (o de
// esos viajes, para "sin preoperacional"). No va al backend -- los ids ya
// vienen en el propio resumen -- y se descarta apenas cambia cualquier
// filtro normal de la pantalla.
let viajesFiltroResumen = null;

function viajesVisibles() {
    if (!viajesFiltroResumen) return viajesEmpresaState;
    const { vehiculoIds, viajeIds } = viajesFiltroResumen;
    return viajesEmpresaState.filter((viaje) =>
        (!vehiculoIds || vehiculoIds.has(String(viaje.vehiculo_id))) &&
        (!viajeIds || viajeIds.has(String(viaje.id)))
    );
}

function pintarViajesEmpresa() {
    const visibles = viajesVisibles();
    const vacioHtml = viajesFiltroResumen
        ? '<p class="dash-empty">Ningún viaje coincide con el filtro del resumen.</p>'
        : '<p class="dash-empty">Todavía no hay viajes registrados por los conductores.</p>';

    renderViajesList(visibles, viajesEmpresaList, vacioHtml, cargarViajesEmpresa);
    updateViajesFiltroSummary(visibles.length);

    viajesResumenFiltroTexto.textContent = viajesFiltroResumen ? `Filtro del resumen: ${viajesFiltroResumen.etiqueta}` : "";
    viajesResumenFiltro.classList.toggle("hidden", !viajesFiltroResumen);
}

async function cargarViajesEmpresa() {
    const requestToken = ++viajesEmpresaRequestToken;

    try {
        window.VehiAmb.ui.show(loader);
        const viajes = await window.VehiAmb.api.getViajesRecientesEmpresa(currentViajesFilters());
        if (requestToken !== viajesEmpresaRequestToken) return;

        viajesEmpresaSection.classList.remove("hidden");
        viajesEmpresaState = viajes || [];
        pintarViajesEmpresa();
    } catch (error) {
        if (requestToken !== viajesEmpresaRequestToken) return;

        console.error(error);
        window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudo cargar el historial de viajes", "error");
        updateViajesFiltroSummary(0);
    } finally {
        if (requestToken === viajesEmpresaRequestToken) window.VehiAmb.ui.hide(loader);
    }
}

// Lista propia del Conductor (getMisViajesRecientes ya viene acotada a su
// usuario en el backend) para que pueda abrir cada viaje y leer los
// comentarios que le haya dejado el equipo -- sin filtros ni exportar, a
// diferencia de la lista de empresa, que es para Administrador/Operador.
async function cargarConductorViajesRecientes() {
    try {
        const viajes = await window.VehiAmb.api.getMisViajesRecientes();
        conductorViajesRecientesSection.classList.remove("hidden");
        renderViajesList(viajes || [], conductorViajesRecientesList, '<p class="dash-empty">Todavía no has registrado ningún viaje.</p>', cargarConductorViajesRecientes);
    } catch (error) {
        console.error(error);
        conductorViajesRecientesSection.classList.remove("hidden");
        conductorViajesRecientesList.innerHTML = '<p class="dash-empty">No fue posible cargar tus últimos viajes</p>';
    }
}

viajesEmpresaFilterForm.addEventListener("submit", (event) => event.preventDefault());

[viajesFiltroDesde, viajesFiltroHasta, viajesFiltroConductor, viajesFiltroPlaca].forEach((input) => {
    input.addEventListener("change", () => {
        viajesFiltroResumen = null;
        cargarViajesEmpresa();
    });
});

function limpiarFiltrosViajes() {
    viajesFiltroDesde.value = "";
    viajesFiltroHasta.value = "";
    viajesFiltroConductor.value = "";
    viajesFiltroPlaca.value = "";
    viajesFiltroResumen = null;
    return cargarViajesEmpresa();
}

viajesFiltroClearButton.addEventListener("click", limpiarFiltrosViajes);

viajesResumenFiltroQuitar.addEventListener("click", () => {
    viajesFiltroResumen = null;
    pintarViajesEmpresa();
});

async function exportarViajes(boton, exportFn) {
    const originalLabel = boton.textContent;
    boton.disabled = true;
    boton.textContent = "Generando...";

    try {
        await exportFn(viajesVisibles(), currentViajesFilters());
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

// ── Resumen del dia ───────────────────────────────────────────────────────
// Consolidado de la jornada (o del rango filtrado) para no tener que abrir
// viaje por viaje: que se esta repitiendo y que vehiculos requieren
// atencion. Se calcula en el backend (GET /viajes/resumen-dia, ver
// viajes.service.js#obtenerResumenDia) con los mismos filtros activos de la
// lista; sin filtro de fecha, el backend usa el dia de hoy.
const RESUMEN_TIPOS_VISIBLES = 6;
const RESUMEN_TIPOS_POR_VEHICULO = 3;
let resumenDiaState = null;
let resumenDiaFiltros = null;
let resumenDiaRequestToken = 0;
let resumenDiaVerTodosTipos = false;
let resumenDiaCopiadoTimer = null;

function plural(cantidad, singular, pluralTexto) {
    return `${cantidad} ${cantidad === 1 ? singular : pluralTexto}`;
}

function fechaIsoLocal(fechaIso) {
    return new Date(`${fechaIso}T00:00:00`);
}

// "Jueves 22 de octubre" (sin la coma que mete es-CO entre dia y fecha).
function formatFechaLarga(fechaIso) {
    const fecha = fechaIsoLocal(fechaIso);
    const texto = `${fecha.toLocaleDateString("es-CO", { weekday: "long" })} ${fecha.getDate()} de ${fecha.toLocaleDateString("es-CO", { month: "long" })}`;
    return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// "22 oct" o, con conDia, "jue 22 oct" -- para el texto de Compartir.
function formatFechaCorta(fechaIso, { conDia = false } = {}) {
    const fecha = fechaIsoLocal(fechaIso);
    const mes = fecha.toLocaleDateString("es-CO", { month: "short" }).replace(".", "");
    const dia = conDia ? `${fecha.toLocaleDateString("es-CO", { weekday: "short" }).replace(".", "")} ` : "";
    return `${dia}${fecha.getDate()} ${mes}`;
}

function esRangoDeUnDia(rango) {
    return rango.desde === rango.hasta;
}

function describirRangoResumen(rango, { corto = false } = {}) {
    if (esRangoDeUnDia(rango)) {
        return corto ? formatFechaCorta(rango.desde, { conDia: true }) : formatFechaLarga(rango.desde);
    }
    return `${formatFechaCorta(rango.desde)} – ${formatFechaCorta(rango.hasta)}`;
}

function tituloResumen(rango) {
    return esRangoDeUnDia(rango) ? "Resumen del día" : "Resumen del período";
}

function textoComparacionResumen(resumen) {
    const { rango, periodoAnterior } = resumen;
    const etiqueta = esRangoDeUnDia(rango)
        ? (rango.esHoy ? "Ayer" : `Día anterior (${formatFechaCorta(periodoAnterior.desde)})`)
        : `Período anterior (${formatFechaCorta(periodoAnterior.desde)} – ${formatFechaCorta(periodoAnterior.hasta)})`;

    if (!periodoAnterior.viajes) return `${etiqueta}: sin viajes registrados`;
    if (!periodoAnterior.hallazgos) return `${etiqueta}: sin hallazgos en ${plural(periodoAnterior.viajes, "viaje", "viajes")}`;
    return `${etiqueta}: ${plural(periodoAnterior.hallazgos, "hallazgo", "hallazgos")} en ${plural(periodoAnterior.vehiculos, "vehículo", "vehículos")}`;
}

function mensajeSinHallazgos(totales) {
    return totales.vehiculosSinNovedad
        ? "Todos los vehículos salieron sin novedades"
        : "Ningún viaje del período tiene inspección ni preoperacional registrados";
}

function notaSinRegistro(totales) {
    if (!totales.vehiculosSinRegistro) return "";
    return `${plural(totales.vehiculosSinRegistro, "vehículo", "vehículos")} sin inspección ni preoperacional registrados (no se cuentan como "sin novedad").`;
}

// Tono de una metrica: rojo solo si algo impide operar, ambar si requiere
// atencion, nada (neutro) si es normal -- ver reglas de color del panel.
function metricasResumen(resumen) {
    const totales = resumen.totales;
    const faltan = totales.preoperacionalesEsperados - totales.preoperacionalesHechos;
    const hayCriticos = resumen.vehiculosAfectados.some((vehiculo) => vehiculo.severidad === "critica");

    return [
        {
            clave: "preoperacionales",
            etiqueta: "Preoperacionales",
            valor: `${totales.preoperacionalesHechos}/${totales.preoperacionalesEsperados}`,
            valorHtml: `<span class="${faltan ? "is-atencion" : ""}">${totales.preoperacionalesHechos}</span><span class="resumen-metrica-de">/${totales.preoperacionalesEsperados}</span>`,
            nota: faltan ? `${plural(faltan, "falta", "faltan")} por registrar` : "todos hechos",
            notaClase: faltan ? "is-atencion" : "is-ok",
            tono: "",
            habilitada: true
        },
        {
            clave: "hallazgos",
            etiqueta: "Hallazgos",
            valor: String(totales.hallazgos),
            nota: totales.hallazgos ? `en ${plural(totales.vehiculosConHallazgos, "vehículo", "vehículos")}` : "ningún ítem en mal estado",
            tono: totales.hallazgos ? (hayCriticos ? "critica" : "atencion") : "",
            habilitada: totales.hallazgos > 0
        },
        {
            clave: "kit",
            etiqueta: "Kit incompleto",
            valor: String(totales.vehiculosKitIncompleto),
            nota: totales.vehiculosKitIncompleto === 1 ? "vehículo" : "vehículos",
            tono: totales.vehiculosKitIncompleto ? "atencion" : "",
            habilitada: totales.vehiculosKitIncompleto > 0
        },
        {
            clave: "sinNovedad",
            etiqueta: "Sin novedad",
            valor: String(totales.vehiculosSinNovedad),
            nota: totales.vehiculosSinNovedad === 1 ? "vehículo" : "vehículos",
            tono: "",
            habilitada: totales.vehiculosSinNovedad > 0
        }
    ];
}

function renderResumenMetricas(resumen) {
    const tarjetas = metricasResumen(resumen).map((metrica) => `
        <button type="button" class="resumen-metrica ${metrica.tono ? `is-${metrica.tono}` : ""}" data-resumen-metrica="${metrica.clave}" ${metrica.habilitada ? "" : "disabled"}
            aria-label="${escapeHtml(`${metrica.etiqueta}: ${metrica.valor}, ${metrica.nota}${metrica.habilitada ? ". Filtrar la lista de viajes" : ""}`)}">
            <span class="resumen-metrica-etiqueta">${escapeHtml(metrica.etiqueta)}</span>
            <span class="resumen-metrica-valor resumen-num">${metrica.valorHtml || escapeHtml(metrica.valor)}</span>
            <span class="resumen-metrica-nota ${metrica.notaClase || ""}">${escapeHtml(metrica.nota)}</span>
        </button>
    `).join("");

    const nota = notaSinRegistro(resumen.totales);
    return `
        <div class="resumen-dia-metricas">${tarjetas}</div>
        ${nota ? `<p class="resumen-dia-nota">${escapeHtml(nota)}</p>` : ""}
    `;
}

function renderResumenTipos(resumen) {
    const tipos = resumen.hallazgosPorTipo;
    const maximo = Math.max(1, ...tipos.map((tipo) => tipo.vehiculos));
    const visibles = resumenDiaVerTodosTipos ? tipos : tipos.slice(0, RESUMEN_TIPOS_VISIBLES);

    return `
        <section class="resumen-dia-bloque" aria-labelledby="resumenTiposTitulo">
            <h3 id="resumenTiposTitulo">Qué se está repitiendo</h3>
            <ul class="resumen-tipos">
                ${visibles.map((tipo) => `
                    <li class="resumen-tipo">
                        <span class="resumen-tipo-nombre">${escapeHtml(tipo.tipo)}</span>
                        <span class="resumen-tipo-barra is-${tipo.severidad}" aria-hidden="true"><span style="width: ${Math.round((tipo.vehiculos / maximo) * 100)}%"></span></span>
                        <span class="resumen-num resumen-tipo-cantidad">${tipo.vehiculos} veh.</span>
                    </li>
                `).join("")}
            </ul>
            ${tipos.length > RESUMEN_TIPOS_VISIBLES
                ? `<button type="button" class="record-link resumen-ver-todos" data-resumen-accion="ver-todos" aria-expanded="${resumenDiaVerTodosTipos}">${resumenDiaVerTodosTipos ? "Ver menos" : `Ver todos (${tipos.length})`}</button>`
                : ""}
        </section>
    `;
}

function renderResumenVehiculos(resumen) {
    return `
        <section class="resumen-dia-bloque" aria-labelledby="resumenVehiculosTitulo">
            <h3 id="resumenVehiculosTitulo">Vehículos que requieren atención</h3>
            <ul class="resumen-vehiculos">
                ${resumen.vehiculosAfectados.map((vehiculo) => {
                    const tiposTexto = vehiculo.tipos.slice(0, RESUMEN_TIPOS_POR_VEHICULO).join(", ")
                        + (vehiculo.tipos.length > RESUMEN_TIPOS_POR_VEHICULO ? "…" : "");
                    return `
                        <li>
                            <a class="resumen-vehiculo" href="vehiculo.html?id=${encodeURIComponent(vehiculo.vehiculoId)}" title="${escapeHtml(vehiculo.tipos.join(", "))}">
                                <span class="plate resumen-plate">${escapeHtml(vehiculo.placa) || "SIN PLACA"}</span>
                                <span class="resumen-vehiculo-tipos">${escapeHtml(tiposTexto)}</span>
                                <span class="resumen-badge resumen-num is-${vehiculo.severidad}" aria-label="${plural(vehiculo.total, "hallazgo", "hallazgos")}">${vehiculo.total}</span>
                            </a>
                        </li>
                    `;
                }).join("")}
            </ul>
        </section>
    `;
}

function renderResumenPie(resumen) {
    const puedeProgramar = window.VehiAmb.auth.hasPermission("maintenance.create") && resumen.vehiculosAfectados.length > 0;
    const ids = resumen.vehiculosAfectados.map((vehiculo) => vehiculo.vehiculoId).join(",");

    return `
        <footer class="resumen-dia-pie">
            <span class="resumen-dia-comparacion">${escapeHtml(textoComparacionResumen(resumen))}</span>
            ${puedeProgramar ? `<a class="btn-secondary resumen-dia-programar" href="mantenimientos.html?vehiculos=${encodeURIComponent(ids)}">Programar mantenimientos →</a>` : ""}
        </footer>
    `;
}

function renderResumenSkeleton() {
    const filas = (cantidad) => Array.from({ length: cantidad }, () => '<span class="resumen-skel resumen-skel-fila"></span>').join("");
    return `
        <div class="resumen-dia-skeleton" aria-hidden="true">
            <div class="resumen-dia-metricas">${Array.from({ length: 4 }, () => '<span class="resumen-skel resumen-skel-metrica"></span>').join("")}</div>
            <span class="resumen-skel resumen-skel-titulo"></span>
            ${filas(4)}
            <span class="resumen-skel resumen-skel-titulo"></span>
            ${filas(3)}
            <span class="resumen-skel resumen-skel-pie"></span>
        </div>
    `;
}

function hayFiltrosViajesActivos() {
    const filtros = currentViajesFilters();
    return Boolean(filtros.fecha_desde || filtros.fecha_hasta || filtros.conductor_id || filtros.placa);
}

function setAccionesResumenHabilitadas(habilitadas) {
    resumenDiaCompartir.disabled = !habilitadas;
    resumenDiaPdf.disabled = !habilitadas;
}

function renderResumenDia(resumen) {
    const totales = resumen.totales;
    resumenDiaTitle.textContent = tituloResumen(resumen.rango);

    // Sin viajes no se muestran metricas en cero: solo el aviso.
    if (!totales.viajes) {
        resumenDiaSubtitle.textContent = describirRangoResumen(resumen.rango);
        setAccionesResumenHabilitadas(false);
        resumenDiaBody.innerHTML = `
            <div class="resumen-dia-estado">
                <p>No hay viajes registrados en este período.</p>
                ${hayFiltrosViajesActivos() ? '<button type="button" class="btn-secondary" data-resumen-accion="limpiar">Limpiar filtros</button>' : ""}
            </div>
        `;
        return;
    }

    resumenDiaSubtitle.textContent = `${describirRangoResumen(resumen.rango)} · ${plural(totales.viajes, "viaje", "viajes")} · ${plural(totales.conductores, "conductor", "conductores")}`;
    setAccionesResumenHabilitadas(true);

    resumenDiaBody.innerHTML = `
        ${renderResumenMetricas(resumen)}
        ${totales.hallazgos
            ? `${renderResumenTipos(resumen)}${renderResumenVehiculos(resumen)}`
            : `<div class="resumen-dia-positivo ${totales.vehiculosSinNovedad ? "" : "is-neutro"}" role="status">${escapeHtml(mensajeSinHallazgos(totales))}</div>`}
        ${renderResumenPie(resumen)}
    `;
}

function renderResumenError(error) {
    resumenDiaSubtitle.textContent = "";
    setAccionesResumenHabilitadas(false);
    resumenDiaBody.innerHTML = `
        <div class="resumen-dia-estado" role="alert">
            <p>No se pudo cargar el resumen del día.</p>
            ${error?.message && !error.message.startsWith("No se pudo cargar el resumen") ? `<p class="field-help">${escapeHtml(error.message)}</p>` : ""}
            <button type="button" class="btn-secondary" data-resumen-accion="reintentar">Reintentar</button>
        </div>
    `;
}

async function cargarResumenDia() {
    const requestToken = ++resumenDiaRequestToken;
    resumenDiaFiltros = currentViajesFilters();
    resumenDiaState = null;
    resumenDiaVerTodosTipos = false;

    resumenDiaTitle.textContent = "Resumen del día";
    resumenDiaSubtitle.textContent = "Cargando...";
    setAccionesResumenHabilitadas(false);
    resumenDiaBody.setAttribute("aria-busy", "true");
    resumenDiaBody.innerHTML = renderResumenSkeleton();

    try {
        const resumen = await window.VehiAmb.api.getResumenDiaViajes(resumenDiaFiltros);
        if (requestToken !== resumenDiaRequestToken) return;
        resumenDiaState = resumen;
        renderResumenDia(resumen);
    } catch (error) {
        if (requestToken !== resumenDiaRequestToken) return;
        console.error(error);
        renderResumenError(error);
    } finally {
        if (requestToken === resumenDiaRequestToken) resumenDiaBody.removeAttribute("aria-busy");
    }
}

function abrirResumenDia() {
    window.VehiAmb.ui.show(resumenDiaBackdrop);
    window.VehiAmb.ui.show(resumenDiaDrawer);
    resumenDiaDrawer.setAttribute("aria-hidden", "false");
    resumenDiaButton.setAttribute("aria-expanded", "true");
    closeResumenDia.focus();
    cargarResumenDia();
}

function cerrarResumenDia() {
    window.VehiAmb.ui.hide(resumenDiaBackdrop);
    window.VehiAmb.ui.hide(resumenDiaDrawer);
    resumenDiaDrawer.setAttribute("aria-hidden", "true");
    resumenDiaButton.setAttribute("aria-expanded", "false");
    resumenDiaButton.focus();
}

// Cada metrica filtra la lista de abajo: primero se fija el mismo rango de
// fechas del resumen (sin filtro de fecha la lista muestra "los mas
// recientes", no los de hoy) y luego se aplica el filtro por ids.
async function aplicarMetricaResumen(clave) {
    const resumen = resumenDiaState;
    if (!resumen) return;

    const { filtros, rango, totales } = resumen;
    const faltanPreoperacionales = totales.preoperacionalesEsperados - totales.preoperacionalesHechos;
    const definiciones = {
        preoperacionales: faltanPreoperacionales
            ? { etiqueta: "viajes sin preoperacional", viajeIds: filtros.sinPreoperacional }
            : null,
        hallazgos: { etiqueta: "vehículos con hallazgos", vehiculoIds: filtros.conHallazgos },
        kit: { etiqueta: "vehículos con kit incompleto", vehiculoIds: filtros.kitIncompleto },
        sinNovedad: { etiqueta: "vehículos sin novedad", vehiculoIds: filtros.sinNovedad }
    };
    const definicion = definiciones[clave];

    viajesFiltroDesde.value = rango.desde;
    viajesFiltroHasta.value = rango.hasta;
    viajesFiltroResumen = definicion
        ? {
            etiqueta: `${definicion.etiqueta} · ${describirRangoResumen(rango, { corto: true })}`,
            vehiculoIds: definicion.vehiculoIds ? new Set(definicion.vehiculoIds.map(String)) : null,
            viajeIds: definicion.viajeIds ? new Set(definicion.viajeIds.map(String)) : null
        }
        : null;

    cerrarResumenDia();
    await cargarViajesEmpresa();
}

// Texto plano listo para pegar en WhatsApp.
function textoCompartirResumen(resumen) {
    const totales = resumen.totales;
    const faltan = totales.preoperacionalesEsperados - totales.preoperacionalesHechos;
    const lineas = [
        `Resumen VEHIAMB — ${describirRangoResumen(resumen.rango, { corto: true })}`,
        `${plural(totales.viajes, "viaje", "viajes")} · ${plural(totales.preoperacionalesHechos, "preoperacional", "preoperacionales")}${faltan ? ` (${plural(faltan, "falta", "faltan")})` : ""}`
    ];

    if (totales.hallazgos) {
        lineas.push(`${plural(totales.hallazgos, "hallazgo", "hallazgos")} en ${plural(totales.vehiculosConHallazgos, "vehículo", "vehículos")}`);
        lineas.push(`Más repetido: ${resumen.hallazgosPorTipo.slice(0, 3).map((tipo) => `${tipo.corto} (${tipo.vehiculos})`).join(", ")}`);
        lineas.push(`Requieren atención: ${resumen.vehiculosAfectados.slice(0, 3).map((vehiculo) => `${vehiculo.placa || "SIN PLACA"} (${vehiculo.total})`).join(", ")}`);
    } else {
        lineas.push(mensajeSinHallazgos(totales));
    }

    if (totales.vehiculosSinRegistro) {
        lineas.push(`Sin registrar: ${plural(totales.vehiculosSinRegistro, "vehículo", "vehículos")} sin inspección ni preoperacional`);
    }

    return lineas.join("\n");
}

// navigator.clipboard solo existe en contexto seguro (https o localhost) --
// el servidor de produccion se abre por http en la red local, asi que hace
// falta el respaldo con execCommand.
async function copiarAlPortapapeles(texto) {
    if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(texto);
        return;
    }

    const area = document.createElement("textarea");
    area.value = texto;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.top = "0";
    area.style.opacity = "0";
    resumenDiaDrawer.appendChild(area);
    area.select();
    const copiado = document.execCommand("copy");
    area.remove();
    if (!copiado) throw new Error("El navegador no permitió copiar al portapapeles");
}

resumenDiaCompartir.addEventListener("click", async () => {
    if (!resumenDiaState) return;

    try {
        await copiarAlPortapapeles(textoCompartirResumen(resumenDiaState));
        resumenDiaCompartir.focus();
        resumenDiaCompartir.classList.add("is-copiado");
        resumenDiaCompartirTexto.textContent = "Copiado";
        resumenDiaLive.textContent = "Resumen copiado al portapapeles";
        clearTimeout(resumenDiaCopiadoTimer);
        resumenDiaCopiadoTimer = setTimeout(() => {
            resumenDiaCompartir.classList.remove("is-copiado");
            resumenDiaCompartirTexto.textContent = "Compartir";
            resumenDiaLive.textContent = "";
        }, 2500);
    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudo copiar el resumen", "error");
    }
});

resumenDiaPdf.addEventListener("click", async () => {
    const resumen = resumenDiaState;
    if (!resumen) return;

    resumenDiaPdf.disabled = true;
    try {
        await window.VehiAmb.miViajeExport.exportResumenDiaPdf(
            resumen,
            { ...resumenDiaFiltros, fecha_desde: resumen.rango.desde, fecha_hasta: resumen.rango.hasta },
            {
                titulo: tituloResumen(resumen.rango),
                subtitulo: resumenDiaSubtitle.textContent,
                metricas: metricasResumen(resumen),
                notaSinRegistro: notaSinRegistro(resumen.totales),
                mensajeSinHallazgos: mensajeSinHallazgos(resumen.totales),
                comparacion: textoComparacionResumen(resumen)
            }
        );
    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudo exportar el resumen", "error");
    } finally {
        resumenDiaPdf.disabled = false;
    }
});

resumenDiaBody.addEventListener("click", (event) => {
    const metrica = event.target.closest("[data-resumen-metrica]");
    if (metrica && !metrica.disabled) {
        aplicarMetricaResumen(metrica.dataset.resumenMetrica);
        return;
    }

    const accion = event.target.closest("[data-resumen-accion]")?.dataset.resumenAccion;
    if (accion === "ver-todos" && resumenDiaState) {
        resumenDiaVerTodosTipos = !resumenDiaVerTodosTipos;
        renderResumenDia(resumenDiaState);
        resumenDiaBody.querySelector('[data-resumen-accion="ver-todos"]')?.focus();
    } else if (accion === "reintentar") {
        cargarResumenDia();
    } else if (accion === "limpiar") {
        limpiarFiltrosViajes();
        cargarResumenDia();
    }
});

// El panel es modal (aria-modal): Tab no debe escaparse a la pagina de atras.
resumenDiaDrawer.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    const enfocables = Array.from(resumenDiaDrawer.querySelectorAll("button:not([disabled]), a[href]"))
        .filter((elemento) => elemento.offsetParent !== null);
    if (!enfocables.length) return;

    const primero = enfocables[0];
    const ultimo = enfocables[enfocables.length - 1];
    if (event.shiftKey && document.activeElement === primero) {
        event.preventDefault();
        ultimo.focus();
    } else if (!event.shiftKey && document.activeElement === ultimo) {
        event.preventDefault();
        primero.focus();
    }
});

resumenDiaButton.addEventListener("click", abrirResumenDia);
closeResumenDia.addEventListener("click", cerrarResumenDia);
resumenDiaBackdrop.addEventListener("click", cerrarResumenDia);

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
        cargarConductorViajesRecientes();
        return;
    }

    pageTitulo.textContent = "Viajes recientes";
    pageDescripcion.textContent = "Últimos viajes registrados por los conductores de la empresa.";
    cargarFiltrosViajesEmpresa();
    cargarViajesEmpresa();
});
