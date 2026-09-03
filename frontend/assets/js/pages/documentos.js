const documentoForm = document.getElementById("documentoForm");
const documentoFormTitle = document.getElementById("documentoFormTitle");
const documentoId = document.getElementById("documentoId");
const documentoTipo = document.getElementById("documentoTipo");
const documentoNumero = document.getElementById("documentoNumero");
const documentoNumeroLabel = document.getElementById("documentoNumeroLabel");
const documentoFechaExpedicion = document.getElementById("documentoFechaExpedicion");
const documentoFechaVencimiento = document.getElementById("documentoFechaVencimiento");
const documentoVencimientoGroup = document.getElementById("documentoVencimientoGroup");
const documentoPropietarioGroup = document.getElementById("documentoPropietarioGroup");
const documentoPropietario = document.getElementById("documentoPropietario");
const documentoSeguroAyuda = document.getElementById("documentoSeguroAyuda");
const documentoArchivoActual = document.getElementById("documentoArchivoActual");
const documentoArchivo = document.getElementById("documentoArchivo");
const documentoSubmitButton = document.getElementById("documentoSubmitButton");
const documentoCancelEditButton = document.getElementById("documentoCancelEditButton");
const tabDocumentosHistorialButton = document.getElementById("tabDocumentosHistorialButton");
const tabDocumentosRegistrarButton = document.getElementById("tabDocumentosRegistrarButton");
const tabDocumentosRenovarButton = document.getElementById("tabDocumentosRenovarButton");
const registrarDocumentoSection = document.getElementById("registrarDocumentoSection");
const renovarDocumentoSection = document.getElementById("renovarDocumentoSection");
const renovarVehiculo = document.getElementById("renovarVehiculo");
const renovarTipo = document.getElementById("renovarTipo");
const renovarArchivo = document.getElementById("renovarArchivo");
const documentosRegistradosSection = document.getElementById("documentosRegistradosSection");
const documentosFilterForm = document.getElementById("documentosFilterForm");
const documentoSelect = document.getElementById("vehiculoDocumento");
const documentosList = document.getElementById("documentosList");
const filterDocumentoBusqueda = document.getElementById("filterDocumentoBusqueda");
const filterTipoTrigger = document.getElementById("filterTipoTrigger");
const filterTipoTriggerLabel = document.getElementById("filterTipoTriggerLabel");
const filterTipoPopover = document.getElementById("filterTipoPopover");
const filterFechasTrigger = document.getElementById("filterFechasTrigger");
const filterFechasTriggerLabel = document.getElementById("filterFechasTriggerLabel");
const filterFechasPopover = document.getElementById("filterFechasPopover");
const filterDocumentoFechaDesde = document.getElementById("filterDocumentoFechaDesde");
const filterDocumentoFechaHasta = document.getElementById("filterDocumentoFechaHasta");
const documentosFilterChips = document.getElementById("documentosFilterChips");
const documentosFilterSummary = document.getElementById("documentosFilterSummary");
const clearDocumentosFiltersButton = document.getElementById("clearDocumentosFiltersButton");
const documentosKpisGrid = document.getElementById("documentosKpisGrid");
const documentoSubirInput = document.getElementById("documentoSubirInput");
const loader = document.getElementById("loader");
const mensaje = document.getElementById("mensaje");

let documentosState = [];
let vehiculosState = [];
let vencimientoEditadoManualmente = false;
let filtroTipoValue = "";
let filtroKpiActivo = null;
let subirDocumentoTargetId = null;

const ICON_CLIP = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>';
const ICON_REFRESH = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></svg>';
const ICON_UPLOAD = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m7 8 5-5 5 5"/><path d="M5 21h14"/></svg>';
const ICON_EDIT = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
const ICON_TRASH = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>';

const KPI_CHIP_LABELS = {
    vencidos: "Vencidos",
    porVencer: "Vence pronto",
    vigentes: "Vigentes",
    sinAdjunto: "Sin adjunto"
};

// Tipos que el motor de extraccion (extraccion-documentos.service.js en el
// backend) sabe leer -- el resto de tipos (seguro/licencia_transito/otro)
// siguen funcionando 100% manual, sin ningun cambio.
const TIPOS_AUTOCOMPLETABLES = ["soat", "tecnomecanica"];

// Tipos con vigencia legal fija de 1 año en Colombia: al escribir la fecha de
// expedicion se sugiere el vencimiento automaticamente, pero el usuario
// puede corregirlo (ej. polizas con vigencia distinta) sin que se le pise.
const TIPOS_VENCIMIENTO_UN_ANIO = ["tecnomecanica", "soat"];

// La licencia de transito no vence (solo tiene fecha de expedicion y numero),
// a diferencia del resto de tipos que si necesitan vencimiento.
const TIPOS_SIN_VENCIMIENTO = ["licencia_transito"];

