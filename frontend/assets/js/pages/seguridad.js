const loader = document.getElementById("loader");
const mensaje = document.getElementById("mensaje");

const tabExtintoresButton = document.getElementById("tabExtintoresButton");
const tabBotiquinButton = document.getElementById("tabBotiquinButton");
const tabHerramientasButton = document.getElementById("tabHerramientasButton");
const bloqueExtintores = document.getElementById("bloqueExtintores");
const bloqueBotiquin = document.getElementById("bloqueBotiquin");
const bloqueHerramientas = document.getElementById("bloqueHerramientas");

// ── Extintores ──
const extintorForm = document.getElementById("extintorForm");
const extintorId = document.getElementById("extintorId");
const extintorVehiculo = document.getElementById("extintorVehiculo");
const extintorCodigo = document.getElementById("extintorCodigo");
const extintorLibras = document.getElementById("extintorLibras");
const extintorFechaVencimiento = document.getElementById("extintorFechaVencimiento");
const extintorFormTitle = document.getElementById("extintorFormTitle");
const extintorSubmitButton = document.getElementById("extintorSubmitButton");
const extintorCancelEditButton = document.getElementById("extintorCancelEditButton");
const registrarExtintorSection = document.getElementById("registrarExtintorSection");
const extintoresTablaBody = document.getElementById("extintoresTablaBody");
const filterExtintorCodigo = document.getElementById("filterExtintorCodigo");
const filterExtintorPlaca = document.getElementById("filterExtintorPlaca");
const extintoresFilterSummary = document.getElementById("extintoresFilterSummary");
const clearExtintoresFiltersButton = document.getElementById("clearExtintoresFiltersButton");
const extintoresFilterForm = document.getElementById("extintoresFilterForm");

// ── Botiquín ──
const botiquinForm = document.getElementById("botiquinForm");
const botiquinVehiculo = document.getElementById("botiquinVehiculo");
const botiquinFecha = document.getElementById("botiquinFecha");
const botiquinInspeccionadoNombres = document.getElementById("botiquinInspeccionadoNombres");
const botiquinInspeccionadoApellidos = document.getElementById("botiquinInspeccionadoApellidos");
const botiquinInspeccionadoCargo = document.getElementById("botiquinInspeccionadoCargo");
const botiquinRevisadoNombres = document.getElementById("botiquinRevisadoNombres");
const botiquinRevisadoApellidos = document.getElementById("botiquinRevisadoApellidos");
const botiquinRevisadoCargo = document.getElementById("botiquinRevisadoCargo");
const botiquinChecklistBody = document.getElementById("botiquinChecklistBody");
const botiquinObservaciones = document.getElementById("botiquinObservaciones");
const botiquinCancelButton = document.getElementById("botiquinCancelButton");
const botiquinMarcarTodoBueno = document.getElementById("botiquinMarcarTodoBueno");
const registrarBotiquinSection = document.getElementById("registrarBotiquinSection");
const botiquinTablaBody = document.getElementById("botiquinTablaBody");
const filterBotiquinPlaca = document.getElementById("filterBotiquinPlaca");
const filterBotiquinDesde = document.getElementById("filterBotiquinDesde");
const filterBotiquinHasta = document.getElementById("filterBotiquinHasta");
const botiquinFilterSummary = document.getElementById("botiquinFilterSummary");
const clearBotiquinFiltersButton = document.getElementById("clearBotiquinFiltersButton");
const botiquinFilterForm = document.getElementById("botiquinFilterForm");

// ── Kit de herramientas ──
const herramientasForm = document.getElementById("herramientasForm");
const herramientasVehiculo = document.getElementById("herramientasVehiculo");
const herramientasFecha = document.getElementById("herramientasFecha");
const herramientasInspeccionadoNombres = document.getElementById("herramientasInspeccionadoNombres");
const herramientasInspeccionadoApellidos = document.getElementById("herramientasInspeccionadoApellidos");
const herramientasInspeccionadoCargo = document.getElementById("herramientasInspeccionadoCargo");
const herramientasRevisadoNombres = document.getElementById("herramientasRevisadoNombres");
const herramientasRevisadoApellidos = document.getElementById("herramientasRevisadoApellidos");
const herramientasRevisadoCargo = document.getElementById("herramientasRevisadoCargo");
const herramientasChecklistBody = document.getElementById("herramientasChecklistBody");
const herramientasObservaciones = document.getElementById("herramientasObservaciones");
const herramientasCancelButton = document.getElementById("herramientasCancelButton");
const herramientasMarcarTodoBueno = document.getElementById("herramientasMarcarTodoBueno");
const registrarHerramientasSection = document.getElementById("registrarHerramientasSection");
const herramientasTablaBody = document.getElementById("herramientasTablaBody");
const filterHerramientasPlaca = document.getElementById("filterHerramientasPlaca");
const filterHerramientasDesde = document.getElementById("filterHerramientasDesde");
const filterHerramientasHasta = document.getElementById("filterHerramientasHasta");
const herramientasFilterSummary = document.getElementById("herramientasFilterSummary");
const clearHerramientasFiltersButton = document.getElementById("clearHerramientasFiltersButton");
const herramientasFilterForm = document.getElementById("herramientasFilterForm");

