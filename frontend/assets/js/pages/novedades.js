const loader = document.getElementById("loader");
const mensaje = document.getElementById("mensaje");

const registrarNovedadSection = document.getElementById("registrarNovedadSection");
const novedadForm = document.getElementById("novedadForm");
const novedadVehiculo = document.getElementById("novedadVehiculo");
const novedadFecha = document.getElementById("novedadFecha");
const novedadFoto = document.getElementById("novedadFoto");
const novedadFotoCamaraButton = document.getElementById("novedadFotoCamaraButton");
const novedadSubmitButton = document.getElementById("novedadSubmitButton");

const novedadesTablaBody = document.getElementById("novedadesTablaBody");
const filterNovedadVehiculo = document.getElementById("filterNovedadVehiculo");
const filterNovedadDesde = document.getElementById("filterNovedadDesde");
const filterNovedadHasta = document.getElementById("filterNovedadHasta");
const novedadesFilterSummary = document.getElementById("novedadesFilterSummary");
const clearNovedadesFiltersButton = document.getElementById("clearNovedadesFiltersButton");
const novedadesFilterForm = document.getElementById("novedadesFilterForm");

const novedadDrawerBackdrop = document.getElementById("novedadDrawerBackdrop");
const novedadDrawer = document.getElementById("novedadDrawer");
const novedadDrawerTitle = document.getElementById("novedadDrawerTitle");
const novedadDrawerSubtitle = document.getElementById("novedadDrawerSubtitle");
const novedadDrawerBody = document.getElementById("novedadDrawerBody");
const closeNovedadDrawer = document.getElementById("closeNovedadDrawer");

// Boton "Tomar foto" del formulario de registro (fijo en el HTML, a
// diferencia del de "Responder" mas abajo, que se re-crea cada vez que se
// abre el drawer -- ver setupComentarioNovedadForm).
window.VehiAmb.ui.setupTomarFoto(novedadFoto, novedadFotoCamaraButton);

let novedadesState = [];
// Conductor B opera un unico montacargas (user.vehiculo_asignado_id) -- se
// fija aca en DOMContentLoaded para que cargarNovedades() (llamada tambien
// tras crear/eliminar una novedad) sepa pedir siempre el listado acotado a
// ese vehiculo, sin tener que repetir el chequeo de rol en cada call site.
let novedadVehiculoAsignadoId = null;

function hoyISO() {
    const hoy = new Date();
    const offset = hoy.getTimezoneOffset();
    return new Date(hoy.getTime() - offset * 60000).toISOString().slice(0, 10);
}

