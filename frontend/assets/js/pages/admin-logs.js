const adminLogsTabs = document.getElementById("adminLogsTabs");
const bloqueMetricas = document.getElementById("adminLogsBloqueMetricas");
const bloqueAccesos = document.getElementById("adminLogsBloqueAccesos");
const bloqueRegistro = document.getElementById("adminLogsBloqueRegistro");
const bloqueErrores = document.getElementById("adminLogsBloqueErrores");

const loader = document.getElementById("loader");
const mensaje = document.getElementById("mensaje");

let vistaActual = "metricas";
let chartInstances = {};

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatDateTime(value) {
    if (!value) return "--";
    return new Date(value).toLocaleString("es-CO", {
        day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
    });
}

function formatDate(value) {
    if (!value) return "--";
    return new Date(String(value).slice(0, 10) + "T00:00:00").toLocaleDateString("es-CO", {
        day: "2-digit", month: "short", year: "numeric"
    });
}

function formatFechaCorta(value) {
    if (!value) return "";
    return new Date(String(value).slice(0, 10) + "T00:00:00").toLocaleDateString("es-CO", { day: "2-digit", month: "short" });
}

function formatDuracion(ms) {
    if (ms === null || ms === undefined) return "--";
    if (ms < 1000) return `${ms} ms`;
    return `${(ms / 1000).toFixed(1)} s`;
}

function actualizarTabsUI() {
    adminLogsTabs.querySelectorAll(".tab-button").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.tabVista === vistaActual);
    });
    bloqueMetricas.classList.toggle("hidden", vistaActual !== "metricas");
    bloqueAccesos.classList.toggle("hidden", vistaActual !== "accesos");
    bloqueRegistro.classList.toggle("hidden", vistaActual !== "registro");
    bloqueErrores.classList.toggle("hidden", vistaActual !== "errores");
}

adminLogsTabs.addEventListener("click", (event) => {
    const boton = event.target.closest("[data-tab-vista]");
    if (!boton) return;

    vistaActual = boton.dataset.tabVista;
    actualizarTabsUI();

    if (vistaActual === "metricas" && !metricasCargadas) cargarMetricas();
    if (vistaActual === "accesos" && !accesosCargados) cargarAccesos();
    if (vistaActual === "registro" && !registroCargado) cargarRegistro();
    if (vistaActual === "errores" && !erroresCargados) cargarErrores();
});

// ── Drawer compartido por las 3 pestañas de logs ──────────────────────
const adminLogsDrawer = document.getElementById("adminLogsDrawer");
const adminLogsDrawerBackdrop = document.getElementById("adminLogsDrawerBackdrop");
const closeAdminLogsDrawer = document.getElementById("closeAdminLogsDrawer");
const adminLogsDrawerTitle = document.getElementById("adminLogsDrawerTitle");
const adminLogsDrawerSubtitle = document.getElementById("adminLogsDrawerSubtitle");
const adminLogsDrawerBody = document.getElementById("adminLogsDrawerBody");

function abrirDrawer(titulo, subtitulo, bodyHtml) {
    adminLogsDrawerTitle.textContent = titulo;
    adminLogsDrawerSubtitle.textContent = subtitulo;
    adminLogsDrawerBody.innerHTML = bodyHtml;
    window.VehiAmb.ui.show(adminLogsDrawerBackdrop);
    window.VehiAmb.ui.show(adminLogsDrawer);
    adminLogsDrawer.setAttribute("aria-hidden", "false");
}

function cerrarDrawer() {
    window.VehiAmb.ui.hide(adminLogsDrawerBackdrop);
    window.VehiAmb.ui.hide(adminLogsDrawer);
    adminLogsDrawer.setAttribute("aria-hidden", "true");
}

closeAdminLogsDrawer.addEventListener("click", cerrarDrawer);
adminLogsDrawerBackdrop.addEventListener("click", cerrarDrawer);
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !adminLogsDrawer.classList.contains("hidden")) cerrarDrawer();
});