// ── Drawer ──
const botiquinDrawer = document.getElementById("botiquinDrawer");
const botiquinDrawerBackdrop = document.getElementById("botiquinDrawerBackdrop");
const botiquinDrawerBody = document.getElementById("botiquinDrawerBody");
const botiquinDrawerSubtitle = document.getElementById("botiquinDrawerSubtitle");
const botiquinDrawerClose = document.getElementById("botiquinDrawerClose");
const botiquinDrawerExportButton = document.getElementById("botiquinDrawerExportButton");

const herramientasDrawer = document.getElementById("herramientasDrawer");
const herramientasDrawerBackdrop = document.getElementById("herramientasDrawerBackdrop");
const herramientasDrawerBody = document.getElementById("herramientasDrawerBody");
const herramientasDrawerSubtitle = document.getElementById("herramientasDrawerSubtitle");
const herramientasDrawerClose = document.getElementById("herramientasDrawerClose");
const herramientasDrawerExportButton = document.getElementById("herramientasDrawerExportButton");

let extintoresState = [];
let catalogoBotiquin = [];
let inspeccionAbierta = null;
let catalogoHerramientas = [];
let inspeccionHerramientasAbierta = null;

function formatearFecha(valor) {
    if (!valor) return "—";
    const fecha = new Date(`${String(valor).slice(0, 10)}T00:00:00`);
    if (Number.isNaN(fecha.getTime())) return "—";

    return `${String(fecha.getDate()).padStart(2, "0")}/${String(fecha.getMonth() + 1).padStart(2, "0")}/${fecha.getFullYear()}`;
}

// Se compara contra la fecha local del navegador a medianoche, no contra
// Date.now(), para que "vence hoy" no dependa de la hora a la que se abra la
// pagina.
function diasRestantes(fechaVencimiento) {
    if (!fechaVencimiento) return null;

    const vencimiento = new Date(`${String(fechaVencimiento).slice(0, 10)}T00:00:00`);
    if (Number.isNaN(vencimiento.getTime())) return null;

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    return Math.round((vencimiento - hoy) / (1000 * 60 * 60 * 24));
}

function badgeVencimiento(fechaVencimiento) {
    const dias = diasRestantes(fechaVencimiento);
    if (dias === null) return '<span class="badge-gris">Sin fecha</span>';
    if (dias < 0) return `<span class="badge-rojo">Vencido hace ${Math.abs(dias)} d.</span>`;
    if (dias <= 30) return `<span class="badge-amarillo">Vence en ${dias} d.</span>`;
    return '<span class="badge-verde">Vigente</span>';
}

