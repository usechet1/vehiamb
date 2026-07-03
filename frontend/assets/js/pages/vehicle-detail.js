document.getElementById("fecha-hoy").textContent =
    new Date().toLocaleDateString("es-CO", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
    });

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
const vehicleSimitSection = document.getElementById("vehicleSimitSection");
const vehicleSimitBody = document.getElementById("vehicleSimitBody");
const consultarSimitButton = document.getElementById("consultarSimitButton");
const exportHojaVidaButton = document.getElementById("exportHojaVidaButton");
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
    tecnomecanica: "Tecnomecánica",
    soat: "SOAT",
    seguro: "Seguro",
    tarjeta_operacion: "Tarjeta de operación",
    otro: "Otro"
};

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
            ${repuesto.repuesto}
            ${repuesto.proveedor ? ` · ${repuesto.proveedor}` : ""}
            ${repuesto.valor ? ` · ${formatCurrency(repuesto.valor)}` : ""}
            ${repuesto.notas ? ` · ${repuesto.notas}` : ""}
        </span>
    `).join("");
}

function renderFacts(vehiculo) {
    const facts = [
        ["Tipo de vehículo", vehiculo.tipo_vehiculo],
        ["Tipo de carrocería", vehiculo.tipo_carroceria],
        ["Marca", vehiculo.marca],
        ["Línea", vehiculo.modelo],
        ["Modelo", vehiculo.anio],
        ["Color", vehiculo.color],
        ["Combustible", vehiculo.combustible],
        ["Cilindraje", vehiculo.cilindraje],
        ["Capacidad de carga", vehiculo.capacidad_carga],
        ["Número de chasis (VIN)", vehiculo.numero_chasis],
        ["Número de motor", vehiculo.numero_motor],
        ["Creado", formatDate(vehiculo.created_at?.slice(0, 10))]
    ];

    vehicleFacts.innerHTML = facts.map(([label, value]) => `
        <div>
            <dt>${label}</dt>
            <dd>${value || "--"}</dd>
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
                    <span class="record-title">${tiposMantenimiento[item.tipo] || item.tipo}</span>
                    <span class="record-sub">${item.descripcion || "Sin detalle de revisión"}</span>
                </div>
                <span class="pill">${formatDate(item.fecha)}</span>
            </div>
            <div class="record-meta">
                <span class="pill">${formatKm(item.kilometraje)}</span>
                <span class="pill">${formatCurrency(item.valor)}</span>
                ${renderRepuestosMeta(item.repuestos)}
                <span class="pill">Autorizado por: ${item.autorizado_por || "No registrado"}</span>
                <span class="pill">Hecho por: ${item.hecho_por || "No registrado"}</span>
                ${item.soporte_url ? '<span class="pill">Soporte adjunto</span>' : ""}
            </div>
            ${item.soporte_url ? `
                <a class="record-link" href="${window.VehiAmb.api.getAssetUrl(item.soporte_url)}" target="_blank" rel="noreferrer">
                    ${item.soporte_nombre || "Ver adjunto"}
                </a>
            ` : ""}
        </article>
    `).join("");
}

function renderDocumentos(documentos) {
    if (!documentos.length) {
        documentList.innerHTML = '<p class="dash-empty">Este vehículo aún no tiene vencimientos agendados</p>';
        return;
    }

    documentList.innerHTML = documentos.map((item) => {
        const days = daysUntil(item.fecha_vencimiento);
        const pillClass = days !== null && days < 0
            ? "pill-danger"
            : days !== null && days <= 30
                ? "pill-warning"
                : "";
        const statusText = days === null
            ? "Sin fecha"
            : days < 0
                ? `Vencido hace ${Math.abs(days)} días`
                : `Vence en ${days} días`;

        return `
            <article class="record-item">
                <div class="record-top">
                    <div>
                        <span class="record-title">${tiposDocumento[item.tipo] || item.tipo}</span>
                        <span class="record-sub">${item.numero_documento || "Sin número de documento"}</span>
                    </div>
                    <span class="pill ${pillClass}">${statusText}</span>
                </div>
                <div class="record-meta">
                    <span class="pill">Expedición: ${formatDate(item.fecha_expedicion)}</span>
                    <span class="pill">Vencimiento: ${formatDate(item.fecha_vencimiento)}</span>
                </div>
            </article>
        `;
    }).join("");
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
        ${ultima?.mensaje_error ? `<p class="dash-empty detail-empty">Último error: ${ultima.mensaje_error}</p>` : ""}
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

    document.title = `${vehiculo.placa || "Vehículo"} - VehiAmb`;
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
                <span class="simple-checklist-label">${item.nombre}</span>
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
        const items = await window.VehiAmb.api.getVehiculoRepuestosSugeridos(vehiculoId, "cambio_aceite");
        repuestosSugeridosState = items.map((item) => ({
            repuesto_id: item.repuesto_id,
            nombre: item.nombre,
            cantidad: Number(item.cantidad)
        }));
        repuestoSugeridoIntervaloKm.value = items.find((item) => item.intervalo_km)?.intervalo_km || "";
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
            items: repuestosSugeridosState.map((item, index) => ({
                repuesto_id: item.repuesto_id,
                cantidad: item.cantidad,
                orden: index,
                intervalo_km: repuestoSugeridoIntervaloKm.value || null
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

    const puedeVerSimit = window.VehiAmb.auth?.hasPermission?.("simit.view");
    if (vehicleSimitSection && puedeVerSimit) {
        vehicleSimitSection.classList.remove("hidden");
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