// Catalogo fijo de los dos titulares bajo los que puede quedar registrado un
// vehiculo de la flota (mismo catalogo que valida el backend en
// documentos.service.js -- si llega a agregarse un tercero hay que actualizar
// ambos lados).
const PROPIETARIOS_CATALOGO = [
    { numero_identificacion: "830514610", label: "NIT 830514610 · AMBIENTES CERAMICOS LTDA" },
    { numero_identificacion: "79539118", label: "C.C. 79539118 · RENE OSWALDO USECHE CAMACHO" }
];

documentoPropietario.innerHTML = '<option value="">Selecciona...</option>' + PROPIETARIOS_CATALOGO.map((propietario) => `
    <option value="${propietario.numero_identificacion}">${escapeHtml(propietario.label)}</option>
`).join("");

function actualizarCamposPorTipo() {
    const sinVencimiento = TIPOS_SIN_VENCIMIENTO.includes(documentoTipo.value);

    documentoVencimientoGroup.classList.toggle("hidden", sinVencimiento);
    documentoFechaVencimiento.required = !sinVencimiento;
    if (sinVencimiento) documentoFechaVencimiento.value = "";

    documentoNumero.required = sinVencimiento;
    documentoNumeroLabel.textContent = sinVencimiento ? "Número *" : "Número";

    documentoPropietarioGroup.classList.toggle("hidden", !sinVencimiento);
    documentoPropietario.required = sinVencimiento;
    if (!sinVencimiento) documentoPropietario.value = "";

    documentoSeguroAyuda.classList.toggle("hidden", documentoTipo.value !== "seguro");
}

function calcularVencimientoUnAnio(fechaExpedicion) {
    const expedicion = new Date(`${fechaExpedicion}T00:00:00`);
    if (Number.isNaN(expedicion.getTime())) return "";

    expedicion.setFullYear(expedicion.getFullYear() + 1);
    return expedicion.toISOString().slice(0, 10);
}

function autocompletarVencimiento() {
    if (vencimientoEditadoManualmente) return;
    if (!TIPOS_VENCIMIENTO_UN_ANIO.includes(documentoTipo.value)) return;
    if (!documentoFechaExpedicion.value) return;

    documentoFechaVencimiento.value = calcularVencimientoUnAnio(documentoFechaExpedicion.value);
}

function resetForm() {
    documentoForm.reset();
    documentoId.value = "";
    vencimientoEditadoManualmente = false;
    documentoFormTitle.textContent = "Registrar documento";
    documentoSubmitButton.textContent = "Guardar documento";
    documentoCancelEditButton.classList.add("hidden");
    documentoArchivoActual.classList.add("hidden");
    documentoArchivoActual.innerHTML = "";
    actualizarCamposPorTipo();
}

const tiposDocumento = {
    tecnomecanica: "RTM",
    soat: "SOAT",
    seguro: "Póliza Seguro",
    licencia_transito: "Licencia de tránsito",
    otro: "Otro"
};