function escapeHtml(valor) {
    return String(valor ?? "").replace(/[&<>"']/g, (caracter) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[caracter]);
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

// ───────────────────────────── Extintores ─────────────────────────────

function puedeCrear() {
    return Boolean(window.VehiAmb.auth?.hasPermission?.("seguridad.create"));
}

function puedeEliminar() {
    return Boolean(window.VehiAmb.auth?.hasPermission?.("seguridad.delete"));
}

function filtrarExtintores() {
    const codigo = filterExtintorCodigo.value.trim().toLowerCase();
    const placa = filterExtintorPlaca.value;

    return extintoresState.filter((extintor) => {
        if (codigo && !String(extintor.codigo || "").toLowerCase().includes(codigo)) return false;
        if (placa && extintor.placa !== placa) return false;
        return true;
    });
}

function renderExtintores() {
    const filtrados = filtrarExtintores();

    extintoresFilterSummary.textContent = filtrados.length === extintoresState.length
        ? `Mostrando los ${extintoresState.length} extintores registrados.`
        : `Mostrando ${filtrados.length} de ${extintoresState.length} extintores.`;

    if (!filtrados.length) {
        extintoresTablaBody.innerHTML = '<tr><td colspan="7" class="dash-empty">No hay extintores que coincidan con el filtro</td></tr>';
        return;
    }

    extintoresTablaBody.innerHTML = filtrados.map((extintor) => `
        <tr>
            <td>${extintor.consecutivo ?? "—"}</td>
            <td>${escapeHtml(extintor.placa)} <span class="field-help">${escapeHtml(`${extintor.marca || ""} ${extintor.modelo || ""}`.trim())}</span></td>
            <td>${escapeHtml(extintor.codigo)}</td>
            <td>${extintor.libras ? `${Number(extintor.libras)} lb` : "—"}</td>
            <td>${formatearFecha(extintor.fecha_vencimiento)}</td>
            <td>${badgeVencimiento(extintor.fecha_vencimiento)}</td>
            <td class="table-actions">
                ${puedeCrear() ? `<button type="button" class="btn-secondary" data-editar-extintor="${extintor.id}">Editar</button>` : ""}
                ${puedeEliminar() ? `<button type="button" class="btn-secondary btn-danger" data-eliminar-extintor="${extintor.id}">Eliminar</button>` : ""}
            </td>
        </tr>
    `).join("");
}

function resetExtintorForm() {
    extintorForm.reset();
    extintorId.value = "";
    extintorFormTitle.textContent = "Registrar extintor";
    extintorSubmitButton.textContent = "Guardar extintor";
    window.VehiAmb.ui.hide(extintorCancelEditButton);
}

async function cargarExtintores() {
    try {
        extintoresState = await window.VehiAmb.api.getExtintores();
        renderExtintores();
    } catch (error) {
        console.error(error);
        extintoresTablaBody.innerHTML = '<tr><td colspan="7" class="dash-empty">No fue posible cargar los extintores</td></tr>';
    }
}

extintorForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const payload = {
        vehiculo_id: extintorVehiculo.value,
        codigo: extintorCodigo.value.trim(),
        libras: extintorLibras.value,
        fecha_vencimiento: extintorFechaVencimiento.value
    };

    try {
        window.VehiAmb.ui.show(loader);

        if (extintorId.value) {
            await window.VehiAmb.api.actualizarExtintor(extintorId.value, payload);
            window.VehiAmb.ui.showMessage(mensaje, "Extintor actualizado correctamente");
        } else {
            await window.VehiAmb.api.crearExtintor(payload);
            window.VehiAmb.ui.showMessage(mensaje, "Extintor registrado correctamente");
        }

        resetExtintorForm();
        await cargarExtintores();
    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudo guardar el extintor", "error");
    } finally {
        window.VehiAmb.ui.hide(loader);
    }
});

extintorCancelEditButton?.addEventListener("click", resetExtintorForm);

extintoresTablaBody?.addEventListener("click", async (event) => {
    const editarButton = event.target.closest("[data-editar-extintor]");
    if (editarButton) {
        const extintor = extintoresState.find((item) => String(item.id) === editarButton.dataset.editarExtintor);
        if (!extintor) return;

        extintorId.value = extintor.id;
        extintorVehiculo.value = extintor.vehiculo_id;
        extintorCodigo.value = extintor.codigo || "";
        extintorLibras.value = extintor.libras ?? "";
        extintorFechaVencimiento.value = String(extintor.fecha_vencimiento || "").slice(0, 10);
        extintorFormTitle.textContent = "Editar extintor";
        extintorSubmitButton.textContent = "Actualizar extintor";
        window.VehiAmb.ui.show(extintorCancelEditButton);
        registrarExtintorSection.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
    }

    const eliminarButton = event.target.closest("[data-eliminar-extintor]");
    if (!eliminarButton) return;

    const confirmado = await window.VehiAmb.ui.confirm({
        title: "Eliminar extintor",
        message: "Esta acción no se puede deshacer.",
        confirmText: "Eliminar"
    });
    if (!confirmado) return;

    try {
        window.VehiAmb.ui.show(loader);
        await window.VehiAmb.api.eliminarExtintor(eliminarButton.dataset.eliminarExtintor);
        window.VehiAmb.ui.showMessage(mensaje, "Extintor eliminado correctamente");
        if (extintorId.value === eliminarButton.dataset.eliminarExtintor) resetExtintorForm();
        await cargarExtintores();
    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudo eliminar el extintor", "error");
    } finally {
        window.VehiAmb.ui.hide(loader);
    }
});

// Sin esto, Enter dentro del campo de busqueda dispara el submit implicito
// del <form> y recarga la pagina (mismo guard que documentos.js).
extintoresFilterForm?.addEventListener("submit", (event) => event.preventDefault());

filterExtintorCodigo?.addEventListener("input", renderExtintores);
filterExtintorPlaca?.addEventListener("change", renderExtintores);
clearExtintoresFiltersButton?.addEventListener("click", () => {
    filterExtintorCodigo.value = "";
    filterExtintorPlaca.value = "";
    renderExtintores();
});

// ─────────────────────── Inspecciones de botiquín ───────────────────────

function renderChecklist() {
    if (!catalogoBotiquin.length) {
        botiquinChecklistBody.innerHTML = '<tr><td colspan="4" class="dash-empty">No fue posible cargar los insumos</td></tr>';
        return;
    }

    botiquinChecklistBody.innerHTML = catalogoBotiquin.map((item) => `
        <tr data-item-codigo="${escapeHtml(item.codigo)}">
            <td>${escapeHtml(item.label)}</td>
            <td>
                <div class="botiquin-estado">
                    <label><input type="radio" name="estado_${escapeHtml(item.codigo)}" value="bueno" checked> Bueno</label>
                    <label><input type="radio" name="estado_${escapeHtml(item.codigo)}" value="malo"> Malo</label>
                </div>
            </td>
            <td><input type="number" min="0" step="1" class="botiquin-cantidad" data-cantidad="${escapeHtml(item.codigo)}"></td>
            <td><input type="date" class="botiquin-vencimiento" data-vencimiento="${escapeHtml(item.codigo)}"></td>
        </tr>
    `).join("");
}

function leerChecklist() {
    return catalogoBotiquin.map((item) => {
        const estadoInput = botiquinChecklistBody.querySelector(`input[name="estado_${CSS.escape(item.codigo)}"]:checked`);
        const cantidadInput = botiquinChecklistBody.querySelector(`[data-cantidad="${CSS.escape(item.codigo)}"]`);
        const vencimientoInput = botiquinChecklistBody.querySelector(`[data-vencimiento="${CSS.escape(item.codigo)}"]`);

        return {
            item_codigo: item.codigo,
            estado: estadoInput?.value || "bueno",
            cantidad: cantidadInput?.value || null,
            fecha_vencimiento: vencimientoInput?.value || null
        };
    });
}

function resetBotiquinForm() {
    botiquinForm.reset();
    renderChecklist();
    botiquinFecha.value = new Date().toISOString().slice(0, 10);
}

function renderInspecciones(inspecciones) {
    botiquinFilterSummary.textContent = `Mostrando ${inspecciones.length} inspección(es).`;

    if (!inspecciones.length) {
        botiquinTablaBody.innerHTML = '<tr><td colspan="6" class="dash-empty">No hay inspecciones registradas con estos filtros</td></tr>';
        return;
    }

    botiquinTablaBody.innerHTML = inspecciones.map((inspeccion) => {
        const responsable = `${inspeccion.inspeccionado_por_nombres || ""} ${inspeccion.inspeccionado_por_apellidos || ""}`.trim();
        const malos = Number(inspeccion.total_items_malos || 0);

        return `
            <tr>
                <td>${formatearFecha(inspeccion.fecha)}</td>
                <td>${escapeHtml(inspeccion.placa)}</td>
                <td>${escapeHtml(responsable)}</td>
                <td>${inspeccion.total_items}</td>
                <td>${malos > 0 ? `<span class="badge-rojo">${malos}</span>` : '<span class="badge-verde">0</span>'}</td>
                <td class="table-actions">
                    <button type="button" class="btn-secondary" data-ver-inspeccion="${inspeccion.id}">Ver</button>
                    ${puedeEliminar() ? `<button type="button" class="btn-secondary btn-danger" data-eliminar-inspeccion="${inspeccion.id}">Eliminar</button>` : ""}
                </td>
            </tr>
        `;
    }).join("");
}

async function cargarInspecciones() {
    try {
        const inspecciones = await window.VehiAmb.api.getInspeccionesBotiquin({
            vehiculo_id: filterBotiquinPlaca.value || null,
            fecha_desde: filterBotiquinDesde.value || null,
            fecha_hasta: filterBotiquinHasta.value || null
        });
        renderInspecciones(inspecciones);
    } catch (error) {
        console.error(error);
        botiquinTablaBody.innerHTML = '<tr><td colspan="6" class="dash-empty">No fue posible cargar las inspecciones</td></tr>';
    }
}

botiquinForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const payload = {
        vehiculo_id: botiquinVehiculo.value,
        fecha: botiquinFecha.value,
        inspeccionado_por_nombres: botiquinInspeccionadoNombres.value.trim(),
        inspeccionado_por_apellidos: botiquinInspeccionadoApellidos.value.trim(),
        inspeccionado_por_cargo: botiquinInspeccionadoCargo.value.trim(),
        revisado_por_nombres: botiquinRevisadoNombres.value.trim(),
        revisado_por_apellidos: botiquinRevisadoApellidos.value.trim(),
        revisado_por_cargo: botiquinRevisadoCargo.value.trim(),
        observaciones: botiquinObservaciones.value.trim(),
        items: leerChecklist()
    };

    try {
        window.VehiAmb.ui.show(loader);
        await window.VehiAmb.api.crearInspeccionBotiquin(payload);
        window.VehiAmb.ui.showMessage(mensaje, "Inspección de botiquín registrada correctamente");
        resetBotiquinForm();
        await cargarInspecciones();
    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudo guardar la inspección", "error");
    } finally {
        window.VehiAmb.ui.hide(loader);
    }
});