// ════════════════════════ MÉTRICAS ════════════════════════
const metricasDesde = document.getElementById("metricasDesde");
const metricasHasta = document.getElementById("metricasHasta");
const metricasKpisGrid = document.getElementById("metricasKpisGrid");
const metricasModulosBody = document.getElementById("metricasModulosBody");
const metricasSincronizacionesBody = document.getElementById("metricasSincronizacionesBody");

let metricasCargadas = false;

const IMPORT_ESTADO_LABEL = {
    completado: "Completado",
    completado_con_errores: "Con errores",
    sin_cambios: "Sin cambios",
    fallido: "Fallido",
    en_proceso: "En proceso",
    pendiente: "Pendiente"
};

const IMPORT_ESTADO_CLASS = {
    completado: "badge-verde",
    completado_con_errores: "badge-amarillo",
    sin_cambios: "badge-gris",
    fallido: "badge-rojo",
    en_proceso: "badge-amarillo",
    pendiente: "badge-amarillo"
};

function destruirChart(id) {
    if (chartInstances[id]) {
        chartInstances[id].destroy();
        delete chartInstances[id];
    }
}

function renderMetricasKpis(metricas) {
    const totalLogins = metricas.uso.logins_por_dia.reduce((suma, f) => suma + f.total, 0);
    const totalErrores = metricas.salud.errores_por_dia.reduce((suma, f) => suma + f.total, 0);

    const tarjetas = [
        { label: "Usuarios activos en el período", valor: metricas.uso.usuarios_activos, accent: "var(--color-primary)" },
        { label: "Inicios de sesión exitosos", valor: totalLogins, accent: "var(--color-success)" },
        { label: "Errores del sistema", valor: totalErrores, accent: totalErrores > 0 ? "var(--color-primary)" : "var(--color-success)" }
    ];

    if (metricas.empresas_activas !== undefined) {
        tarjetas.push({ label: "Empresas activas", valor: metricas.empresas_activas, accent: "var(--color-primary)" });
    }

    metricasKpisGrid.innerHTML = tarjetas.map((tarjeta) => `
        <div class="kpi-card" style="--kpi-accent: ${tarjeta.accent}">
            <div class="kpi-label">${escapeHtml(tarjeta.label)}</div>
            <div class="kpi-value">${tarjeta.valor}</div>
        </div>
    `).join("");
}

function renderMetricasGraficas(metricas) {
    const cfg = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } }
    };

    destruirChart("loginsPorDia");
    chartInstances.loginsPorDia = new Chart(document.getElementById("chartLoginsPorDia"), {
        type: "line",
        data: {
            labels: metricas.uso.logins_por_dia.map((f) => formatFechaCorta(f.fecha)),
            datasets: [{
                label: "Logins",
                data: metricas.uso.logins_por_dia.map((f) => f.total),
                borderColor: "#b21f2d",
                backgroundColor: "rgba(178, 31, 45, 0.12)",
                fill: true,
                tension: 0.3
            }]
        },
        options: cfg
    });

    destruirChart("erroresPorDia");
    chartInstances.erroresPorDia = new Chart(document.getElementById("chartErroresPorDia"), {
        type: "line",
        data: {
            labels: metricas.salud.errores_por_dia.map((f) => formatFechaCorta(f.fecha)),
            datasets: [{
                label: "Errores",
                data: metricas.salud.errores_por_dia.map((f) => f.total),
                borderColor: "#c0392b",
                backgroundColor: "rgba(192, 57, 43, 0.12)",
                fill: true,
                tension: 0.3
            }]
        },
        options: cfg
    });
}

const MODULO_LABEL = {
    mantenimientos: "Mantenimientos",
    documentos: "Documentos",
    viajes: "Viajes",
    entregas_recibidas: "Actas de vehículo",
    asignaciones_ruta: "Asignación de rutas",
    inspecciones_preventivas: "Inspecciones preventivas",
    preoperacionales: "Preoperacional",
    simit_consultas: "Consultas SIMIT"
};

