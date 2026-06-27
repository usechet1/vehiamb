document.getElementById("fecha-hoy").textContent =
    new Date().toLocaleDateString("es-CO", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
    });

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
    soat: "SOAT",
    tecnomecanica: "Tecnomecanica",
    seguro: "Seguro",
    tarjeta_operacion: "Tarjeta de operacion",
    otro: "Otro"
};

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function formatDate(value) {
    if (!value) return "Sin fecha";

    return new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString("es-CO", {
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
    return Math.ceil((target - today) / 86400000);
}

function documentStatus(days) {
    if (days === null) return { label: "Sin fecha", className: "badge-rojo" };
    if (days < 0) return { label: `Vencido hace ${Math.abs(days)} dias`, className: "badge-rojo" };
    if (days === 0) return { label: "Vence hoy", className: "badge-rojo" };
    if (days <= 30) return { label: `${days} dias`, className: "badge-amarillo" };
    return { label: `${days} dias`, className: "badge-verde" };
}

function pintarResumen(vehiculos, mantenimientos = [], documentos = []) {
    const vencimientosCercanos = documentos.filter((documento) => {
        const days = daysUntil(documento.fecha_vencimiento);
        return days !== null && days <= 30;
    });

    document.getElementById("total-vehiculos").textContent = vehiculos.length;
    document.getElementById("total-por-vencer").textContent = vencimientosCercanos.length;
    document.getElementById("total-mantenimientos").textContent = mantenimientos.length;
    document.getElementById("total-documentos").textContent = documentos.length;
}

function pintarVencimientos(documentos) {
    const container = document.getElementById("lista-vencimientos");
    const proximos = documentos
        .map((documento) => ({ ...documento, days: daysUntil(documento.fecha_vencimiento) }))
        .filter((documento) => documento.days !== null && documento.days <= 30)
        .sort((a, b) => a.days - b.days)
        .slice(0, 7);

    if (!proximos.length) {
        container.innerHTML = '<p class="dash-empty">No hay vencimientos cercanos.</p>';
        return;
    }

    container.innerHTML = proximos.map((documento) => {
        const status = documentStatus(documento.days);
        const title = tiposDocumento[documento.tipo] || documento.tipo || "Documento";
        const vehicle = `${documento.placa || "Sin placa"} - ${documento.marca || ""} ${documento.modelo || ""}`.trim();

        return `
            <article class="dash-list-item dash-list-item-rich">
                <div>
                    <strong>${escapeHtml(title)}</strong>
                    <span class="dash-sub">${escapeHtml(vehicle)}</span>
                </div>
                <div class="dash-item-side">
                    <span class="dash-fecha-tag">${formatDate(documento.fecha_vencimiento)}</span>
                    <span class="badge ${status.className}">${status.label}</span>
                </div>
            </article>
        `;
    }).join("");
}

function pintarMantenimientos(mantenimientos) {
    const container = document.getElementById("lista-mantenimientos");
    const recientes = [...mantenimientos]
        .sort((a, b) => String(b.fecha || "").localeCompare(String(a.fecha || "")))
        .slice(0, 5);

    if (!recientes.length) {
        container.innerHTML = '<li class="dash-empty">Sin mantenimientos registrados</li>';
        return;
    }

    container.innerHTML = recientes.map((mantenimiento) => `
        <li class="dash-list-item">
            <div>
                <strong>${escapeHtml(tiposMantenimiento[mantenimiento.tipo] || mantenimiento.tipo || "Mantenimiento")}</strong>
                <span class="dash-sub">${escapeHtml(mantenimiento.placa || "Sin placa")}</span>
            </div>
            <span class="dash-fecha-tag">${formatDate(mantenimiento.fecha)}</span>
        </li>
    `).join("");
}

function pintarKilometraje(vehiculos) {
    const container = document.getElementById("lista-kilometraje");
    const topVehiculos = [...vehiculos]
        .sort((a, b) => Number(b.kilometraje_actual || 0) - Number(a.kilometraje_actual || 0))
        .slice(0, 5);

    if (!topVehiculos.length) {
        container.innerHTML = '<li class="dash-empty">Sin vehiculos registrados</li>';
        return;
    }

    container.innerHTML = topVehiculos.map((vehiculo) => `
        <li class="dash-list-item">
            <div>
                <strong>${escapeHtml(vehiculo.placa || "Sin placa")}</strong>
                <span class="dash-sub">${escapeHtml(`${vehiculo.marca || ""} ${vehiculo.modelo || ""}`.trim() || "Sin referencia")}</span>
            </div>
            <span class="dash-fecha-tag">${Number(vehiculo.kilometraje_actual || 0).toLocaleString("es-CO")} km</span>
        </li>
    `).join("");
}

function pintarCombustible(vehiculos) {
    const container = document.getElementById("resumen-combustible");

    if (!vehiculos.length) {
        container.innerHTML = '<p class="dash-empty">Sin vehiculos registrados</p>';
        return;
    }

    const resumen = vehiculos.reduce((acc, vehiculo) => {
        const combustible = vehiculo.combustible || "Sin dato";
        acc[combustible] = (acc[combustible] || 0) + 1;
        return acc;
    }, {});

    const max = Math.max(...Object.values(resumen));

    container.innerHTML = Object.entries(resumen)
        .sort((a, b) => b[1] - a[1])
        .map(([combustible, total]) => `
            <div class="dash-bar-row">
                <div class="dash-bar-top">
                    <strong>${escapeHtml(combustible)}</strong>
                    <span>${total} vehiculo${total === 1 ? "" : "s"}</span>
                </div>
                <div class="dash-bar-track">
                    <span class="dash-bar-fill" style="width: ${(total / max) * 100}%"></span>
                </div>
            </div>
        `).join("");
}

async function inicializarDashboard() {
    const [vehiculosResult, mantenimientosResult, documentosResult] = await Promise.allSettled([
        window.VehiAmb.api.getVehiculos(),
        window.VehiAmb.api.getMantenimientos(),
        window.VehiAmb.api.getDocumentos()
    ]);

    const vehiculos = vehiculosResult.status === "fulfilled" ? vehiculosResult.value : [];
    const mantenimientos = mantenimientosResult.status === "fulfilled" ? mantenimientosResult.value : [];
    const documentos = documentosResult.status === "fulfilled" ? documentosResult.value : [];

    if (vehiculosResult.status === "rejected") {
        console.error(vehiculosResult.reason);
        document.getElementById("lista-kilometraje").innerHTML =
            '<li class="dash-empty">No fue posible cargar los vehiculos</li>';
        document.getElementById("resumen-combustible").innerHTML =
            '<p class="dash-empty">No fue posible cargar los vehiculos</p>';
    } else {
        pintarKilometraje(vehiculos);
        pintarCombustible(vehiculos);
    }

    if (mantenimientosResult.status === "rejected") {
        console.error(mantenimientosResult.reason);
        document.getElementById("lista-mantenimientos").innerHTML =
            '<li class="dash-empty">No fue posible cargar los mantenimientos</li>';
    } else {
        pintarMantenimientos(mantenimientos);
    }

    if (documentosResult.status === "rejected") {
        console.error(documentosResult.reason);
        document.getElementById("lista-vencimientos").innerHTML =
            '<p class="dash-empty">No fue posible cargar los vencimientos</p>';
    } else {
        pintarVencimientos(documentos);
    }

    pintarResumen(vehiculos, mantenimientos, documentos);
}

document.addEventListener("DOMContentLoaded", inicializarDashboard);
