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

function formatKm(value) {
    return `${Number(value || 0).toLocaleString("es-CO")} km`;
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
                    return { repuesto: item.trim(), valor: "", notas: "" };
                }

                return {
                    repuesto: String(item.repuesto || item.nombre || "").trim(),
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
            .map((item) => ({ repuesto: item.trim(), valor: "", notas: "" }))
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
        ["Marca", vehiculo.marca],
        ["Modelo", vehiculo.modelo],
        ["Anio", vehiculo.anio],
        ["Color", vehiculo.color],
        ["Combustible", vehiculo.combustible],
        ["Cilindraje", vehiculo.cilindraje],
        ["Capacidad de carga", vehiculo.capacidad_carga],
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

async function cargarDetalle() {
    const params = new URLSearchParams(window.location.search);
    const vehicleId = params.get("id");

    if (!vehicleId) {
        window.VehiAmb.ui.showMessage(mensaje, "No se indico el vehiculo a consultar", "error");
        return;
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