function escapeHtml(valor) {
    return String(valor ?? "").replace(/[&<>"']/g, (caracter) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[caracter]);
}

function formatFecha(valor) {
    if (!valor) return "-";
    const [anio, mes, dia] = String(valor).slice(0, 10).split("-");
    return anio && mes && dia ? `${dia}/${mes}/${anio}` : "-";
}

function fillVehicleSelect(select, vehiculos, placeholder = "Selecciona un vehículo", valueField = "id") {
    if (!select) return;

    const seleccionado = select.value;
    select.innerHTML = `<option value="">${placeholder}</option>`;

    vehiculos.forEach((vehiculo) => {
        const option = document.createElement("option");
        option.value = vehiculo[valueField];
        option.textContent = `${vehiculo.placa} — ${vehiculo.marca || ""} ${vehiculo.modelo || ""}`.trim();
        select.appendChild(option);
    });

    select.value = seleccionado;
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

// Solo la hora (para la tarjeta, que ya muestra la fecha aparte en su propio
// pill) -- a diferencia de formatFechaHora, que trae fecha y hora completas
// para el detalle del drawer.
function formatHora(value) {
    if (!value) return "-";
    return new Date(value).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
}

function puedeCrear() {
    return Boolean(window.VehiAmb.auth?.hasPermission?.("novedades.create"));
}

function puedeEliminar() {
    return Boolean(window.VehiAmb.auth?.hasPermission?.("novedades.delete"));
}

function filtrarNovedades() {
    const vehiculoId = filterNovedadVehiculo.value;
    const desde = filterNovedadDesde.value;
    const hasta = filterNovedadHasta.value;

    return novedadesState.filter((novedad) => {
        if (vehiculoId && String(novedad.vehiculo_id) !== vehiculoId) return false;
        if (desde && novedad.fecha < desde) return false;
        if (hasta && novedad.fecha > hasta) return false;
        return true;
    });
}

function renderNovedades() {
    const filtradas = filtrarNovedades();

    const hayFiltros = Boolean(filterNovedadVehiculo.value || filterNovedadDesde.value || filterNovedadHasta.value);
    novedadesFilterSummary.textContent = hayFiltros
        ? `Mostrando ${filtradas.length} de ${novedadesState.length} novedades.`
        : "Mostrando todas las novedades.";

    if (!filtradas.length) {
        novedadesTablaBody.innerHTML = '<p class="dash-empty">No hay novedades registradas</p>';
        return;
    }

    novedadesTablaBody.innerHTML = filtradas
        .map((novedad) => `
            <article class="record-item clickable-record" data-novedad-id="${novedad.id}" tabindex="0" role="button" aria-label="Ver detalle de la novedad de ${escapeHtml(novedad.placa)}">
                <div class="record-top">
                    <div>
                        <span class="record-title">${escapeHtml(novedad.placa)}</span>
                        <span class="record-sub">${escapeHtml(novedad.marca || "")} ${escapeHtml(novedad.modelo || "")}</span>
                    </div>
                    <span class="pill">${formatFecha(novedad.fecha)}</span>
                </div>
                <div class="record-top">
                    <span class="record-title">${escapeHtml(novedad.creado_por_nombre) || "Usuario no registrado"}</span>
                    <span class="pill">🕒 ${formatHora(novedad.created_at)}</span>
                </div>
                <div class="record-meta">
                    <span>${escapeHtml(novedad.descripcion)}</span>
                    ${novedad.foto_url ? `<span class="pill">📷 Con foto</span>` : ""}
                </div>
                <div class="simit-card-actions">
                    <span class="record-link">Ver detalle →</span>
                    ${puedeEliminar() ? `<button type="button" class="btn-secondary btn-danger" data-eliminar-novedad="${novedad.id}">Eliminar</button>` : ""}
                </div>
            </article>
        `)
        .join("");
}

async function cargarNovedades() {
    try {
        novedadesState = novedadVehiculoAsignadoId
            ? await window.VehiAmb.api.getNovedadesByVehicle(novedadVehiculoAsignadoId)
            : await window.VehiAmb.api.getNovedades();
        renderNovedades();
    } catch (error) {
        console.error(error);
        novedadesTablaBody.innerHTML = '<p class="dash-empty">No fue posible cargar las novedades</p>';
    }
}

// ─────────────────── Responder (hilo de comentarios) ───────────────────
// Reutiliza el mismo sistema generico de comentarios de notificaciones/viajes
// (referencia_tipo/referencia_id, ver notificaciones.service.js) con
// referencia_tipo = "novedad" -- no requiere nada nuevo en el backend.
// Responder queda detras del permiso notificaciones.comentar
// (Administrador/Operador); el resto de roles con novedades.view (incluido
// Conductor B) ve el hilo en solo lectura.
function puedeResponder() {
    return Boolean(window.VehiAmb.auth?.hasPermission?.("notificaciones.comentar"));
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
        return '<p class="dash-empty">Todavía no hay respuestas para esta novedad.</p>';
    }
    return comentarios.map(renderComentarioItem).join("");
}

let comentariosNovedadRequestToken = 0;

async function cargarComentariosNovedad(novedadId) {
    const requestToken = ++comentariosNovedadRequestToken;
    const hiloEl = document.getElementById("novedadComentariosHilo");
    if (!hiloEl) return;

    try {
        const comentarios = await window.VehiAmb.api.getComentariosNovedad(novedadId);
        if (requestToken !== comentariosNovedadRequestToken) return;
        hiloEl.innerHTML = renderComentariosHilo(comentarios);
    } catch (error) {
        if (requestToken !== comentariosNovedadRequestToken) return;
        console.error(error);
        hiloEl.innerHTML = '<p class="dash-empty">No se pudieron cargar las respuestas.</p>';
    }
}

// El listener se engancha aparte de cargarComentariosNovedad porque
// renderNovedadDrawerBody reemplaza todo #novedadDrawerBody via innerHTML --
// si el botón se reenganchara ahi mismo quedaria duplicado en cada recarga.
function setupComentarioNovedadForm(novedadId) {
    const enviarBtn = document.getElementById("novedadComentarioEnviar");
    if (!enviarBtn) return;

    window.VehiAmb.ui.setupDictadoVoz(
        document.getElementById("novedadComentarioVozButton"),
        document.getElementById("novedadComentarioTexto"),
        document.getElementById("novedadComentarioVozHelp")
    );

    window.VehiAmb.ui.setupTomarFoto(
        document.getElementById("novedadComentarioFoto"),
        document.getElementById("novedadComentarioFotoCamaraButton")
    );

    enviarBtn.addEventListener("click", async () => {
        const textoInput = document.getElementById("novedadComentarioTexto");
        const fotoInput = document.getElementById("novedadComentarioFoto");
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

            await window.VehiAmb.api.comentarNotificacion("novedad", novedadId, formData);
            textoInput.value = "";
            fotoInput.value = "";
            await cargarComentariosNovedad(novedadId);
        } catch (error) {
            console.error(error);
            window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudo guardar la respuesta", "error");
        } finally {
            enviarBtn.disabled = false;
        }
    });
}

function renderNovedadDrawerBody(novedad) {
    const puedeResponderThread = puedeResponder();
    return `
        <section class="drawer-section">
            <dl class="detail-list detail-list-plain">
                <div><dt>Vehículo</dt><dd>${escapeHtml(novedad.placa)} — ${escapeHtml(novedad.marca || "")} ${escapeHtml(novedad.modelo || "")}</dd></div>
                <div><dt>Fecha</dt><dd>${formatFecha(novedad.fecha)}</dd></div>
                <div><dt>Registrado por</dt><dd>${escapeHtml(novedad.creado_por_nombre) || "Usuario no registrado"}</dd></div>
                <div><dt>Hora de registro</dt><dd>${formatFechaHora(novedad.created_at)}</dd></div>
                <div><dt>Descripción</dt><dd>${escapeHtml(novedad.descripcion)}</dd></div>
            </dl>
            ${novedad.foto_url ? `<a class="record-link" href="${escapeHtml(window.VehiAmb.api.getAssetUrl(novedad.foto_url))}" target="_blank" rel="noreferrer">Ver foto adjunta</a>` : ""}
        </section>

        <section class="drawer-section">
            <h3>Respuestas</h3>
            <div id="novedadComentariosHilo" class="notif-comentarios-hilo">
                <p class="dash-empty">Cargando respuestas...</p>
            </div>
            ${puedeResponderThread ? `
                <div class="form-group">
                    <label>Nueva respuesta</label>
                    <div class="mnt-textarea-voice-wrap">
                        <textarea id="novedadComentarioTexto" rows="2" maxlength="500" placeholder="Responde a esta novedad..."></textarea>
                        <button type="button" id="novedadComentarioVozButton" class="mnt-voice-button" title="Dictar por voz" aria-label="Dictar respuesta por voz">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/></svg>
                        </button>
                    </div>
                    <span id="novedadComentarioVozHelp" class="field-help field-help-danger hidden"></span>
                </div>
                <div class="form-group">
                    <label>Foto (opcional)</label>
                    <div class="foto-input-row">
                        <input type="file" id="novedadComentarioFoto" accept="image/png,image/jpeg,image/webp">
                        <button type="button" class="btn-secondary" id="novedadComentarioFotoCamaraButton">📷 Tomar foto</button>
                    </div>
                </div>
                <button type="button" id="novedadComentarioEnviar" class="btn-primary">Enviar</button>
            ` : ""}
        </section>
    `;
}

function closeNovedadResumen() {
    window.VehiAmb.ui.hide(novedadDrawerBackdrop);
    window.VehiAmb.ui.hide(novedadDrawer);
    novedadDrawer.setAttribute("aria-hidden", "true");
}

function openNovedadResumen(novedadId) {
    const novedad = novedadesState.find((item) => String(item.id) === String(novedadId));
    if (!novedad) return;

    novedadDrawerTitle.textContent = `${novedad.placa || "Vehículo"}`;
    novedadDrawerSubtitle.textContent = `${formatFecha(novedad.fecha)}`;
    novedadDrawerBody.innerHTML = renderNovedadDrawerBody(novedad);

    window.VehiAmb.ui.show(novedadDrawerBackdrop);
    window.VehiAmb.ui.show(novedadDrawer);
    novedadDrawer.setAttribute("aria-hidden", "false");
    closeNovedadDrawer.focus();

    cargarComentariosNovedad(novedad.id);
    if (puedeResponder()) setupComentarioNovedadForm(novedad.id);
}

closeNovedadDrawer?.addEventListener("click", closeNovedadResumen);
novedadDrawerBackdrop?.addEventListener("click", closeNovedadResumen);
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !novedadDrawer.classList.contains("hidden")) {
        closeNovedadResumen();
    }
});