function renderMetricasTablas(metricas) {
    metricasModulosBody.innerHTML = metricas.uso.modulos_mas_usados.map((fila) => `
        <tr><td>${escapeHtml(MODULO_LABEL[fila.modulo] || fila.modulo)}</td><td>${fila.total}</td></tr>
    `).join("") || '<tr><td colspan="2" class="dash-empty">Sin datos</td></tr>';

    metricasSincronizacionesBody.innerHTML = metricas.salud.ultimas_sincronizaciones.map((item) => `
        <tr>
            <td>${formatDate(item.periodo)}</td>
            <td><span class="badge ${IMPORT_ESTADO_CLASS[item.estado] || "badge-amarillo"}">${IMPORT_ESTADO_LABEL[item.estado] || item.estado}</span></td>
            <td>${item.total_nuevos}</td>
            <td>${formatDuracion(item.duracion_ms)}</td>
        </tr>
    `).join("") || '<tr><td colspan="4" class="dash-empty">Sin sincronizaciones registradas</td></tr>';
}

async function cargarMetricas() {
    try {
        const metricas = await window.VehiAmb.api.getMetricasAdmin({
            desde: metricasDesde.value || undefined,
            hasta: metricasHasta.value || undefined
        });
        metricasDesde.value = metricas.rango.desde;
        metricasHasta.value = metricas.rango.hasta;

        renderMetricasKpis(metricas);
        renderMetricasGraficas(metricas);
        renderMetricasTablas(metricas);
        metricasCargadas = true;
    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudieron cargar las métricas", "error");
    }
}

document.getElementById("metricasFilterForm").addEventListener("submit", (event) => event.preventDefault());
metricasDesde.addEventListener("change", cargarMetricas);
metricasHasta.addEventListener("change", cargarMetricas);

// ════════════════════════ ACCESOS ════════════════════════
const accesosSearch = document.getElementById("accesosSearch");
const accesosResultado = document.getElementById("accesosResultado");
const accesosDesde = document.getElementById("accesosDesde");
const accesosHasta = document.getElementById("accesosHasta");
const accesosClearButton = document.getElementById("accesosClearButton");
const accesosSummary = document.getElementById("accesosSummary");
const accesosTableBody = document.getElementById("accesosTableBody");
const accesosListSummary = document.getElementById("accesosListSummary");
const accesosPrevPage = document.getElementById("accesosPrevPage");
const accesosNextPage = document.getElementById("accesosNextPage");

let accesosCargados = false;
let accesosItems = [];
let accesosState = { page: 1, totalPages: 1 };

const ACCESO_RESULTADO_LABEL = {
    exitoso: "Exitoso",
    credenciales_invalidas: "Credenciales inválidas",
    usuario_inactivo: "Usuario inactivo"
};

const ACCESO_RESULTADO_CLASS = {
    exitoso: "badge-verde",
    credenciales_invalidas: "badge-rojo",
    usuario_inactivo: "badge-amarillo"
};

function renderAccesosRow(item, indice) {
    return `
        <tr>
            <td>${formatDateTime(item.creado_en)}</td>
            <td>${escapeHtml(item.email_intentado)}</td>
            <td>${escapeHtml(item.usuario_nombre) || "--"}</td>
            <td><span class="badge ${ACCESO_RESULTADO_CLASS[item.resultado] || "badge-amarillo"}">${ACCESO_RESULTADO_LABEL[item.resultado] || item.resultado}</span></td>
            <td><button type="button" class="btn-secondary" data-acceso-detalle="${indice}">${escapeHtml(item.ip) || "--"}</button></td>
        </tr>
    `;
}

async function cargarAccesos() {
    try {
        accesosTableBody.innerHTML = '<tr><td colspan="5" class="dash-empty">Cargando...</td></tr>';
        const resultado = await window.VehiAmb.api.getLogsAcceso({
            search: accesosSearch.value.trim() || undefined,
            resultado: accesosResultado.value || undefined,
            desde: accesosDesde.value || undefined,
            hasta: accesosHasta.value || undefined,
            page: accesosState.page,
            limit: 20
        });

        accesosItems = resultado.items;
        accesosState.totalPages = resultado.totalPages;

        accesosTableBody.innerHTML = resultado.items.length
            ? resultado.items.map(renderAccesosRow).join("")
            : '<tr><td colspan="5" class="dash-empty">Sin resultados</td></tr>';

        accesosSummary.textContent = `${resultado.total} registros encontrados`;
        accesosListSummary.textContent = `Página ${resultado.page} de ${resultado.totalPages} · ${resultado.total} registros`;
        accesosPrevPage.disabled = accesosState.page <= 1;
        accesosNextPage.disabled = accesosState.page >= accesosState.totalPages;
        accesosCargados = true;
    } catch (error) {
        console.error(error);
        accesosTableBody.innerHTML = '<tr><td colspan="5" class="dash-empty">No fue posible cargar los accesos</td></tr>';
    }
}

