const loader = document.getElementById("loader");
const mensaje = document.getElementById("mensaje");
const vehicleHero = document.getElementById("vehicleHero");
const vehicleDetail = document.getElementById("vehicleDetail");
const vehicleRecords = document.getElementById("vehicleRecords");
const vehicleTitle = document.getElementById("vehicleTitle");
const vehicleSubtitle = document.getElementById("vehicleSubtitle");
const vehiclePlate = document.getElementById("vehiclePlate");
const vehicleName = document.getElementById("vehicleName");
const vehicleCode = document.getElementById("vehicleCode");
const vehicleKm = document.getElementById("vehicleKm");
const vehicleFacts = document.getElementById("vehicleFacts");
const maintenanceList = document.getElementById("vehicleMaintenanceList");
const documentList = document.getElementById("vehicleDocumentList");
const documentosResumen = document.getElementById("vehicleVencimientosResumen");
const vehicleViajesSection = document.getElementById("vehicleViajesSection");
const vehicleViajesList = document.getElementById("vehicleViajesList");
const vehicleSimitSection = document.getElementById("vehicleSimitSection");
const vehicleSimitBody = document.getElementById("vehicleSimitBody");
const consultarSimitButton = document.getElementById("consultarSimitButton");
const exportHojaVidaButton = document.getElementById("exportHojaVidaButton");
const editVehicleLink = document.getElementById("editVehicleLink");
const registrarMantenimientoLink = document.getElementById("registrarMantenimientoLink");
const vehicleRepuestosSugeridosSection = document.getElementById("vehicleRepuestosSugeridosSection");
const repuestoSugeridoIntervaloKm = document.getElementById("repuestoSugeridoIntervaloKm");
const repuestoSugeridoInput = document.getElementById("repuestoSugeridoInput");
const repuestoSugeridoCantidadInput = document.getElementById("repuestoSugeridoCantidadInput");
const addRepuestoSugeridoButton = document.getElementById("addRepuestoSugeridoButton");
const repuestoSugeridoSeleccionadoInfo = document.getElementById("repuestoSugeridoSeleccionadoInfo");
const repuestosSugeridosList = document.getElementById("repuestosSugeridosList");
const repuestosSugeridosEmpty = document.getElementById("repuestosSugeridosEmpty");
const guardarRepuestosSugeridosButton = document.getElementById("guardarRepuestosSugeridosButton");

const tiposMantenimiento = {
    revision: "Revisión general",
    preventivo: "Preventivo",
    correctivo: "Correctivo",
    cambio_aceite: "Cambio de aceite",
    frenos: "Frenos",
    llantas: "Llantas",
    otro: "Otro"
};

const tiposDocumento = {
    tecnomecanica: "RTM",
    soat: "SOAT",
    seguro: "Póliza Seguro",
    licencia_transito: "Licencia de tránsito",
    otro: "Otro"
};

// Tipos que todo vehiculo deberia tener registrados -- "otro" queda fuera
// por ser un catalogo libre, no tiene sentido pedirlo como "faltante".
const TIPOS_DOCUMENTO_REQUERIDOS = ["soat", "tecnomecanica", "seguro", "licencia_transito"];

// Mismo catalogo que documentos.js: tipos que el motor de extraccion sabe
// leer solo al subir el archivo.
const TIPOS_AUTOCOMPLETABLES = ["soat", "tecnomecanica"];

const ICON_CLIP = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>';
const ICON_REFRESH = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></svg>';
const ICON_UPLOAD = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m7 8 5-5 5 5"/><path d="M5 21h14"/></svg>';

const ESTADO_SIMIT_LABELS = {
    nunca_consultado: "Nunca consultado",
    sin_multas: "Sin multas",
    con_multas: "Con multas",
    cobro_coactivo: "Cobro coactivo",
    acuerdo_pago: "Acuerdo de pago",
    desconocido: "Desconocido / error"
};

const ESTADO_SIMIT_PILL_CLASS = {
    nunca_consultado: "pill",
    sin_multas: "pill-success",
    con_multas: "pill-danger",
    cobro_coactivo: "pill-danger",
    acuerdo_pago: "pill-warning",
    desconocido: "pill"
};