function formatDate(value) {
    if (!value) return "Sin fecha";

    const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
    if (Number.isNaN(date.getTime())) return "Sin fecha";

    return date.toLocaleDateString("es-CO", {
        day: "2-digit",
        month: "short",
        year: "numeric"
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

// Centraliza el calculo de estado (dias/color/texto) que antes se repetia
// en el pill y ahora tambien alimenta la barra de vigencia -- un solo lugar
// para decidir que es "vencido"/"por vencer"/"vigente".
function estadoVigencia(item) {
    const dias = daysUntil(item.fecha_vencimiento);

    if (dias === null) return { dias, estado: "neutral", texto: "Sin fecha" };
    if (dias < 0) return { dias, estado: "danger", texto: `Vencido hace ${Math.abs(dias)} días` };
    if (dias <= 30) return { dias, estado: "warning", texto: `Vence en ${dias} días` };
    return { dias, estado: "success", texto: `Vence en ${dias} días` };
}

// La licencia de transito no tiene vencimiento (solo expedicion + titular),
// asi que en vez del rango se muestra esa info -- para el resto se colapsan
// expedicion/vencimiento en un solo rango en vez de dos badges separados.
function formatDateRange(item) {
    if (item.tipo === "licencia_transito") {
        const titular = [item.propietario_tipo_identificacion, item.propietario_numero_identificacion]
            .filter(Boolean).join(" ");
        const nombre = item.propietario_nombre ? ` · ${item.propietario_nombre}` : "";
        return `Expedición: ${formatDate(item.fecha_expedicion)}${titular ? ` · Propietario: ${titular}${nombre}` : ""}`;
    }

    if (!item.fecha_expedicion) return `Vencimiento: ${formatDate(item.fecha_vencimiento)}`;

    return `${formatDate(item.fecha_expedicion)} → ${formatDate(item.fecha_vencimiento)}`;
}

// Que tanto del periodo expedicion->vencimiento ya se consumio, para la
// barra de lectura periferica -- null cuando no hay ambas fechas (ej.
// licencia de transito) y ahi no se dibuja barra.
function vigenciaBarInfo(item) {
    if (!item.fecha_expedicion || !item.fecha_vencimiento) return null;

    const inicio = new Date(`${String(item.fecha_expedicion).slice(0, 10)}T00:00:00`).getTime();
    const fin = new Date(`${String(item.fecha_vencimiento).slice(0, 10)}T00:00:00`).getTime();
    if (Number.isNaN(inicio) || Number.isNaN(fin) || fin <= inicio) return null;

    const { dias, estado } = estadoVigencia(item);
    const pct = dias < 0 ? 100 : Math.max(0, Math.min(100, ((Date.now() - inicio) / (fin - inicio)) * 100));

    return { pct, estado };
}

function fillVehicleSelect(select, vehiculos, placeholder = "Selecciona un vehículo", valueField = "id") {
    const previousValue = select.value;
    select.innerHTML = `<option value="">${placeholder}</option>`;

    if (!vehiculos.length) {
        select.innerHTML = '<option value="">Primero registra un vehículo</option>';
        return;
    }

    vehiculos.forEach((vehiculo) => {
        const option = document.createElement("option");
        option.value = vehiculo[valueField] || "";
        option.textContent = `${vehiculo.placa} - ${vehiculo.marca} ${vehiculo.modelo}`;
        select.appendChild(option);
    });

    if (previousValue && Array.from(select.options).some((option) => option.value === previousValue)) {
        select.value = previousValue;
    }
}

function ordenarPorUrgencia(documentos) {
    return [...documentos].sort((a, b) => {
        const daysA = daysUntil(a.fecha_vencimiento);
        const daysB = daysUntil(b.fecha_vencimiento);
        if (daysA === null && daysB === null) return 0;
        if (daysA === null) return 1;
        if (daysB === null) return -1;
        return daysA - daysB;
    });
}

function calcularKpisDocumentos(documentos) {
    return documentos.reduce((acc, item) => {
        if (!item.archivo_url) acc.sinAdjunto += 1;

        const { dias } = estadoVigencia(item);
        if (dias === null) return acc;
        if (dias < 0) acc.vencidos += 1;
        else if (dias <= 30) acc.porVencer += 1;
        else acc.vigentes += 1;
        return acc;
    }, { vencidos: 0, porVencer: 0, vigentes: 0, sinAdjunto: 0 });
}

function renderKpisDocumentos(documentos) {
    const kpis = calcularKpisDocumentos(documentos);
    const cards = [
        { key: "vencidos", label: "Vencidos", value: kpis.vencidos, accent: "var(--color-primary)", sub: "acción inmediata" },
        { key: "porVencer", label: "Por vencer · 30 días", value: kpis.porVencer, accent: "var(--color-warning)", sub: "programar renovación" },
        { key: "vigentes", label: "Vigentes", value: kpis.vigentes, accent: "var(--color-success)", sub: "sin novedad" },
        { key: "sinAdjunto", label: "Sin adjunto", value: kpis.sinAdjunto, accent: "var(--color-ink-soft)", sub: "falta soporte" }
    ];

    // Cada tarjeta es un filtro (data-kpi-filtro), no solo un numero -- un
    // clic filtra la lista a ese grupo, otro clic la quita.
    documentosKpisGrid.innerHTML = cards.map((card) => `
        <button type="button" class="kpi-card kpi-card-clickable ${filtroKpiActivo === card.key ? "is-active" : ""}" style="--kpi-accent: ${card.accent}" data-kpi-filtro="${card.key}" title="Ver solo: ${card.label.toLowerCase()}">
            <div class="kpi-label">${card.label}</div>
            <div class="kpi-value">${card.value}</div>
            <div class="kpi-sub">${card.sub}</div>
        </button>
    `).join("");
}

function renderDocumentos(documentos) {
    if (!documentos.length) {
        documentosList.innerHTML = `
            <div class="doc-empty-state">
                <p class="doc-empty-title">No hay documentos para estos filtros</p>
                <p class="doc-empty-sub">Ajusta la búsqueda o quita algún filtro para ver más resultados.</p>
                <button type="button" class="btn-secondary" data-clear-filters>Limpiar filtros</button>
            </div>
        `;
        return;
    }

    const puedeEditar = window.VehiAmb.auth.hasPermission("documents.create");
    const puedeEliminar = window.VehiAmb.auth.hasPermission("documents.delete");

    documentosList.innerHTML = ordenarPorUrgencia(documentos).map((item) => {
        const { estado, texto } = estadoVigencia(item);
        const pillClass = estado === "danger" ? "pill-danger" : estado === "warning" ? "pill-warning" : estado === "success" ? "pill-success" : "";
        const barra = vigenciaBarInfo(item);

        const acciones = [];
        if (item.archivo_url) {
            acciones.push(`<a class="doc-action-link" href="${escapeHtml(window.VehiAmb.api.getAssetUrl(item.archivo_url))}" target="_blank" rel="noreferrer">${ICON_CLIP}PDF</a>`);
            if (puedeEditar && TIPOS_AUTOCOMPLETABLES.includes(item.tipo)) {
                acciones.push(`<button type="button" class="doc-action-link" data-subir-documento="${item.id}">${ICON_REFRESH}Renovar</button>`);
            }
        } else if (puedeEditar) {
            acciones.push(`<button type="button" class="doc-action-link" data-subir-documento="${item.id}">${ICON_UPLOAD}Subir</button>`);
        }
        if (puedeEditar) {
            acciones.push(`<button type="button" class="doc-action-link" data-editar-documento="${item.id}" aria-label="Editar">${ICON_EDIT}</button>`);
        }
        if (puedeEliminar) {
            acciones.push(`<button type="button" class="doc-action-link doc-action-danger" data-eliminar-documento="${item.id}" aria-label="Eliminar">${ICON_TRASH}</button>`);
        }

        return `
            <article class="doc-row ${estado === "danger" ? "is-vencido" : ""}">
                <div class="doc-row-head">
                    <span class="plate">${escapeHtml(item.placa) || "—"}</span>
                    <div class="doc-row-title">
                        <span class="doc-type-label">${escapeHtml(tiposDocumento[item.tipo] || item.tipo)}</span>
                        <span class="doc-number-label">${escapeHtml(item.numero_documento) || "Sin número"}</span>
                    </div>
                    <span class="pill ${pillClass}">${texto}</span>
                </div>
                ${item.tipo === "seguro" ? `<p class="field-help field-help-danger">Llama al #324 para atención de siniestros viales.</p>` : ""}
                ${barra ? `<div class="doc-vigencia-track"><div class="doc-vigencia-fill doc-vigencia-${barra.estado}" style="width:${barra.pct}%"></div></div>` : ""}
                <div class="doc-row-foot">
                    <span class="doc-date-range">${formatDateRange(item)}</span>
                    ${acciones.length ? `<div class="doc-row-actions">${acciones.join("")}</div>` : ""}
                </div>
            </article>
        `;
    }).join("");
}

function documentMatchesFilters(item) {
    const busqueda = filterDocumentoBusqueda.value.trim().toLowerCase();
    const fechaDesde = filterDocumentoFechaDesde.value;
    const fechaHasta = filterDocumentoFechaHasta.value;
    const itemFecha = String(item.fecha_vencimiento || "").slice(0, 10);

    if (busqueda) {
        const enPlaca = String(item.placa || "").toLowerCase().includes(busqueda);
        const enNumero = String(item.numero_documento || "").toLowerCase().includes(busqueda);
        if (!enPlaca && !enNumero) return false;
    }
    if (filtroTipoValue && item.tipo !== filtroTipoValue) return false;
    if (fechaDesde && (!itemFecha || itemFecha < fechaDesde)) return false;
    if (fechaHasta && (!itemFecha || itemFecha > fechaHasta)) return false;

    if (filtroKpiActivo) {
        const { dias } = estadoVigencia(item);
        if (filtroKpiActivo === "vencidos" && !(dias !== null && dias < 0)) return false;
        if (filtroKpiActivo === "porVencer" && !(dias !== null && dias >= 0 && dias <= 30)) return false;
        if (filtroKpiActivo === "vigentes" && !(dias !== null && dias > 30)) return false;
        if (filtroKpiActivo === "sinAdjunto" && item.archivo_url) return false;
    }

    return true;
}

function hayFiltrosActivos() {
    return Boolean(
        filterDocumentoBusqueda.value ||
        filtroTipoValue ||
        filterDocumentoFechaDesde.value ||
        filterDocumentoFechaHasta.value ||
        filtroKpiActivo
    );
}

function updateDocumentosFilterSummary(filteredCount) {
    const total = documentosState.length;

    if (!total) {
        documentosFilterSummary.textContent = "Aún no hay documentos registrados.";
    } else {
        documentosFilterSummary.textContent = hayFiltrosActivos()
            ? `${filteredCount} de ${total} documentos · ordenados por urgencia`
            : `${total} documentos · ordenados por urgencia`;
    }

    renderDocumentosFilterChips();
}

// Cada filtro activo (menos la busqueda, que ya se ve escrita en el campo)
// queda como una chip removible -- asi se ve de un vistazo que hay aplicado
// sin tener que abrir cada popover.
function renderDocumentosFilterChips() {
    const chips = [];

    if (filtroTipoValue) {
        chips.push({ id: "tipo", label: tiposDocumento[filtroTipoValue] || filtroTipoValue });
    }
    if (filterDocumentoFechaDesde.value || filterDocumentoFechaHasta.value) {
        const desde = filterDocumentoFechaDesde.value ? formatDate(filterDocumentoFechaDesde.value) : "…";
        const hasta = filterDocumentoFechaHasta.value ? formatDate(filterDocumentoFechaHasta.value) : "…";
        chips.push({ id: "fechas", label: `${desde} → ${hasta}` });
    }
    if (filtroKpiActivo) {
        chips.push({ id: "kpi", label: KPI_CHIP_LABELS[filtroKpiActivo] });
    }

    documentosFilterChips.classList.toggle("hidden", chips.length === 0);
    documentosFilterChips.innerHTML = chips.map((chip) => `
        <span class="pill">${escapeHtml(chip.label)} <button type="button" class="pill-remove" data-remove-chip="${chip.id}" aria-label="Quitar filtro">×</button></span>
    `).join("");
}

function updateTipoTriggerLabel() {
    filterTipoTriggerLabel.textContent = filtroTipoValue ? (tiposDocumento[filtroTipoValue] || filtroTipoValue) : "Tipo";
    filterTipoTrigger.classList.toggle("is-active", Boolean(filtroTipoValue));
    filterTipoPopover.querySelectorAll("[data-tipo-value]").forEach((boton) => {
        boton.classList.toggle("is-active", boton.dataset.tipoValue === filtroTipoValue);
    });
}

function updateFechasTriggerLabel() {
    const hayFecha = filterDocumentoFechaDesde.value || filterDocumentoFechaHasta.value;
    filterFechasTriggerLabel.textContent = "Fechas";
    filterFechasTrigger.classList.toggle("is-active", Boolean(hayFecha));
}

function applyDocumentosFilters() {
    const filtered = documentosState.filter(documentMatchesFilters);
    renderDocumentos(filtered);
    renderKpisDocumentos(filtered);
    updateDocumentosFilterSummary(filtered.length);
}

async function cargarDatos() {
    try {
        window.VehiAmb.ui.show(loader);

        const vehiculos = await window.VehiAmb.api.getVehiculosCatalogo();
        vehiculosState = vehiculos;
        fillVehicleSelect(documentoSelect, vehiculos);
        fillVehicleSelect(renovarVehiculo, vehiculos);
    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(mensaje, "No fue posible cargar los vehículos", "error");
        window.VehiAmb.ui.hide(loader);
        return;
    }

    try {
        const documentos = await window.VehiAmb.api.getDocumentos();
        documentosState = documentos;
        applyDocumentosFilters();
    } catch (error) {
        console.error(error);
        documentosList.innerHTML = '<p class="dash-empty">No fue posible cargar los documentos</p>';
        updateDocumentosFilterSummary(0);
        window.VehiAmb.ui.showMessage(mensaje, "Los vehículos cargaron, pero no fue posible cargar los documentos", "error");
    } finally {
        window.VehiAmb.ui.hide(loader);
    }
}

function switchTab(tab) {
    const botones = {
        historial: tabDocumentosHistorialButton,
        registrar: tabDocumentosRegistrarButton,
        renovar: tabDocumentosRenovarButton
    };
    const secciones = {
        historial: documentosRegistradosSection,
        registrar: registrarDocumentoSection,
        renovar: renovarDocumentoSection
    };

    Object.entries(botones).forEach(([nombre, boton]) => {
        const activo = nombre === tab;
        boton.classList.toggle("active", activo);
        boton.setAttribute("aria-selected", String(activo));
        window.VehiAmb.ui[activo ? "show" : "hide"](secciones[nombre]);
    });
}

tabDocumentosHistorialButton.addEventListener("click", () => switchTab("historial"));
tabDocumentosRegistrarButton.addEventListener("click", () => switchTab("registrar"));
tabDocumentosRenovarButton.addEventListener("click", () => switchTab("renovar"));

documentoTipo.addEventListener("change", () => {
    actualizarCamposPorTipo();
    autocompletarVencimiento();
});
documentoFechaExpedicion.addEventListener("change", autocompletarVencimiento);
documentoFechaVencimiento.addEventListener("input", () => {
    vencimientoEditadoManualmente = true;
});

function abrirEdicionDocumento(item) {
    documentoId.value = item.id;
    documentoSelect.value = item.vehiculo_id;
    documentoTipo.value = item.tipo;
    actualizarCamposPorTipo();
    documentoForm.querySelector('[name="numero_documento"]').value = item.numero_documento || "";
    documentoFechaExpedicion.value = String(item.fecha_expedicion || "").slice(0, 10);
    documentoFechaVencimiento.value = String(item.fecha_vencimiento || "").slice(0, 10);
    documentoPropietario.value = item.propietario_numero_identificacion || "";
    vencimientoEditadoManualmente = true;

    if (item.archivo_url) {
        const archivoUrl = window.VehiAmb.api.getAssetUrl(item.archivo_url);
        documentoArchivoActual.innerHTML = `Archivo actual: <a href="${escapeHtml(archivoUrl)}" target="_blank" rel="noreferrer">${escapeHtml(item.archivo_nombre || "ver archivo")}</a> (sube uno nuevo para reemplazarlo)`;
        documentoArchivoActual.classList.remove("hidden");
    } else {
        documentoArchivoActual.classList.add("hidden");
        documentoArchivoActual.innerHTML = "";
    }

    documentoFormTitle.textContent = "Editar documento";
    documentoSubmitButton.textContent = "Guardar cambios";
    documentoCancelEditButton.classList.remove("hidden");
    switchTab("registrar");
    documentoForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

documentosList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-editar-documento]");
    if (!button) return;

    const item = documentosState.find((doc) => String(doc.id) === button.dataset.editarDocumento);
    if (!item) return;

    abrirEdicionDocumento(item);
});

documentoCancelEditButton.addEventListener("click", resetForm);

documentosList.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-eliminar-documento]");
    if (!button) return;

    const item = documentosState.find((doc) => String(doc.id) === button.dataset.eliminarDocumento);
    if (!item) return;

    const confirmado = await window.VehiAmb.ui.confirm({
        title: "Eliminar documento",
        message: `Se eliminará el documento "${tiposDocumento[item.tipo] || item.tipo}" de ${item.placa || "este vehículo"} (${item.numero_documento || "sin número"}). Esta acción no se puede deshacer.`,
        confirmText: "Eliminar"
    });
    if (!confirmado) return;

    try {
        window.VehiAmb.ui.show(loader);
        await window.VehiAmb.api.deleteDocumento(item.id);
        window.VehiAmb.ui.showMessage(mensaje, "Documento eliminado correctamente");
        if (documentoId.value === String(item.id)) resetForm();
        await cargarDatos();
    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudo eliminar el documento", "error");
    } finally {
        window.VehiAmb.ui.hide(loader);
    }
});

documentoForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(documentoForm);

    try {
        window.VehiAmb.ui.show(loader);

        if (documentoId.value) {
            await window.VehiAmb.api.updateDocumento(documentoId.value, formData);
            window.VehiAmb.ui.showMessage(mensaje, "Documento actualizado correctamente");
        } else {
            await window.VehiAmb.api.createDocumento(formData);
            window.VehiAmb.ui.showMessage(mensaje, "Documento guardado correctamente");
        }

        resetForm();
        await cargarDatos();
        switchTab("historial");
    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(mensaje, error.message || "Error al guardar el documento", "error");
    } finally {
        window.VehiAmb.ui.hide(loader);
    }
});

// Mismo criterio de comparacion que vehiculosRepository.findByPlaca en el
// backend (insensible a mayusculas y guiones).
function normalizarPlaca(placa) {
    return String(placa || "").toUpperCase().replace(/-/g, "");
}

// Si el tipo es soat/tecnomecanica, en vez de esperar a que el usuario
// escriba numero/fechas a mano, se leen del archivo y se guarda solo. Si
// falto leer algo o la placa del archivo no coincide con el vehiculo ya
// seleccionado, NO se autoguarda -- se llena lo que si se pudo leer y se le
// pide al usuario que revise/complete a mano (evita guardar datos
// incompletos o en el vehiculo equivocado sin que nadie se de cuenta).
async function intentarAutoCompletarDesdeArchivo(file) {
    if (!TIPOS_AUTOCOMPLETABLES.includes(documentoTipo.value)) return;
    if (!documentoSelect.value) {
        window.VehiAmb.ui.showMessage(mensaje, "Selecciona primero el vehículo para poder autocompletar", "error");
        documentoArchivo.value = "";
        return;
    }

    const formData = new FormData();
    formData.append("tipo", documentoTipo.value);
    formData.append("archivo", file);

    // El loader se maneja a mano en vez de con try/finally: requestSubmit()
    // al final dispara el handler de submit, que muestra/oculta el loader
    // por su cuenta durante el guardado -- si aqui lo ocultaramos en un
    // finally, se ocultaria de inmediato mientras el guardado sigue en
    // curso en segundo plano (requestSubmit no espera a que termine).
    window.VehiAmb.ui.show(loader);

    let campos;
    try {
        campos = await window.VehiAmb.api.extraerDatosDocumento(formData);
    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudo leer el archivo", "error");
        documentoArchivo.value = "";
        window.VehiAmb.ui.hide(loader);
        return;
    }

    if (campos.numero_documento) documentoNumero.value = campos.numero_documento;
    if (campos.fecha_expedicion) documentoFechaExpedicion.value = campos.fecha_expedicion.slice(0, 10);
    if (campos.fecha_vencimiento) {
        documentoFechaVencimiento.value = campos.fecha_vencimiento.slice(0, 10);
        vencimientoEditadoManualmente = true;
    }

    const camposFaltantes = (campos.campos_faltantes || []).filter((campo) => campo !== "placa");
    if (camposFaltantes.length) {
        window.VehiAmb.ui.hide(loader);
        window.VehiAmb.ui.showMessage(mensaje, `No se pudieron leer todos los datos del archivo (falta: ${camposFaltantes.join(", ")}). Completa el resto y guarda manualmente.`, "error");
        // Los campos que si se leyeron quedaron en el formulario de
        // "Registrar documento" -- si el disparo vino de la pestana
        // "Renovar" (mas simple, sin esos campos visibles), se cambia ahi
        // para que el usuario vea y complete lo que falta.
        switchTab("registrar");
        return;
    }

    const vehiculoSeleccionado = vehiculosState.find((vehiculo) => String(vehiculo.id) === documentoSelect.value);
    if (campos.placa && vehiculoSeleccionado && normalizarPlaca(campos.placa) !== normalizarPlaca(vehiculoSeleccionado.placa)) {
        window.VehiAmb.ui.hide(loader);
        window.VehiAmb.ui.showMessage(mensaje, `La placa del archivo (${campos.placa}) no coincide con el vehículo seleccionado (${vehiculoSeleccionado.placa}). Verifica que sea el archivo correcto.`, "error");
        switchTab("registrar");
        return;
    }

    window.VehiAmb.ui.hide(loader);
    documentoForm.requestSubmit();
}

documentoArchivo.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (file) intentarAutoCompletarDesdeArchivo(file);
});

// "Renovar documento" es un atajo mas simple al mismo flujo: solo pide
// vehiculo + tipo (soat/tecnomecanica) + archivo. Al elegir el archivo,
// vuelca esos dos valores al formulario completo (oculto en esta pestana)
// y reutiliza exactamente la misma logica de autocompletar/autoguardar --
// sin duplicar la extraccion ni el chequeo de placa.
renovarArchivo.addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!renovarVehiculo.value) {
        window.VehiAmb.ui.showMessage(mensaje, "Selecciona primero el vehículo para poder renovar", "error");
        renovarArchivo.value = "";
        return;
    }

    documentoId.value = "";
    documentoSelect.value = renovarVehiculo.value;
    documentoTipo.value = renovarTipo.value;
    vencimientoEditadoManualmente = false;
    actualizarCamposPorTipo();

    await intentarAutoCompletarDesdeArchivo(file);
    renovarArchivo.value = "";
});

documentosFilterForm.addEventListener("submit", (event) => {
    event.preventDefault();
});

filterDocumentoBusqueda.addEventListener("input", applyDocumentosFilters);

[filterDocumentoFechaDesde, filterDocumentoFechaHasta].forEach((input) => {
    input.addEventListener("input", () => {
        updateFechasTriggerLabel();
        applyDocumentosFilters();
    });
});

clearDocumentosFiltersButton.addEventListener("click", () => {
    filterDocumentoBusqueda.value = "";
    filterDocumentoFechaDesde.value = "";
    filterDocumentoFechaHasta.value = "";
    filtroTipoValue = "";
    filtroKpiActivo = null;
    updateTipoTriggerLabel();
    updateFechasTriggerLabel();
    applyDocumentosFilters();
});

// Delegado en el contenedor (no en cada card) porque renderKpisDocumentos
// reconstruye el HTML de las kpis en cada filtro -- un listener puesto
// directo en la card se perderia al re-renderizar. Cada tarjeta es su
// propio filtro (no solo "vencidos" como antes) y se excluyen entre si --
// clickear otra reemplaza la activa, clickear la misma la quita.
documentosKpisGrid.addEventListener("click", (event) => {
    const boton = event.target.closest("[data-kpi-filtro]");
    if (!boton) return;

    const key = boton.dataset.kpiFiltro;
    filtroKpiActivo = filtroKpiActivo === key ? null : key;
    applyDocumentosFilters();
    switchTab("historial");
});

// Popovers de Tipo/Fechas: mismo patron de abrir-uno-cierra-los-demas y
// cerrar al hacer clic afuera, sin depender de <select> nativos para poder
// mostrar el gatillo como boton con la seleccion actual.
function cerrarPopoversFiltro() {
    filterTipoPopover.classList.add("hidden");
    filterFechasPopover.classList.add("hidden");
}

filterTipoTrigger.addEventListener("click", (event) => {
    event.stopPropagation();
    const estabaAbierto = !filterTipoPopover.classList.contains("hidden");
    cerrarPopoversFiltro();
    filterTipoPopover.classList.toggle("hidden", estabaAbierto);
});

filterFechasTrigger.addEventListener("click", (event) => {
    event.stopPropagation();
    const estabaAbierto = !filterFechasPopover.classList.contains("hidden");
    cerrarPopoversFiltro();
    filterFechasPopover.classList.toggle("hidden", estabaAbierto);
});

document.addEventListener("click", (event) => {
    if (!event.target.closest(".doc-filter-popover-wrap")) cerrarPopoversFiltro();
});

filterTipoPopover.addEventListener("click", (event) => {
    const opcion = event.target.closest("[data-tipo-value]");
    if (!opcion) return;

    filtroTipoValue = opcion.dataset.tipoValue;
    updateTipoTriggerLabel();
    cerrarPopoversFiltro();
    applyDocumentosFilters();
});

documentosFilterChips.addEventListener("click", (event) => {
    const boton = event.target.closest("[data-remove-chip]");
    if (!boton) return;

    if (boton.dataset.removeChip === "tipo") {
        filtroTipoValue = "";
        updateTipoTriggerLabel();
    } else if (boton.dataset.removeChip === "fechas") {
        filterDocumentoFechaDesde.value = "";
        filterDocumentoFechaHasta.value = "";
        updateFechasTriggerLabel();
    } else if (boton.dataset.removeChip === "kpi") {
        filtroKpiActivo = null;
    }

    applyDocumentosFilters();
});

documentosList.addEventListener("click", (event) => {
    if (event.target.closest("[data-clear-filters]")) clearDocumentosFiltersButton.click();
});

// "Subir"/"Renovar" desde la fila: sube el archivo directo sin pasar por el
// formulario completo. Si el tipo es autocompletable (soat/tecnomecanica) se
// extrae y valida placa igual que en el formulario -- si no, se adjunta tal
// cual (ej. poliza de seguro). Siempre se reconstruye el registro completo
// (no solo el archivo) porque updateDocumento espera el payload entero, no
// un parche parcial.
documentosList.addEventListener("click", (event) => {
    const boton = event.target.closest("[data-subir-documento]");
    if (!boton) return;

    subirDocumentoTargetId = boton.dataset.subirDocumento;
    documentoSubirInput.value = "";
    documentoSubirInput.click();
});

documentoSubirInput.addEventListener("change", async (event) => {
    const file = event.target.files[0];
    const targetId = subirDocumentoTargetId;
    subirDocumentoTargetId = null;
    if (!file || !targetId) return;

    const item = documentosState.find((doc) => String(doc.id) === targetId);
    if (!item) return;

    function construirFormData(camposExtraidos) {
        const formData = new FormData();
        formData.set("vehiculo_id", item.vehiculo_id);
        formData.set("tipo", item.tipo);
        formData.set("numero_documento", camposExtraidos?.numero_documento || item.numero_documento || "");
        formData.set("fecha_expedicion", String(camposExtraidos?.fecha_expedicion || item.fecha_expedicion || "").slice(0, 10));
        formData.set("fecha_vencimiento", String(camposExtraidos?.fecha_vencimiento || item.fecha_vencimiento || "").slice(0, 10));
        if (item.propietario_numero_identificacion) {
            formData.set("propietario_numero_identificacion", item.propietario_numero_identificacion);
        }
        formData.set("archivo", file);
        return formData;
    }

    window.VehiAmb.ui.show(loader);

    try {
        if (TIPOS_AUTOCOMPLETABLES.includes(item.tipo)) {
            const extraccionForm = new FormData();
            extraccionForm.append("tipo", item.tipo);
            extraccionForm.append("archivo", file);
            const campos = await window.VehiAmb.api.extraerDatosDocumento(extraccionForm);

            const camposFaltantes = (campos.campos_faltantes || []).filter((campo) => campo !== "placa");
            if (camposFaltantes.length) {
                window.VehiAmb.ui.showMessage(mensaje, `No se pudieron leer todos los datos del archivo (falta: ${camposFaltantes.join(", ")}). Edita el documento para completarlo a mano.`, "error");
                return;
            }
            if (campos.placa && normalizarPlaca(campos.placa) !== normalizarPlaca(item.placa)) {
                window.VehiAmb.ui.showMessage(mensaje, `La placa del archivo (${campos.placa}) no coincide con este vehículo (${item.placa}). Verifica que sea el archivo correcto.`, "error");
                return;
            }

            await window.VehiAmb.api.updateDocumento(item.id, construirFormData(campos));
        } else {
            await window.VehiAmb.api.updateDocumento(item.id, construirFormData());
        }

        window.VehiAmb.ui.showMessage(mensaje, "Documento actualizado correctamente");
        await cargarDatos();
    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudo actualizar el documento", "error");
    } finally {
        window.VehiAmb.ui.hide(loader);
    }
});

document.addEventListener("DOMContentLoaded", async () => {
    await window.VehiAmb.auth.fetchCurrentUser();

    if (!window.VehiAmb.auth.hasPermission("documents.create")) {
        tabDocumentosRegistrarButton?.classList.add("hidden");
        tabDocumentosRenovarButton?.classList.add("hidden");
    }

    await cargarDatos();

    // Llegada desde la ficha de un vehiculo ("Renovar"/"Agregar documento" en
    // vehiculo.html) -- precarga la busqueda con la placa para no obligar a
    // volver a escribirla.
    const buscarParam = new URLSearchParams(window.location.search).get("buscar");
    if (buscarParam) {
        filterDocumentoBusqueda.value = buscarParam;
        applyDocumentosFilters();
    }

    // Llegada desde una notificacion ("Renovar documento") -- abre de una
    // vez el formulario de edicion de ese documento puntual.
    const documentoIdParam = new URLSearchParams(window.location.search).get("documento_id");
    if (documentoIdParam && window.VehiAmb.auth.hasPermission("documents.create")) {
        const item = documentosState.find((doc) => String(doc.id) === documentoIdParam);
        if (item) abrirEdicionDocumento(item);
    }
});