document.getElementById("accesosFilterForm").addEventListener("submit", (event) => event.preventDefault());
[accesosResultado, accesosDesde, accesosHasta].forEach((input) => {
    input.addEventListener("change", () => { accesosState.page = 1; cargarAccesos(); });
});

let accesosSearchDebounce;
accesosSearch.addEventListener("input", () => {
    clearTimeout(accesosSearchDebounce);
    accesosSearchDebounce = setTimeout(() => { accesosState.page = 1; cargarAccesos(); }, 300);
});

accesosClearButton.addEventListener("click", () => {
    document.getElementById("accesosFilterForm").reset();
    accesosState.page = 1;
    cargarAccesos();
});

accesosPrevPage.addEventListener("click", () => {
    if (accesosState.page > 1) { accesosState.page -= 1; cargarAccesos(); }
});
accesosNextPage.addEventListener("click", () => {
    if (accesosState.page < accesosState.totalPages) { accesosState.page += 1; cargarAccesos(); }
});

accesosTableBody.addEventListener("click", (event) => {
    const boton = event.target.closest("[data-acceso-detalle]");
    if (!boton) return;

    const item = accesosItems[Number(boton.dataset.accesoDetalle)];
    if (!item) return;

    abrirDrawer(
        "Detalle de acceso",
        formatDateTime(item.creado_en),
        `
            <p><strong>Correo:</strong> ${escapeHtml(item.email_intentado)}</p>
            <p><strong>Usuario:</strong> ${escapeHtml(item.usuario_nombre) || "No identificado"}</p>
            <p><strong>Resultado:</strong> ${ACCESO_RESULTADO_LABEL[item.resultado] || item.resultado}</p>
            <p><strong>IP:</strong> ${escapeHtml(item.ip) || "--"}</p>
            <p><strong>Navegador / dispositivo:</strong></p>
            <p class="field-help">${escapeHtml(item.user_agent) || "No disponible"}</p>
        `
    );
});

// ════════════════════════ REGISTRO ════════════════════════
const registroSearch = document.getElementById("registroSearch");
const registroEvento = document.getElementById("registroEvento");
const registroDesde = document.getElementById("registroDesde");
const registroHasta = document.getElementById("registroHasta");
const registroClearButton = document.getElementById("registroClearButton");
const registroSummary = document.getElementById("registroSummary");
const registroTableBody = document.getElementById("registroTableBody");
const registroListSummary = document.getElementById("registroListSummary");
const registroPrevPage = document.getElementById("registroPrevPage");
const registroNextPage = document.getElementById("registroNextPage");

let registroCargado = false;
let registroItems = [];
let registroState = { page: 1, totalPages: 1 };

const REGISTRO_EVENTO_LABEL = {
    creado: "Creado",
    editado: "Editado",
    activado: "Activado",
    desactivado: "Desactivado",
    rol_cambiado: "Rol cambiado",
    password_recuperacion_solicitada: "Recuperación solicitada",
    password_cambiada: "Contraseña cambiada"
};

const REGISTRO_EVENTO_CLASS = {
    creado: "badge-verde",
    editado: "badge-amarillo",
    activado: "badge-verde",
    desactivado: "badge-rojo",
    rol_cambiado: "badge-amarillo",
    password_recuperacion_solicitada: "badge-amarillo",
    password_cambiada: "badge-verde"
};