botiquinCancelButton?.addEventListener("click", resetBotiquinForm);

botiquinMarcarTodoBueno?.addEventListener("click", () => {
    botiquinChecklistBody.querySelectorAll('input[type="radio"][value="bueno"]').forEach((radio) => {
        radio.checked = true;
    });
});

function abrirDrawer(inspeccion) {
    inspeccionAbierta = inspeccion;

    botiquinDrawerSubtitle.textContent = `${inspeccion.placa} — ${formatearFecha(inspeccion.fecha)}`;

    const responsable = `${inspeccion.inspeccionado_por_nombres || ""} ${inspeccion.inspeccionado_por_apellidos || ""}`.trim();
    const revisor = `${inspeccion.revisado_por_nombres || ""} ${inspeccion.revisado_por_apellidos || ""}`.trim();

    const filas = inspeccion.items.map((item) => `
        <tr>
            <td>${escapeHtml(item.item_label)}</td>
            <td>${item.estado === "malo" ? '<span class="badge-rojo">Malo</span>' : '<span class="badge-verde">Bueno</span>'}</td>
            <td>${item.cantidad ?? "—"}</td>
            <td>${item.fecha_vencimiento ? formatearFecha(item.fecha_vencimiento) : "—"}</td>
        </tr>
    `).join("");

    botiquinDrawerBody.innerHTML = `
        <dl class="detail-list drawer-detail-list">
            <div><dt>Vehículo</dt><dd>${escapeHtml(inspeccion.placa)} — ${escapeHtml(`${inspeccion.marca || ""} ${inspeccion.modelo || ""}`.trim())}</dd></div>
            <div><dt>Fecha</dt><dd>${formatearFecha(inspeccion.fecha)}</dd></div>
            <div><dt>Inspeccionado por</dt><dd>${escapeHtml(responsable)}${inspeccion.inspeccionado_por_cargo ? ` (${escapeHtml(inspeccion.inspeccionado_por_cargo)})` : ""}</dd></div>
            <div><dt>Revisado por</dt><dd>${revisor ? escapeHtml(revisor) : "—"}${inspeccion.revisado_por_cargo ? ` (${escapeHtml(inspeccion.revisado_por_cargo)})` : ""}</dd></div>
            <div><dt>Insumos revisados</dt><dd>${inspeccion.items.length}</dd></div>
            <div><dt>En mal estado</dt><dd>${inspeccion.items.filter((item) => item.estado === "malo").length}</dd></div>
        </dl>

        <div class="table-scroll">
            <table class="import-table">
                <thead><tr><th>Insumo</th><th>Estado</th><th>Cantidad</th><th>Vencimiento</th></tr></thead>
                <tbody>${filas}</tbody>
            </table>
        </div>

        <dl class="detail-list drawer-detail-list">
            <div><dt>Observaciones generales</dt><dd>${inspeccion.observaciones ? escapeHtml(inspeccion.observaciones) : "Sin observaciones"}</dd></div>
        </dl>
    `;

    window.VehiAmb.ui.show(botiquinDrawer);
    window.VehiAmb.ui.show(botiquinDrawerBackdrop);
    botiquinDrawer.setAttribute("aria-hidden", "false");
}