function resetNovedadForm() {
    novedadForm.reset();
    novedadFecha.value = hoyISO();
}

novedadForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(novedadForm);

    try {
        window.VehiAmb.ui.show(loader);
        await window.VehiAmb.api.createNovedad(formData);
        window.VehiAmb.ui.showMessage(mensaje, "Novedad registrada correctamente");
        resetNovedadForm();
        await cargarNovedades();
    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudo guardar la novedad", "error");
    } finally {
        window.VehiAmb.ui.hide(loader);
    }
});

// La tarjeta completa es clicable (mismo patron "clickable-record" que ya
// usa simit.js para su listado de flota): al hacer click en cualquier parte
// que no sea "Eliminar" se abre el drawer con el detalle grande (foto,
// descripcion completa e hilo de respuestas). Se cambio de tabla a tarjetas
// porque en mobile una tabla de 5 columnas quedaba ilegible/dificil de tocar
// -- las tarjetas dan un area de click mucho mas grande y clara, con "Ver
// detalle ->" como pista visual explicita.
novedadesTablaBody?.addEventListener("click", async (event) => {
    const eliminarButton = event.target.closest("[data-eliminar-novedad]");
    if (eliminarButton) {
        const confirmado = await window.VehiAmb.ui.confirm({
            title: "Eliminar novedad",
            message: "Esta acción no se puede deshacer.",
            confirmText: "Eliminar"
        });
        if (!confirmado) return;

        try {
            window.VehiAmb.ui.show(loader);
            await window.VehiAmb.api.deleteNovedad(eliminarButton.dataset.eliminarNovedad);
            window.VehiAmb.ui.showMessage(mensaje, "Novedad eliminada correctamente");
            await cargarNovedades();
        } catch (error) {
            console.error(error);
            window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudo eliminar la novedad", "error");
        } finally {
            window.VehiAmb.ui.hide(loader);
        }
        return;
    }

    const tarjeta = event.target.closest("[data-novedad-id]");
    if (tarjeta) openNovedadResumen(tarjeta.dataset.novedadId);
});