let currentVehicleId = "";
let currentVehiculo = null;
let currentMantenimientos = [];
let currentDocumentos = [];
let currentSimit = null;
let repuestosSugeridosState = [];
let repuestoSugeridoSeleccionado = null;

function formatKm(value) {
    return `${Number(value || 0).toLocaleString("es-CO", { maximumFractionDigits: 2 })} km`;
}

function formatCurrency(value) {
    return new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        maximumFractionDigits: 0
    }).format(Number(value || 0));
}

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

function formatDateTime(value) {
    if (!value) return "Nunca";
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

// Mismo criterio que documentos.js: un solo lugar para decidir que es
// "vencido"/"por vencer"/"vigente", reutilizado por el pill y la barra.
function estadoVigencia(item) {
    const dias = daysUntil(item.fecha_vencimiento);

    if (dias === null) return { dias, estado: "neutral", texto: "Sin fecha" };
    if (dias < 0) return { dias, estado: "danger", texto: `Vencido hace ${Math.abs(dias)} días` };
    if (dias <= 30) return { dias, estado: "warning", texto: `Vence en ${dias} días` };
    return { dias, estado: "success", texto: `Vence en ${dias} días` };
}

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

function vigenciaBarInfo(item) {
    if (!item.fecha_expedicion || !item.fecha_vencimiento) return null;

    const inicio = new Date(`${String(item.fecha_expedicion).slice(0, 10)}T00:00:00`).getTime();
    const fin = new Date(`${String(item.fecha_vencimiento).slice(0, 10)}T00:00:00`).getTime();
    if (Number.isNaN(inicio) || Number.isNaN(fin) || fin <= inicio) return null;

    const { dias, estado } = estadoVigencia(item);
    const pct = dias < 0 ? 100 : Math.max(0, Math.min(100, ((Date.now() - inicio) / (fin - inicio)) * 100));

    return { pct, estado };
}

function parseRepuestos(value) {
    if (!value) return [];

    if (Array.isArray(value)) {
        return value
            .filter(Boolean)
            .map((item) => {
                if (typeof item === "string") {
                    return { repuesto: item.trim(), proveedor: "", valor: "", notas: "" };
                }

                return {
                    repuesto: String(item.repuesto || item.nombre || "").trim(),
                    proveedor: String(item.proveedor || "").trim(),
                    valor: item.valor ?? "",
                    notas: String(item.notas || "").trim()
                };
            })
            .filter((item) => item.repuesto);
    }

    if (typeof value === "string") {
        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) {
                return parseRepuestos(parsed);
            }
        } catch (error) {
            // Fallback to legacy text formats.
        }

        return value
            .split(/\n|,/)
            .map((item) => ({ repuesto: item.trim(), proveedor: "", valor: "", notas: "" }))
            .filter((item) => item.repuesto);
    }

    return [];
}

function renderRepuestosMeta(value) {
    const repuestos = parseRepuestos(value);

    if (!repuestos.length) {
        return '<span class="pill">Repuestos: No registrados</span>';
    }

    return repuestos.map((repuesto) => `
        <span class="pill">
            ${escapeHtml(repuesto.repuesto)}
            ${repuesto.proveedor ? ` · ${escapeHtml(repuesto.proveedor)}` : ""}
            ${repuesto.valor ? ` · ${formatCurrency(repuesto.valor)}` : ""}
            ${repuesto.notas ? ` · ${escapeHtml(repuesto.notas)}` : ""}
        </span>
    `).join("");
}

