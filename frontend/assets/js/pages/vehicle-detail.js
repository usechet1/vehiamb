const SIMIT_URL = "https://www.fcm.org.co/simit/#/estado-cuenta";

const loader = document.getElementById("loader");
const mensaje = document.getElementById("mensaje");
const vehicleHero = document.getElementById("vehicleHero");
const vehicleDetail = document.getElementById("vehicleDetail");
const vehicleRecords = document.getElementById("vehicleRecords");
const vehicleSimit = document.getElementById("vehicleSimit");
const vehicleTitle = document.getElementById("vehicleTitle");
const vehicleSubtitle = document.getElementById("vehicleSubtitle");
const vehiclePlate = document.getElementById("vehiclePlate");
const vehicleName = document.getElementById("vehicleName");
const vehicleCode = document.getElementById("vehicleCode");
const vehicleKm = document.getElementById("vehicleKm");
const vehicleFacts = document.getElementById("vehicleFacts");
const maintenanceCount = document.getElementById("vehicleMaintenanceCount");
const documentCount = document.getElementById("vehicleDocumentCount");
const maintenanceList = document.getElementById("vehicleMaintenanceList");
const documentList = document.getElementById("vehicleDocumentList");
const simitPlate = document.getElementById("simitPlate");
const openSimitLink = document.getElementById("openSimitLink");
const copyPlateButton = document.getElementById("copyPlateButton");
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
    revision: "Revision general",
    preventivo: "Preventivo",
    correctivo: "Correctivo",
    cambio_aceite: "Cambio de aceite",
    frenos: "Frenos",
    llantas: "Llantas",
    otro: "Otro"
};

const tiposDocumento = {
    tecnomecanica: "Tecnomecanica",
    soat: "SOAT",
    seguro: "Seguro",
    tarjeta_operacion: "Tarjeta de operacion",
    otro: "Otro"
};

let currentPlate = "";
let currentVehicleId = "";
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

async function copyPlateToClipboard() {
    if (!currentPlate) return;

    try {
        await navigator.clipboard.writeText(currentPlate);
        window.VehiAmb.ui.showMessage(mensaje, "Placa copiada. Ya puedes pegarla en SIMIT.");
    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(mensaje, "No fue posible copiar la placa automaticamente", "error");
    }
}

function configureSimitAccess(plate) {
    currentPlate = plate || "";
    simitPlate.textContent = currentPlate || "---";
    openSimitLink.href = SIMIT_URL;

    copyPlateButton.addEventListener("click", copyPlateToClipboard);
    openSimitLink.addEventListener("click", () => {
        if (currentPlate && navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(currentPlate).catch(() => {});
        }
    });
}

function renderFacts(vehiculo) {
    const facts = [
        ["Tipo de vehiculo", vehiculo.tipo_vehiculo],
        ["Tipo de carroceria", vehiculo.tipo_carroceria],
        ["Marca", vehiculo.marca],
        ["Modelo", vehiculo.modelo],
        ["Anio", vehiculo.anio],
        ["Color", vehiculo.color],
        ["Combustible", vehiculo.combustible],
        ["Cilindraje", vehiculo.cilindraje],
        ["Capacidad de carga", vehiculo.capacidad_carga],
        ["Numero de chasis (VIN)", vehiculo.numero_chasis],
        ["Numero de motor", vehiculo.numero_motor],
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
    maintenanceCount.textContent = mantenimientos.length;

    if (!mantenimientos.length) {
        maintenanceList.innerHTML = '<p class="dash-empty">Este vehiculo aun no tiene mantenimientos registrados</p>';
        return;
    }

    maintenanceList.innerHTML = mantenimientos.map((item) => `
        <article class="record-item">
            <div class="record-top">
                <div>
                    <span class="record-title">${tiposMantenimiento[item.tipo] || item.tipo}</span>
                    <span class="record-sub">${item.descripcion || "Sin detalle de revision"}</span>
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
    documentCount.textContent = documentos.length;

    if (!documentos.length) {
        documentList.innerHTML = '<p class="dash-empty">Este vehiculo aun no tiene vencimientos agendados</p>';
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
                ? `Vencido hace ${Math.abs(days)} dias`
                : `Vence en ${days} dias`;

        return `
            <article class="record-item">
                <div class="record-top">
                    <div>
                        <span class="record-title">${tiposDocumento[item.tipo] || item.tipo}</span>
                        <span class="record-sub">${item.numero_documento || "Sin numero de documento"}</span>
                    </div>
                    <span class="pill ${pillClass}">${statusText}</span>
                </div>
                <div class="record-meta">
                    <span class="pill">Expedicion: ${formatDate(item.fecha_expedicion)}</span>
                    <span class="pill">Vencimiento: ${formatDate(item.fecha_vencimiento)}</span>
                </div>
            </article>
        `;
    }).join("");
}

function renderVehiculo(vehiculo) {
    const title = `${vehiculo.marca || "Vehiculo"} ${vehiculo.modelo || ""}`.trim();

    document.title = `${vehiculo.placa || "Vehiculo"} - VehiAmb`;
    vehicleTitle.textContent = title;
    vehicleSubtitle.textContent = `Ficha operativa de ${vehiculo.placa || "la unidad"}`;
    vehiclePlate.textContent = vehiculo.placa || "SIN PLACA";
    vehicleName.textContent = title;
    vehicleCode.textContent = `Codigo interno: ${vehiculo.codigo_interno || "--"}`;
    vehicleKm.textContent = formatKm(vehiculo.kilometraje_actual);

    configureSimitAccess(vehiculo.placa || "");
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
        window.VehiAmb.ui.showMessage(mensaje, "No se indico el vehiculo a consultar", "error");
        return;
    }

    currentVehicleId = vehicleId;

    if (vehicleRepuestosSugeridosSection && !window.VehiAmb.auth?.hasPermission?.("vehicles.edit")) {
        vehicleRepuestosSugeridosSection.classList.add("hidden");
    }

    try {
        window.VehiAmb.ui.show(loader);

        const [vehiculo, mantenimientos, documentos] = await Promise.all([
            window.VehiAmb.api.getVehiculo(vehicleId),
            window.VehiAmb.api.getMantenimientosByVehicle(vehicleId),
            window.VehiAmb.api.getDocumentosByVehicle(vehicleId)
        ]);

        renderVehiculo(vehiculo);
        renderMantenimientos(mantenimientos);
        renderDocumentos(documentos);
        if (!vehicleRepuestosSugeridosSection?.classList.contains("hidden")) {
            await cargarRepuestosSugeridosVehiculo(vehicleId);
        }

        window.VehiAmb.ui.show(vehicleHero);
        window.VehiAmb.ui.show(vehicleDetail);
        window.VehiAmb.ui.show(vehicleRecords);
        window.VehiAmb.ui.show(vehicleSimit);
    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(mensaje, "No fue posible cargar la ficha del vehiculo", "error");
    } finally {
        window.VehiAmb.ui.hide(loader);
    }
}

document.addEventListener("DOMContentLoaded", cargarDetalle);