function cerrarDrawer() {
    window.VehiAmb.ui.hide(botiquinDrawer);
    window.VehiAmb.ui.hide(botiquinDrawerBackdrop);
    botiquinDrawer.setAttribute("aria-hidden", "true");
    inspeccionAbierta = null;
}

botiquinDrawerClose?.addEventListener("click", cerrarDrawer);
botiquinDrawerBackdrop?.addEventListener("click", cerrarDrawer);

botiquinDrawerExportButton?.addEventListener("click", async () => {
    if (!inspeccionAbierta) return;

    try {
        window.VehiAmb.ui.show(loader);
        await window.VehiAmb.seguridadExport.exportInspeccionBotiquinPdf(inspeccionAbierta);
    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudo exportar el PDF", "error");
    } finally {
        window.VehiAmb.ui.hide(loader);
    }
});

botiquinTablaBody?.addEventListener("click", async (event) => {
    const verButton = event.target.closest("[data-ver-inspeccion]");
    if (verButton) {
        try {
            window.VehiAmb.ui.show(loader);
            const inspeccion = await window.VehiAmb.api.getInspeccionBotiquin(verButton.dataset.verInspeccion);
            abrirDrawer(inspeccion);
        } catch (error) {
            console.error(error);
            window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudo cargar la inspección", "error");
        } finally {
            window.VehiAmb.ui.hide(loader);
        }
        return;
    }

    const eliminarButton = event.target.closest("[data-eliminar-inspeccion]");
    if (!eliminarButton) return;

    const confirmado = await window.VehiAmb.ui.confirm({
        title: "Eliminar inspección",
        message: "Se eliminará la inspección junto con todo su checklist. Esta acción no se puede deshacer.",
        confirmText: "Eliminar"
    });
    if (!confirmado) return;

    try {
        window.VehiAmb.ui.show(loader);
        await window.VehiAmb.api.eliminarInspeccionBotiquin(eliminarButton.dataset.eliminarInspeccion);
        window.VehiAmb.ui.showMessage(mensaje, "Inspección eliminada correctamente");
        cerrarDrawer();
        await cargarInspecciones();
    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudo eliminar la inspección", "error");
    } finally {
        window.VehiAmb.ui.hide(loader);
    }
});

botiquinFilterForm?.addEventListener("submit", (event) => event.preventDefault());