function renderFacts(vehiculo) {
    // Orden por importancia (como se identifica un carro primero), no por
    // orden de columna en la base de datos.
    const facts = [
        ["Marca", vehiculo.marca],
        ["Línea", vehiculo.modelo],
        ["Modelo", vehiculo.anio],
        ["Tipo de vehículo", vehiculo.tipo_vehiculo],
        ["Tipo de carrocería", vehiculo.tipo_carroceria],
        ["Color", vehiculo.color],
        ["Combustible", vehiculo.combustible],
        ["Cilindraje", vehiculo.cilindraje],
        ["Capacidad de carga (kg)", vehiculo.capacidad_carga],
        ["Número de motor", vehiculo.numero_motor],
        ["Número de chasis (VIN)", vehiculo.numero_chasis],
        ["Creado", formatDate(vehiculo.created_at?.slice(0, 10))]
    ];

    vehicleFacts.innerHTML = facts.map(([label, value]) => `
        <div>
            <dt>${escapeHtml(label)}</dt>
            <dd>${escapeHtml(value) || "--"}</dd>
        </div>
    `).join("");
}

function renderMantenimientos(mantenimientos) {
    if (!mantenimientos.length) {
        maintenanceList.innerHTML = '<p class="dash-empty">Este vehículo aún no tiene mantenimientos registrados</p>';
        return;
    }

    maintenanceList.innerHTML = mantenimientos.map((item) => `
        <article class="record-item">
            <div class="record-top">
                <div>
                    <span class="record-title">${escapeHtml(tiposMantenimiento[item.tipo] || item.tipo)}</span>
                    <span class="record-sub">${escapeHtml(item.descripcion) || "Sin detalle de revisión"}</span>
                </div>
                <span class="pill">${formatDate(item.fecha)}</span>
            </div>
            <div class="record-meta">
                <span class="pill">${formatKm(item.kilometraje)}</span>
                <span class="pill">${formatCurrency(item.valor)}</span>
                ${renderRepuestosMeta(item.repuestos)}
                <span class="pill">Autorizado por: ${escapeHtml(item.autorizado_por) || "No registrado"}</span>
                <span class="pill">Hecho por: ${escapeHtml(item.hecho_por) || "No registrado"}</span>
                ${item.soporte_url ? '<span class="pill">Soporte adjunto</span>' : ""}
            </div>
            ${item.soporte_url ? `
                <a class="record-link" href="${escapeHtml(window.VehiAmb.api.getAssetUrl(item.soporte_url))}" target="_blank" rel="noreferrer">
                    ${escapeHtml(item.soporte_nombre) || "Ver adjunto"}
                </a>
            ` : ""}
        </article>
    `).join("");
}

// "1 por vencer · 1 vigente" en vez de la descripcion generica -- es
// literalmente de que trata este paso, ahorra tener que leer cada fila.
function resumenDocumentos(documentos, faltantes) {
    let vencidos = 0;
    let porVencer = 0;
    let vigentes = 0;

    documentos.forEach((item) => {
        const { dias } = estadoVigencia(item);
        if (dias === null) return;
        if (dias < 0) vencidos += 1;
        else if (dias <= 30) porVencer += 1;
        else vigentes += 1;
    });

    const partes = [];
    if (vencidos) partes.push(`${vencidos} vencido${vencidos === 1 ? "" : "s"}`);
    if (porVencer) partes.push(`${porVencer} por vencer`);
    if (faltantes.length) partes.push(`${faltantes.length} sin registrar`);
    if (vigentes) partes.push(`${vigentes} vigente${vigentes === 1 ? "" : "s"}`);

    return partes.length ? partes.join(" · ") : "RTM, SOAT, seguros y documentos futuros.";
}