function renderRegistroRow(item, indice) {
    return `
        <tr>
            <td>${formatDateTime(item.creado_en)}</td>
            <td>${escapeHtml(item.usuario_afectado_nombre) || "Usuario eliminado"}</td>
            <td><span class="badge ${REGISTRO_EVENTO_CLASS[item.evento] || "badge-amarillo"}">${REGISTRO_EVENTO_LABEL[item.evento] || item.evento}</span></td>
            <td>${escapeHtml(item.actor_nombre) || "--"}</td>
            <td><button type="button" class="btn-secondary" data-registro-detalle="${indice}">Ver detalle</button></td>
        </tr>
    `;
}

async function cargarRegistro() {
    try {
        registroTableBody.innerHTML = '<tr><td colspan="5" class="dash-empty">Cargando...</td></tr>';
        const resultado = await window.VehiAmb.api.getLogsRegistro({
            search: registroSearch.value.trim() || undefined,
            evento: registroEvento.value || undefined,
            desde: registroDesde.value || undefined,
            hasta: registroHasta.value || undefined,
            page: registroState.page,
            limit: 20
        });

        registroItems = resultado.items;
        registroState.totalPages = resultado.totalPages;

        registroTableBody.innerHTML = resultado.items.length
            ? resultado.items.map(renderRegistroRow).join("")
            : '<tr><td colspan="5" class="dash-empty">Sin resultados</td></tr>';

        registroSummary.textContent = `${resultado.total} registros encontrados`;
        registroListSummary.textContent = `Página ${resultado.page} de ${resultado.totalPages} · ${resultado.total} registros`;
        registroPrevPage.disabled = registroState.page <= 1;
        registroNextPage.disabled = registroState.page >= registroState.totalPages;
        registroCargado = true;
    } catch (error) {
        console.error(error);
        registroTableBody.innerHTML = '<tr><td colspan="5" class="dash-empty">No fue posible cargar el registro</td></tr>';
    }
}

document.getElementById("registroFilterForm").addEventListener("submit", (event) => event.preventDefault());
[registroEvento, registroDesde, registroHasta].forEach((input) => {
    input.addEventListener("change", () => { registroState.page = 1; cargarRegistro(); });
});

let registroSearchDebounce;
registroSearch.addEventListener("input", () => {
    clearTimeout(registroSearchDebounce);
    registroSearchDebounce = setTimeout(() => { registroState.page = 1; cargarRegistro(); }, 300);
});

registroClearButton.addEventListener("click", () => {
    document.getElementById("registroFilterForm").reset();
    registroState.page = 1;
    cargarRegistro();
});

registroPrevPage.addEventListener("click", () => {
    if (registroState.page > 1) { registroState.page -= 1; cargarRegistro(); }
});
registroNextPage.addEventListener("click", () => {
    if (registroState.page < registroState.totalPages) { registroState.page += 1; cargarRegistro(); }
});

registroTableBody.addEventListener("click", (event) => {
    const boton = event.target.closest("[data-registro-detalle]");
    if (!boton) return;

    const item = registroItems[Number(boton.dataset.registroDetalle)];
    if (!item) return;

    abrirDrawer(
        "Detalle de registro",
        formatDateTime(item.creado_en),
        `
            <p><strong>Usuario afectado:</strong> ${escapeHtml(item.usuario_afectado_nombre) || "Usuario eliminado"}</p>
            <p><strong>Evento:</strong> ${REGISTRO_EVENTO_LABEL[item.evento] || item.evento}</p>
            <p><strong>Realizado por:</strong> ${escapeHtml(item.actor_nombre) || "Sistema"}</p>
            ${item.detalle ? `<p><strong>Detalle:</strong></p><pre class="field-help">${escapeHtml(JSON.stringify(item.detalle, null, 2))}</pre>` : ""}
        `
    );
});

// ════════════════════════ ERRORES ════════════════════════
const erroresSearch = document.getElementById("erroresSearch");
const erroresStatusCode = document.getElementById("erroresStatusCode");
const erroresDesde = document.getElementById("erroresDesde");
const erroresHasta = document.getElementById("erroresHasta");
const erroresClearButton = document.getElementById("erroresClearButton");
const erroresSummary = document.getElementById("erroresSummary");
const erroresTableBody = document.getElementById("erroresTableBody");
const erroresListSummary = document.getElementById("erroresListSummary");
const erroresPrevPage = document.getElementById("erroresPrevPage");
const erroresNextPage = document.getElementById("erroresNextPage");