filterBotiquinPlaca?.addEventListener("change", cargarInspecciones);
filterBotiquinDesde?.addEventListener("change", cargarInspecciones);
filterBotiquinHasta?.addEventListener("change", cargarInspecciones);
clearBotiquinFiltersButton?.addEventListener("click", () => {
    filterBotiquinPlaca.value = "";
    filterBotiquinDesde.value = "";
    filterBotiquinHasta.value = "";
    cargarInspecciones();
});

// ─────────────────────── Inspecciones de kit de herramientas ───────────────────────
// Mismo patron que la seccion de botiquin de arriba: catalogo fijo (9
// herramientas en vez de 20 insumos), mismo checklist bueno/malo +
// cantidad/vencimiento opcionales, mismo drawer de detalle.

function renderChecklistHerramientas() {
    if (!catalogoHerramientas.length) {
        herramientasChecklistBody.innerHTML = '<tr><td colspan="4" class="dash-empty">No fue posible cargar las herramientas</td></tr>';
        return;
    }

    herramientasChecklistBody.innerHTML = catalogoHerramientas.map((item) => `
        <tr data-item-codigo="${escapeHtml(item.codigo)}">
            <td>${escapeHtml(item.label)}</td>
            <td>
                <div class="botiquin-estado">
                    <label><input type="radio" name="estado_${escapeHtml(item.codigo)}" value="bueno" checked> Bueno</label>
                    <label><input type="radio" name="estado_${escapeHtml(item.codigo)}" value="malo"> Malo</label>
                </div>
            </td>
            <td><input type="number" min="0" step="1" class="botiquin-cantidad" data-cantidad="${escapeHtml(item.codigo)}"></td>
            <td><input type="date" class="botiquin-vencimiento" data-vencimiento="${escapeHtml(item.codigo)}"></td>
        </tr>
    `).join("");
}

function leerChecklistHerramientas() {
    return catalogoHerramientas.map((item) => {
        const estadoInput = herramientasChecklistBody.querySelector(`input[name="estado_${CSS.escape(item.codigo)}"]:checked`);
        const cantidadInput = herramientasChecklistBody.querySelector(`[data-cantidad="${CSS.escape(item.codigo)}"]`);
        const vencimientoInput = herramientasChecklistBody.querySelector(`[data-vencimiento="${CSS.escape(item.codigo)}"]`);

        return {
            item_codigo: item.codigo,
            estado: estadoInput?.value || "bueno",
            cantidad: cantidadInput?.value || null,
            fecha_vencimiento: vencimientoInput?.value || null
        };
    });
}

function resetHerramientasForm() {
    herramientasForm.reset();
    renderChecklistHerramientas();
    herramientasFecha.value = new Date().toISOString().slice(0, 10);
}

function renderInspeccionesHerramientas(inspecciones) {
    herramientasFilterSummary.textContent = `Mostrando ${inspecciones.length} inspección(es).`;

    if (!inspecciones.length) {
        herramientasTablaBody.innerHTML = '<tr><td colspan="6" class="dash-empty">No hay inspecciones registradas con estos filtros</td></tr>';
        return;
    }

    herramientasTablaBody.innerHTML = inspecciones.map((inspeccion) => {
        const responsable = `${inspeccion.inspeccionado_por_nombres || ""} ${inspeccion.inspeccionado_por_apellidos || ""}`.trim();
        const malos = Number(inspeccion.total_items_malos || 0);

        return `
            <tr>
                <td>${formatearFecha(inspeccion.fecha)}</td>
                <td>${escapeHtml(inspeccion.placa)}</td>
                <td>${escapeHtml(responsable)}</td>
                <td>${inspeccion.total_items}</td>
                <td>${malos > 0 ? `<span class="badge-rojo">${malos}</span>` : '<span class="badge-verde">0</span>'}</td>
                <td class="table-actions">
                    <button type="button" class="btn-secondary" data-ver-inspeccion-herramientas="${inspeccion.id}">Ver</button>
                    ${puedeEliminar() ? `<button type="button" class="btn-secondary btn-danger" data-eliminar-inspeccion-herramientas="${inspeccion.id}">Eliminar</button>` : ""}
                </td>
            </tr>
        `;
    }).join("");
}

async function cargarInspeccionesHerramientas() {
    try {
        const inspecciones = await window.VehiAmb.api.getInspeccionesHerramientas({
            vehiculo_id: filterHerramientasPlaca.value || null,
            fecha_desde: filterHerramientasDesde.value || null,
            fecha_hasta: filterHerramientasHasta.value || null
        });
        renderInspeccionesHerramientas(inspecciones);
    } catch (error) {
        console.error(error);
        herramientasTablaBody.innerHTML = '<tr><td colspan="6" class="dash-empty">No fue posible cargar las inspecciones</td></tr>';
    }
}

herramientasForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const payload = {
        vehiculo_id: herramientasVehiculo.value,
        fecha: herramientasFecha.value,
        inspeccionado_por_nombres: herramientasInspeccionadoNombres.value.trim(),
        inspeccionado_por_apellidos: herramientasInspeccionadoApellidos.value.trim(),
        inspeccionado_por_cargo: herramientasInspeccionadoCargo.value.trim(),
        revisado_por_nombres: herramientasRevisadoNombres.value.trim(),
        revisado_por_apellidos: herramientasRevisadoApellidos.value.trim(),
        revisado_por_cargo: herramientasRevisadoCargo.value.trim(),
        observaciones: herramientasObservaciones.value.trim(),
        items: leerChecklistHerramientas()
    };

    try {
        window.VehiAmb.ui.show(loader);
        await window.VehiAmb.api.crearInspeccionHerramientas(payload);
        window.VehiAmb.ui.showMessage(mensaje, "Inspección de kit de herramientas registrada correctamente");
        resetHerramientasForm();
        await cargarInspeccionesHerramientas();
    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudo guardar la inspección", "error");
    } finally {
        window.VehiAmb.ui.hide(loader);
    }
});

herramientasCancelButton?.addEventListener("click", resetHerramientasForm);

herramientasMarcarTodoBueno?.addEventListener("click", () => {
    herramientasChecklistBody.querySelectorAll('input[type="radio"][value="bueno"]').forEach((radio) => {
        radio.checked = true;
    });
});

function abrirDrawerHerramientas(inspeccion) {
    inspeccionHerramientasAbierta = inspeccion;

    herramientasDrawerSubtitle.textContent = `${inspeccion.placa} — ${formatearFecha(inspeccion.fecha)}`;

    const responsable = `${inspeccion.inspeccionado_por_nombres || ""} ${inspeccion.inspeccionado_por_apellidos || ""}`.trim();
    const revisor = `${inspeccion.revisado_por_nombres || ""} ${inspeccion.revisado_por_apellidos || ""}`.trim();

    const filas = inspeccion.items.map((item) => `
        <tr>
            <td>${escapeHtml(item.item_label)}</td>
            <td>${item.estado === "malo" ? '<span class="badge-rojo">Malo</span>' : '<span class="badge-verde">Bueno</span>'}</td>
            <td>${item.cantidad ?? "—"}</td>
            <td>${item.fecha_vencimiento ? formatearFecha(item.fecha_vencimiento) : "—"}</td>
        </tr>
    `).join("");

    herramientasDrawerBody.innerHTML = `
        <dl class="detail-list drawer-detail-list">
            <div><dt>Vehículo</dt><dd>${escapeHtml(inspeccion.placa)} — ${escapeHtml(`${inspeccion.marca || ""} ${inspeccion.modelo || ""}`.trim())}</dd></div>
            <div><dt>Fecha</dt><dd>${formatearFecha(inspeccion.fecha)}</dd></div>
            <div><dt>Inspeccionado por</dt><dd>${escapeHtml(responsable)}${inspeccion.inspeccionado_por_cargo ? ` (${escapeHtml(inspeccion.inspeccionado_por_cargo)})` : ""}</dd></div>
            <div><dt>Revisado por</dt><dd>${revisor ? escapeHtml(revisor) : "—"}${inspeccion.revisado_por_cargo ? ` (${escapeHtml(inspeccion.revisado_por_cargo)})` : ""}</dd></div>
            <div><dt>Herramientas revisadas</dt><dd>${inspeccion.items.length}</dd></div>
            <div><dt>En mal estado</dt><dd>${inspeccion.items.filter((item) => item.estado === "malo").length}</dd></div>
        </dl>

        <div class="table-scroll">
            <table class="import-table">
                <thead><tr><th>Herramienta</th><th>Estado</th><th>Cantidad</th><th>Vencimiento</th></tr></thead>
                <tbody>${filas}</tbody>
            </table>
        </div>

        <dl class="detail-list drawer-detail-list">
            <div><dt>Observaciones generales</dt><dd>${inspeccion.observaciones ? escapeHtml(inspeccion.observaciones) : "Sin observaciones"}</dd></div>
        </dl>
    `;

    window.VehiAmb.ui.show(herramientasDrawer);
    window.VehiAmb.ui.show(herramientasDrawerBackdrop);
    herramientasDrawer.setAttribute("aria-hidden", "false");
}

function cerrarDrawerHerramientas() {
    window.VehiAmb.ui.hide(herramientasDrawer);
    window.VehiAmb.ui.hide(herramientasDrawerBackdrop);
    herramientasDrawer.setAttribute("aria-hidden", "true");
    inspeccionHerramientasAbierta = null;
}

herramientasDrawerClose?.addEventListener("click", cerrarDrawerHerramientas);
herramientasDrawerBackdrop?.addEventListener("click", cerrarDrawerHerramientas);

herramientasDrawerExportButton?.addEventListener("click", async () => {
    if (!inspeccionHerramientasAbierta) return;

    try {
        window.VehiAmb.ui.show(loader);
        await window.VehiAmb.seguridadExport.exportInspeccionHerramientasPdf(inspeccionHerramientasAbierta);
    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudo exportar el PDF", "error");
    } finally {
        window.VehiAmb.ui.hide(loader);
    }
});