function renderDocumentoExistente(item, puedeEditar, placaBusqueda) {
    const { estado, texto } = estadoVigencia(item);
    const pillClass = estado === "danger" ? "pill-danger" : estado === "warning" ? "pill-warning" : "";
    const barra = vigenciaBarInfo(item);

    const acciones = [];
    if (item.archivo_url) {
        acciones.push(`
            <a class="doc-action-link" href="${escapeHtml(window.VehiAmb.api.getAssetUrl(item.archivo_url))}" target="_blank" rel="noreferrer">
                ${ICON_CLIP}${escapeHtml(item.archivo_nombre) || "Ver documento"}
            </a>
        `);
    }
    // Sobre lo urgente (vencido/por vencer) la respuesta no es solo colorear
    // en ambar -- se ofrece la accion de renovar ahi mismo, no solo el aviso.
    if (puedeEditar && (estado === "danger" || estado === "warning")) {
        acciones.push(`<a class="doc-action-link" href="documentos.html?buscar=${placaBusqueda}">${ICON_REFRESH}Renovar</a>`);
    }

    return `
        <article class="doc-row ${estado === "danger" ? "is-vencido" : ""}">
            <div class="doc-row-head">
                <div class="doc-row-title">
                    <span class="doc-type-label">${escapeHtml(tiposDocumento[item.tipo] || item.tipo)}</span>
                    <span class="doc-number-label">${escapeHtml(item.numero_documento) || "Sin número"}</span>
                </div>
                ${estado === "success"
                    ? '<span class="doc-vigente-ok">✓ Vigente</span>'
                    : `<span class="pill ${pillClass}">${texto}</span>`}
            </div>
            ${item.tipo === "seguro" ? `<p class="field-help field-help-danger">Llama al #324 para atención de siniestros viales.</p>` : ""}
            ${barra ? `<div class="doc-vigencia-track"><div class="doc-vigencia-fill doc-vigencia-${barra.estado}" style="width:${barra.pct}%"></div></div>` : ""}
            <div class="doc-row-foot">
                <span class="doc-date-range">${formatDateRange(item)}</span>
                ${acciones.length ? `<div class="doc-row-actions">${acciones.join("")}</div>` : ""}
            </div>
        </article>
    `;
}

// Un documento que nunca se registro es mas grave que uno por vencer (no hay
// ni fecha que avisar), asi que se muestra con el mismo peso visual que uno
// vencido -- no queda invisible.
function renderDocumentoFaltante(tipo, puedeEditar, placaBusqueda) {
    return `
        <article class="doc-row is-vencido">
            <div class="doc-row-head">
                <div class="doc-row-title">
                    <span class="doc-type-label">${escapeHtml(tiposDocumento[tipo] || tipo)}</span>
                </div>
                <span class="pill pill-danger">No registrado</span>
            </div>
            <div class="doc-row-foot">
                <span class="doc-date-range">Sin documento cargado</span>
                ${puedeEditar ? `<div class="doc-row-actions"><a class="doc-action-link" href="documentos.html?buscar=${placaBusqueda}">${ICON_UPLOAD}Agregar</a></div>` : ""}
            </div>
        </article>
    `;
}

function renderDocumentos(documentos) {
    const puedeEditar = Boolean(window.VehiAmb.auth?.hasPermission?.("documents.create"));
    const placaBusqueda = encodeURIComponent(currentVehiculo?.placa || "");

    const tiposPresentes = new Set(documentos.map((item) => item.tipo));
    const faltantes = TIPOS_DOCUMENTO_REQUERIDOS.filter((tipo) => !tiposPresentes.has(tipo));

    documentosResumen.textContent = resumenDocumentos(documentos, faltantes);

    if (!documentos.length && !faltantes.length) {
        documentList.innerHTML = '<p class="dash-empty">Este vehículo aún no tiene vencimientos agendados</p>';
        return;
    }

    // Faltante y vencido pesan igual (ambos: "no hay documento valido hoy"),
    // luego por vencer, luego vigente -- no el orden en que llegaron del API.
    const PRIORIDAD_ESTADO = { danger: 0, faltante: 0, warning: 1, success: 2, neutral: 3 };
    const filas = [
        ...documentos.map((item) => ({ esFaltante: false, item, estado: estadoVigencia(item).estado })),
        ...faltantes.map((tipo) => ({ esFaltante: true, tipo, estado: "faltante" }))
    ].sort((a, b) => PRIORIDAD_ESTADO[a.estado] - PRIORIDAD_ESTADO[b.estado]);

    documentList.innerHTML = filas.map((fila) => fila.esFaltante
        ? renderDocumentoFaltante(fila.tipo, puedeEditar, placaBusqueda)
        : renderDocumentoExistente(fila.item, puedeEditar, placaBusqueda)
    ).join("");
}

function renderViajes(viajes) {
    if (!viajes.length) {
        vehicleViajesList.innerHTML = '<p class="dash-empty">Este vehículo aún no tiene viajes registrados</p>';
        return;
    }

    vehicleViajesList.innerHTML = viajes.map((viaje) => `
        <article class="record-item">
            <div class="record-top">
                <div>
                    <span class="record-title">${escapeHtml(viaje.destino) || "Sin destino"}</span>
                    <span class="record-sub">${escapeHtml(viaje.usuario_nombre) || "Conductor no registrado"}</span>
                </div>
                <span class="pill">${formatDateTime(viaje.creado_en)}</span>
            </div>
        </article>
    `).join("");
}

function deriveEstadoSimit(ultima) {
    if (!ultima) return "nunca_consultado";
    if (ultima.estado_consulta !== "ok") return "desconocido";
    return ultima.estado_cartera || "desconocido";
}

function renderSimitEstado(historial) {
    const ultima = historial?.[0] || null;
    const estado = deriveEstadoSimit(ultima);
    const pillClass = ESTADO_SIMIT_PILL_CLASS[estado] || "pill";
    const label = ESTADO_SIMIT_LABELS[estado] || estado;

    vehicleSimitBody.innerHTML = `
        <dl class="detail-list">
            <div>
                <dt>Estado actual</dt>
                <dd><span class="pill ${pillClass}">${label}</span></dd>
            </div>
            <div>
                <dt>Comparendos vigentes</dt>
                <dd>${ultima?.total_comparendos ?? 0}</dd>
            </div>
            <div>
                <dt>Valor total</dt>
                <dd>${formatCurrency(ultima?.valor_total)}</dd>
            </div>
            <div>
                <dt>Última consulta</dt>
                <dd>${formatDateTime(ultima?.fecha_consulta)}</dd>
            </div>
        </dl>
        ${ultima?.mensaje_error ? `<p class="dash-empty detail-empty">Último error: ${escapeHtml(ultima.mensaje_error)}</p>` : ""}
    `;
}

async function cargarSimitEstado(vehiculoId) {
    try {
        const historial = await window.VehiAmb.api.getSimitHistorialVehiculo(vehiculoId);
        const ultima = historial?.[0];
        const detalle = ultima ? await window.VehiAmb.api.getSimitConsultaDetalle(ultima.id) : null;
        currentSimit = { historial, detalle, estado: deriveEstadoSimit(ultima) };
        renderSimitEstado(historial);
    } catch (error) {
        console.error("No fue posible cargar el estado SIMIT:", error);
        currentSimit = null;
        vehicleSimitBody.innerHTML = '<p class="dash-empty detail-empty">No fue posible cargar el estado SIMIT de este vehículo.</p>';
    }
}

consultarSimitButton?.addEventListener("click", async () => {
    if (!currentVehicleId) return;

    consultarSimitButton.disabled = true;
    try {
        window.VehiAmb.ui.show(loader);
        await window.VehiAmb.api.consultarSimitVehiculo(currentVehicleId);
        window.VehiAmb.ui.showMessage(mensaje, "Consulta SIMIT actualizada correctamente");
        await cargarSimitEstado(currentVehicleId);
    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudo consultar el estado SIMIT", "error");
    } finally {
        consultarSimitButton.disabled = false;
        window.VehiAmb.ui.hide(loader);
    }
});

exportHojaVidaButton?.addEventListener("click", async () => {
    if (!currentVehiculo) return;

    exportHojaVidaButton.disabled = true;
    try {
        await window.VehiAmb.vehiculoExport.exportHojaVidaPdf({
            vehiculo: currentVehiculo,
            mantenimientos: currentMantenimientos,
            documentos: currentDocumentos,
            simit: currentSimit
        });
    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudo exportar la hoja de vida", "error");
    } finally {
        exportHojaVidaButton.disabled = false;
    }
});

function renderVehiculo(vehiculo) {
    const title = `${vehiculo.marca || "Vehículo"} ${vehiculo.modelo || ""}`.trim();

    document.title = `${vehiculo.placa || "Vehículo"} - Vehiamb`;
    vehicleTitle.textContent = title;
    vehicleSubtitle.textContent = `Ficha operativa de ${vehiculo.placa || "la unidad"}`;
    vehiclePlate.textContent = vehiculo.placa || "SIN PLACA";
    vehicleName.textContent = title;
    vehicleCode.textContent = `Código interno: ${vehiculo.codigo_interno || "--"}`;
    vehicleKm.textContent = formatKm(vehiculo.kilometraje_actual);

    renderFacts(vehiculo);
}

function renderRepuestosSugeridosBuilder() {
    repuestosSugeridosList.innerHTML = repuestosSugeridosState.map((item, index) => `
        <li class="simple-checklist-item">
            <div class="simple-checklist-content">
                <span class="simple-checklist-label">${escapeHtml(item.nombre)}</span>
                <span class="simple-checklist-detail">Cantidad: ${item.cantidad}</span>
            </div>
            <button type="button" class="simple-checklist-remove" data-index="${index}">Quitar</button>
        </li>
    `).join("");

    repuestosSugeridosEmpty.classList.toggle("hidden", repuestosSugeridosState.length > 0);

    repuestosSugeridosList.querySelectorAll(".simple-checklist-remove").forEach((button) => {
        button.addEventListener("click", () => {
            repuestosSugeridosState.splice(Number(button.dataset.index), 1);
            renderRepuestosSugeridosBuilder();
        });
    });
}

async function cargarRepuestosSugeridosVehiculo(vehiculoId) {
    try {
        const { intervalo_km, items } = await window.VehiAmb.api.getVehiculoRepuestosSugeridos(vehiculoId, "cambio_aceite");
        repuestosSugeridosState = items.map((item) => ({
            repuesto_id: item.repuesto_id,
            nombre: item.nombre,
            cantidad: Number(item.cantidad)
        }));
        repuestoSugeridoIntervaloKm.value = intervalo_km || "";
        renderRepuestosSugeridosBuilder();
    } catch (error) {
        console.error("No fue posible cargar los repuestos sugeridos:", error);
    }
}

if (repuestoSugeridoInput) {
    window.VehiAmb.crearRepuestoAutocomplete(repuestoSugeridoInput, {
        onSelect(repuesto) {
            repuestoSugeridoSeleccionado = repuesto;
            repuestoSugeridoSeleccionadoInfo.textContent = `${repuesto.codigo_interno} · ${repuesto.marca || "Sin marca"} · Stock: ${Number(repuesto.stock_disponible || 0)}`;
            repuestoSugeridoSeleccionadoInfo.classList.remove("hidden");
            addRepuestoSugeridoButton.disabled = false;
        }
    });
}

addRepuestoSugeridoButton?.addEventListener("click", () => {
    if (!repuestoSugeridoSeleccionado) return;

    const cantidad = Number(repuestoSugeridoCantidadInput.value) > 0 ? Number(repuestoSugeridoCantidadInput.value) : 1;
    repuestosSugeridosState.push({ repuesto_id: repuestoSugeridoSeleccionado.id, nombre: repuestoSugeridoSeleccionado.nombre, cantidad });

    repuestoSugeridoInput.value = "";
    repuestoSugeridoCantidadInput.value = "1";
    repuestoSugeridoSeleccionadoInfo.classList.add("hidden");
    addRepuestoSugeridoButton.disabled = true;
    repuestoSugeridoSeleccionado = null;
    renderRepuestosSugeridosBuilder();
});

guardarRepuestosSugeridosButton?.addEventListener("click", async () => {
    if (!currentVehicleId) return;

    guardarRepuestosSugeridosButton.disabled = true;
    try {
        await window.VehiAmb.api.updateVehiculoRepuestosSugeridos(currentVehicleId, {
            tipo_mantenimiento: "cambio_aceite",
            intervalo_km: repuestoSugeridoIntervaloKm.value || null,
            items: repuestosSugeridosState.map((item, index) => ({
                repuesto_id: item.repuesto_id,
                cantidad: item.cantidad,
                orden: index
            }))
        });
        window.VehiAmb.ui.showMessage(mensaje, "Repuestos sugeridos guardados correctamente");
    } catch (error) {
        window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudieron guardar los repuestos sugeridos", "error");
    } finally {
        guardarRepuestosSugeridosButton.disabled = false;
    }
});

async function cargarDetalle() {
    const params = new URLSearchParams(window.location.search);
    const vehicleId = params.get("id");

    if (!vehicleId) {
        window.VehiAmb.ui.showMessage(mensaje, "No se indicó el vehículo a consultar", "error");
        return;
    }

    currentVehicleId = vehicleId;

    if (vehicleRepuestosSugeridosSection && !window.VehiAmb.auth?.hasPermission?.("vehicles.edit")) {
        vehicleRepuestosSugeridosSection.classList.add("hidden");
    }

    // Algunas empresas no usan repuestos sugeridos para cambio de aceite (ver
    // empresas.modulos_deshabilitados) -- para esas, esta seccion solo debe
    // dejar configurar el intervalo de cambio, sin el buscador/lista de
    // repuestos que no van a usar.
    const usaRepuestosSugeridos = window.VehiAmb.auth?.hasPermission?.("vehicles.repuestos_sugeridos");
    document.getElementById("repuestosSugeridosPickerWrap")?.classList.toggle("hidden", !usaRepuestosSugeridos);

    if (editVehicleLink && !window.VehiAmb.auth?.hasPermission?.("vehicles.edit")) {
        editVehicleLink.classList.add("hidden");
    }

    if (registrarMantenimientoLink && !window.VehiAmb.auth?.hasPermission?.("maintenance.create")) {
        registrarMantenimientoLink.classList.add("hidden");
    }

    const puedeVerSimit = window.VehiAmb.auth?.hasPermission?.("simit.view");
    if (vehicleSimitSection && puedeVerSimit) {
        vehicleSimitSection.classList.remove("hidden");
    }

    // Consultar SIMIT tiene costo/limite -- mismo permiso que "Actualizar
    // toda la flota" en el modulo SIMIT (simit.manage), solo Administrador.
    if (consultarSimitButton && !window.VehiAmb.auth?.hasPermission?.("simit.manage")) {
        consultarSimitButton.classList.add("hidden");
    }

    const puedeVerViajes = window.VehiAmb.auth?.hasPermission?.("trips.view");
    if (vehicleViajesSection && puedeVerViajes) {
        vehicleViajesSection.classList.remove("hidden");
    }

    try {
        window.VehiAmb.ui.show(loader);

        const [vehiculo, mantenimientos, documentos] = await Promise.all([
            window.VehiAmb.api.getVehiculo(vehicleId),
            window.VehiAmb.api.getMantenimientosByVehicle(vehicleId),
            window.VehiAmb.api.getDocumentosByVehicle(vehicleId)
        ]);

        currentVehiculo = vehiculo;
        currentMantenimientos = mantenimientos;
        currentDocumentos = documentos;

        renderVehiculo(vehiculo);
        renderMantenimientos(mantenimientos);
        renderDocumentos(documentos);
        if (!vehicleRepuestosSugeridosSection?.classList.contains("hidden")) {
            await cargarRepuestosSugeridosVehiculo(vehicleId);
        }
        if (puedeVerSimit) {
            await cargarSimitEstado(vehicleId);
        }
        if (puedeVerViajes) {
            try {
                const viajes = await window.VehiAmb.api.getViajesByVehicle(vehicleId);
                renderViajes(viajes);
            } catch (error) {
                console.error(error);
                vehicleViajesList.innerHTML = '<p class="dash-empty">No fue posible cargar el historial de viajes</p>';
            }
        }

        window.VehiAmb.ui.show(vehicleHero);
        window.VehiAmb.ui.show(vehicleDetail);
        window.VehiAmb.ui.show(vehicleRecords);
    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(mensaje, "No fue posible cargar la ficha del vehículo", "error");
    } finally {
        window.VehiAmb.ui.hide(loader);
    }
}

document.addEventListener("DOMContentLoaded", cargarDetalle);