// Mismo criterio de accesibilidad que simit.js (ranking/flota clicables):
// la tarjeta tiene tabindex + role="button", asi que Enter/Espacio deben
// abrir el detalle igual que un click.
novedadesTablaBody?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;

    const tarjeta = event.target.closest("[data-novedad-id]");
    if (!tarjeta) return;

    event.preventDefault();
    openNovedadResumen(tarjeta.dataset.novedadId);
});

// Sin esto, Enter dentro de un campo del filtro dispara el submit implicito
// del <form> y recarga la pagina (mismo guard que en seguridad.js/documentos.js).
novedadesFilterForm?.addEventListener("submit", (event) => event.preventDefault());

filterNovedadVehiculo?.addEventListener("change", renderNovedades);
filterNovedadDesde?.addEventListener("change", renderNovedades);
filterNovedadHasta?.addEventListener("change", renderNovedades);

clearNovedadesFiltersButton?.addEventListener("click", () => {
    filterNovedadVehiculo.value = "";
    filterNovedadDesde.value = "";
    filterNovedadHasta.value = "";
    renderNovedades();
});

document.addEventListener("DOMContentLoaded", async () => {
    const user = await window.VehiAmb.auth.fetchCurrentUser();

    if (!puedeCrear()) {
        registrarNovedadSection?.remove();
    } else {
        window.VehiAmb.ui.show(registrarNovedadSection);
        novedadFecha.value = hoyISO();
    }

    // Conductor B solo tiene un vehiculo (su montacargas asignado): no tiene
    // sentido ofrecerle el catalogo completo de la flota, ni al registrar ni
    // al filtrar -- se le fija su propio vehiculo en ambos lados. El backend
    // (novedades.service.js#exigirMontacargaPropio) tambien lo hace cumplir,
    // esto es solo la UI correspondiente.
    const esConductorB = user?.rol === "Conductor B";

    try {
        window.VehiAmb.ui.show(loader);

        if (esConductorB) {
            document.getElementById("filterNovedadVehiculoGroup")?.classList.add("hidden");

            if (user.vehiculo_asignado_id) {
                novedadVehiculoAsignadoId = user.vehiculo_asignado_id;
                const vehiculo = await window.VehiAmb.api.getVehiculo(user.vehiculo_asignado_id);
                fillVehicleSelect(novedadVehiculo, [vehiculo]);
                if (novedadVehiculo) novedadVehiculo.value = String(vehiculo.id);
            } else {
                registrarNovedadSection?.remove();
            }
        } else {
            const vehiculos = await window.VehiAmb.api.getVehiculosCatalogo();
            fillVehicleSelect(novedadVehiculo, vehiculos);
            fillVehicleSelect(filterNovedadVehiculo, vehiculos, "Todos los vehículos");
        }

        await cargarNovedades();

        // Llegada desde una notificacion ("Ver novedad", ver
        // notificaciones-config.js) -- abre de una vez el detalle de esa
        // novedad puntual, mismo patron que documento_id en documentos.js.
        const novedadIdParam = new URLSearchParams(window.location.search).get("novedad_id");
        if (novedadIdParam) {
            openNovedadResumen(novedadIdParam);
        }
    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(mensaje, error.message || "No fue posible cargar la página", "error");
    } finally {
        window.VehiAmb.ui.hide(loader);
    }
});