herramientasTablaBody?.addEventListener("click", async (event) => {
    const verButton = event.target.closest("[data-ver-inspeccion-herramientas]");
    if (verButton) {
        try {
            window.VehiAmb.ui.show(loader);
            const inspeccion = await window.VehiAmb.api.getInspeccionHerramientas(verButton.dataset.verInspeccionHerramientas);
            abrirDrawerHerramientas(inspeccion);
        } catch (error) {
            console.error(error);
            window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudo cargar la inspección", "error");
        } finally {
            window.VehiAmb.ui.hide(loader);
        }
        return;
    }

    const eliminarButton = event.target.closest("[data-eliminar-inspeccion-herramientas]");
    if (!eliminarButton) return;

    const confirmado = await window.VehiAmb.ui.confirm({
        title: "Eliminar inspección",
        message: "Se eliminará la inspección junto con todo su checklist. Esta acción no se puede deshacer.",
        confirmText: "Eliminar"
    });
    if (!confirmado) return;

    try {
        window.VehiAmb.ui.show(loader);
        await window.VehiAmb.api.eliminarInspeccionHerramientas(eliminarButton.dataset.eliminarInspeccionHerramientas);
        window.VehiAmb.ui.showMessage(mensaje, "Inspección eliminada correctamente");
        cerrarDrawerHerramientas();
        await cargarInspeccionesHerramientas();
    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudo eliminar la inspección", "error");
    } finally {
        window.VehiAmb.ui.hide(loader);
    }
});

herramientasFilterForm?.addEventListener("submit", (event) => event.preventDefault());

filterHerramientasPlaca?.addEventListener("change", cargarInspeccionesHerramientas);
filterHerramientasDesde?.addEventListener("change", cargarInspeccionesHerramientas);
filterHerramientasHasta?.addEventListener("change", cargarInspeccionesHerramientas);
clearHerramientasFiltersButton?.addEventListener("click", () => {
    filterHerramientasPlaca.value = "";
    filterHerramientasDesde.value = "";
    filterHerramientasHasta.value = "";
    cargarInspeccionesHerramientas();
});

// ───────────────────────────── Pestañas ─────────────────────────────

function switchTab(tab) {
    const botones = {
        extintores: tabExtintoresButton,
        botiquin: tabBotiquinButton,
        herramientas: tabHerramientasButton
    };
    const bloques = {
        extintores: bloqueExtintores,
        botiquin: bloqueBotiquin,
        herramientas: bloqueHerramientas
    };

    Object.entries(botones).forEach(([nombre, boton]) => {
        const activo = nombre === tab;
        boton.classList.toggle("active", activo);
        boton.setAttribute("aria-selected", String(activo));
        bloques[nombre].classList.toggle("hidden", !activo);
    });
}

tabExtintoresButton?.addEventListener("click", () => switchTab("extintores"));
tabBotiquinButton?.addEventListener("click", () => switchTab("botiquin"));
tabHerramientasButton?.addEventListener("click", () => switchTab("herramientas"));

document.addEventListener("DOMContentLoaded", async () => {
    // Los usuarios de solo consulta ven los historiales pero no los
    // formularios de registro (mismo criterio que mantenimientos.js: se
    // eliminan del DOM, no se ocultan, para que no queden accesibles).
    if (!puedeCrear()) {
        registrarExtintorSection?.remove();
        registrarBotiquinSection?.remove();
        registrarHerramientasSection?.remove();
    } else {
        window.VehiAmb.ui.show(registrarExtintorSection);
        window.VehiAmb.ui.show(registrarBotiquinSection);
        window.VehiAmb.ui.show(registrarHerramientasSection);
    }

    try {
        window.VehiAmb.ui.show(loader);

        const vehiculos = await window.VehiAmb.api.getVehiculosCatalogo();
        fillVehicleSelect(extintorVehiculo, vehiculos);
        fillVehicleSelect(botiquinVehiculo, vehiculos);
        fillVehicleSelect(herramientasVehiculo, vehiculos);
        fillVehicleSelect(filterExtintorPlaca, vehiculos, "Todas las placas", "placa");
        fillVehicleSelect(filterBotiquinPlaca, vehiculos, "Todas las placas");
        fillVehicleSelect(filterHerramientasPlaca, vehiculos, "Todas las placas");

        if (puedeCrear()) {
            catalogoBotiquin = await window.VehiAmb.api.getCatalogoBotiquin();
            renderChecklist();
            botiquinFecha.value = new Date().toISOString().slice(0, 10);

            catalogoHerramientas = await window.VehiAmb.api.getCatalogoHerramientas();
            renderChecklistHerramientas();
            herramientasFecha.value = new Date().toISOString().slice(0, 10);
        }

        await Promise.all([cargarExtintores(), cargarInspecciones(), cargarInspeccionesHerramientas()]);
    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(mensaje, error.message || "No fue posible cargar la página", "error");
    } finally {
        window.VehiAmb.ui.hide(loader);
    }
});