let erroresCargados = false;
let erroresItems = [];
let erroresState = { page: 1, totalPages: 1 };

function renderErroresRow(item, indice) {
    return `
        <tr>
            <td>${formatDateTime(item.creado_en)}</td>
            <td>${escapeHtml(item.metodo)}</td>
            <td>${escapeHtml(item.ruta)}</td>
            <td><span class="badge badge-rojo">${item.status_code}</span></td>
            <td>${escapeHtml(item.mensaje)}</td>
            <td><button type="button" class="btn-secondary" data-error-detalle="${indice}">Ver detalle</button></td>
        </tr>
    `;
}

async function cargarErrores() {
    try {
        erroresTableBody.innerHTML = '<tr><td colspan="6" class="dash-empty">Cargando...</td></tr>';
        const resultado = await window.VehiAmb.api.getLogsErrores({
            search: erroresSearch.value.trim() || undefined,
            status_code: erroresStatusCode.value || undefined,
            desde: erroresDesde.value || undefined,
            hasta: erroresHasta.value || undefined,
            page: erroresState.page,
            limit: 20
        });

        erroresItems = resultado.items;
        erroresState.totalPages = resultado.totalPages;

        erroresTableBody.innerHTML = resultado.items.length
            ? resultado.items.map(renderErroresRow).join("")
            : '<tr><td colspan="6" class="dash-empty">Sin errores registrados</td></tr>';

        erroresSummary.textContent = `${resultado.total} registros encontrados`;
        erroresListSummary.textContent = `Página ${resultado.page} de ${resultado.totalPages} · ${resultado.total} registros`;
        erroresPrevPage.disabled = erroresState.page <= 1;
        erroresNextPage.disabled = erroresState.page >= erroresState.totalPages;
        erroresCargados = true;
    } catch (error) {
        console.error(error);
        erroresTableBody.innerHTML = '<tr><td colspan="6" class="dash-empty">No fue posible cargar los errores</td></tr>';
    }
}

document.getElementById("erroresFilterForm").addEventListener("submit", (event) => event.preventDefault());
[erroresStatusCode, erroresDesde, erroresHasta].forEach((input) => {
    input.addEventListener("change", () => { erroresState.page = 1; cargarErrores(); });
});

let erroresSearchDebounce;
erroresSearch.addEventListener("input", () => {
    clearTimeout(erroresSearchDebounce);
    erroresSearchDebounce = setTimeout(() => { erroresState.page = 1; cargarErrores(); }, 300);
});

erroresClearButton.addEventListener("click", () => {
    document.getElementById("erroresFilterForm").reset();
    erroresState.page = 1;
    cargarErrores();
});

erroresPrevPage.addEventListener("click", () => {
    if (erroresState.page > 1) { erroresState.page -= 1; cargarErrores(); }
});
erroresNextPage.addEventListener("click", () => {
    if (erroresState.page < erroresState.totalPages) { erroresState.page += 1; cargarErrores(); }
});

erroresTableBody.addEventListener("click", (event) => {
    const boton = event.target.closest("[data-error-detalle]");
    if (!boton) return;

    const item = erroresItems[Number(boton.dataset.errorDetalle)];
    if (!item) return;

    abrirDrawer(
        `Error ${item.status_code}`,
        formatDateTime(item.creado_en),
        `
            <p><strong>Método:</strong> ${escapeHtml(item.metodo)}</p>
            <p><strong>Ruta:</strong> ${escapeHtml(item.ruta)}</p>
            <p><strong>Usuario:</strong> ${escapeHtml(item.usuario_nombre) || "No identificado"}</p>
            <p><strong>IP:</strong> ${escapeHtml(item.ip) || "--"}</p>
            <p><strong>Mensaje:</strong> ${escapeHtml(item.mensaje)}</p>
            ${item.stack ? `<p><strong>Stack trace:</strong></p><pre class="field-help">${escapeHtml(item.stack)}</pre>` : ""}
        `
    );
});

document.addEventListener("DOMContentLoaded", () => {
    actualizarTabsUI();
    cargarMetricas();
});
