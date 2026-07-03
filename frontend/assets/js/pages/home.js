document.getElementById("fecha-hoy").textContent =
    new Date().toLocaleDateString("es-CO", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
    });

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
    soat: "SOAT",
    tecnomecanica: "Tecnomecánica",
    seguro: "Seguro",
    tarjeta_operacion: "Tarjeta de operación",
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
    if (Number.isNaN(target.getTime())) return null;

    return Math.ceil((target - today) / 86400000);
}

function formatCurrency(value) {
    return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function perteneceAMes(fecha, mes, anio) {
    if (!fecha) return false;
    const date = new Date(`${String(fecha).slice(0, 10)}T00:00:00`);
    return !Number.isNaN(date.getTime()) && date.getMonth() === mes && date.getFullYear() === anio;
}

function esDelMesActual(fecha) {
    const ahora = new Date();
    return perteneceAMes(fecha, ahora.getMonth(), ahora.getFullYear());
}

// Variacion porcentual compacta (solo "▲/▼ XX%") para el badge junto al valor
// de la tarjeta KPI -- version corta de la que se usaba en el panel de abajo.
function calcularDeltaCompacto(totalActual, totalAnterior) {
    if (totalAnterior > 0) {
        const variacion = ((totalActual - totalAnterior) / totalAnterior) * 100;
        if (Math.abs(variacion) < 1) return { className: "is-flat", texto: "Igual" };
        return {
            className: variacion > 0 ? "is-up" : "is-down",
            texto: `${variacion > 0 ? "▲" : "▼"} ${Math.abs(Math.round(variacion))}%`
        };
    }
    if (totalActual > 0) return { className: "is-up", texto: "Nuevo" };
    return { className: "is-flat", texto: "Sin datos" };
}

function pintarResumen(vehiculos, mantenimientos = [], documentos = []) {
    const vencimientosCercanos = documentos.filter((documento) => {
        const days = daysUntil(documento.fecha_vencimiento);
        return days !== null && days <= 30;
    });

    const ahora = new Date();
    const mesAnteriorDate = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);

    const mantenimientosDelMes = mantenimientos.filter((item) => esDelMesActual(item.fecha));
    const mantenimientosMesAnterior = mantenimientos.filter((item) => perteneceAMes(item.fecha, mesAnteriorDate.getMonth(), mesAnteriorDate.getFullYear()));

    const costoMes = mantenimientosDelMes.reduce((sum, item) => sum + Number(item.valor || 0), 0);
    const costoMesAnterior = mantenimientosMesAnterior.reduce((sum, item) => sum + Number(item.valor || 0), 0);
    const delta = calcularDeltaCompacto(costoMes, costoMesAnterior);

    document.getElementById("total-vehiculos").textContent = vehiculos.length;
    document.getElementById("total-por-vencer").textContent = vencimientosCercanos.length;
    document.getElementById("total-mantenimientos").textContent = mantenimientosDelMes.length;
    document.getElementById("total-costo-mes").textContent = formatCurrency(costoMes);

    const deltaEl = document.getElementById("costoMesDelta");
    deltaEl.textContent = delta.texto;
    deltaEl.className = `dash-card-delta ${delta.className}`;
}

const ESTADOS_VEHICULO = {
    activo: { label: "Activo", color: "var(--color-success)" },
    reparacion: { label: "En reparación", color: "var(--color-warning)" },
    fuera_servicio: { label: "Fuera de servicio", color: "var(--color-primary)" }
};

function pintarFlotaEstado(vehiculos) {
    const container = document.getElementById("fleetStatus");

    if (!vehiculos.length) {
        container.innerHTML = '<p class="dash-empty">Aún no hay vehículos registrados.</p>';
        return;
    }

    const conteos = new Map();
    vehiculos.forEach((vehiculo) => {
        const clave = ESTADOS_VEHICULO[vehiculo.estado] ? vehiculo.estado : "otro";
        conteos.set(clave, (conteos.get(clave) || 0) + 1);
    });

    const total = vehiculos.length;
    const filas = [...conteos.entries()].sort((a, b) => b[1] - a[1]);

    const barra = filas.map(([estado, cantidad]) => {
        const config = ESTADOS_VEHICULO[estado] || { color: "var(--color-muted)" };
        const porcentaje = (cantidad / total) * 100;
        return `<span class="fleet-status-segment" style="width:${porcentaje}%;background:${config.color}"></span>`;
    }).join("");

    const filasHtml = filas.map(([estado, cantidad]) => {
        const config = ESTADOS_VEHICULO[estado] || { label: "Otro", color: "var(--color-muted)" };
        const porcentaje = Math.round((cantidad / total) * 100);
        return `
            <div class="fleet-status-row">
                <span class="fleet-status-row-label">
                    <span class="fleet-status-dot" style="background:${config.color}"></span>
                    ${escapeHtml(config.label)}
                </span>
                <span class="fleet-status-row-value">${cantidad}<span>(${porcentaje}%)</span></span>
            </div>
        `;
    }).join("");

    container.innerHTML = `
        <div class="fleet-status-bar">${barra}</div>
        <div class="fleet-status-list">${filasHtml}</div>
    `;
}

// El total y el delta vs. el mes anterior ya se muestran en la tarjeta KPI
// de arriba -- este panel es puramente el detalle: gasto por tipo de
// mantenimiento del mes en curso, usando todo el recuadro.
function pintarCostosMes(mantenimientos) {
    const container = document.getElementById("costosMes");
    const delMesActual = mantenimientos.filter((item) => esDelMesActual(item.fecha));

    const porTipo = new Map();
    delMesActual.forEach((item) => {
        const tipo = tiposMantenimiento[item.tipo] || item.tipo || "Otro";
        porTipo.set(tipo, (porTipo.get(tipo) || 0) + Number(item.valor || 0));
    });

    const filas = [...porTipo.entries()]
        .filter(([, valor]) => valor > 0)
        .sort((a, b) => b[1] - a[1]);

    if (!filas.length) {
        container.innerHTML = '<p class="dash-empty">Sin gastos registrados este mes.</p>';
        return;
    }

    container.innerHTML = `
        <div class="costos-mes-breakdown">
            ${filas.map(([tipo, valor]) => `
                <div class="costos-mes-breakdown-row">
                    <span>${escapeHtml(tipo)}</span>
                    <span>${formatCurrency(valor)}</span>
                </div>
            `).join("")}
        </div>
    `;
}

const MESES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

// Configuracion central de tipos de evento del calendario: letra + color por tipo.
// Agregar un tipo nuevo (ej. inspeccion: { letter: "I", ... }) es suficiente para que
// aparezca en el calendario sin tocar la logica de renderizado.
const CALENDAR_EVENT_TYPES = {
    mantenimiento: {
        letter: "M",
        label: "Mantenimiento",
        className: "dash-calendar-badge-mantenimiento"
    },
    vencimiento: {
        letter: "V",
        label: "Vencimiento",
        className: "dash-calendar-badge-vencimiento"
    }
};

let calendarCursor = new Date();
calendarCursor.setDate(1);
let calendarSelectedDate = toDateKey(new Date());
let calendarEventsByDate = new Map();

function toDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function buildCalendarEvents(mantenimientos, documentos) {
    const eventsByDate = new Map();

    function addEvent(dateValue, event) {
        const key = String(dateValue || "").slice(0, 10);
        if (!key || Number.isNaN(new Date(`${key}T00:00:00`).getTime())) return;

        if (!eventsByDate.has(key)) eventsByDate.set(key, []);
        eventsByDate.get(key).push(event);
    }

    mantenimientos.forEach((mantenimiento) => {
        const vehicle = `${mantenimiento.placa || "Sin placa"} - ${mantenimiento.marca || ""} ${mantenimiento.modelo || ""}`.trim();

        addEvent(mantenimiento.fecha, {
            kind: "mantenimiento",
            title: tiposMantenimiento[mantenimiento.tipo] || mantenimiento.tipo || "Mantenimiento",
            sub: vehicle
        });

        if (mantenimiento.tipo === "cambio_aceite" && mantenimiento.proximo_cambio_fecha) {
            addEvent(mantenimiento.proximo_cambio_fecha, {
                kind: "mantenimiento",
                title: `Próximo cambio de aceite - ${mantenimiento.placa || "Sin placa"}`,
                sub: vehicle
            });
        }
    });

    documentos.forEach((documento) => {
        const vehicle = `${documento.placa || "Sin placa"} - ${documento.marca || ""} ${documento.modelo || ""}`.trim();

        addEvent(documento.fecha_vencimiento, {
            kind: "vencimiento",
            title: tiposDocumento[documento.tipo] || documento.tipo || "Documento",
            sub: vehicle
        });
    });

    return eventsByDate;
}

function buildEventBadgeTooltip(kind, events, dateKey) {
    const config = CALENDAR_EVENT_TYPES[kind];
    const dateLabel = formatDate(dateKey);

    const detailLines = events
        .filter((event) => event.kind === kind)
        .map((event) => `${escapeHtml(event.title)}<br>${escapeHtml(event.sub)}`)
        .join("<br><br>");

    return `<strong>${escapeHtml(config.label)}</strong>${detailLines}<br>${dateLabel}`;
}

function buildDayEventBadges(events, dateKey) {
    return Object.keys(CALENDAR_EVENT_TYPES)
        .filter((kind) => events.some((event) => event.kind === kind))
        .map((kind) => {
            const config = CALENDAR_EVENT_TYPES[kind];
            const summary = events
                .filter((event) => event.kind === kind)
                .map((event) => `${event.title} - ${event.sub}`)
                .join(", ");

            return `
                <span class="dash-calendar-badge-wrap" tabindex="0" aria-label="${escapeHtml(config.label)}: ${escapeHtml(summary)}">
                    <span class="dash-calendar-badge ${config.className}" aria-hidden="true">${config.letter}</span>
                    <span class="dash-calendar-tooltip" role="tooltip" aria-hidden="true">${buildEventBadgeTooltip(kind, events, dateKey)}</span>
                </span>
            `;
        })
        .join("");
}

function renderCalendarGrid() {
    const grid = document.getElementById("calendarGrid");
    const label = document.getElementById("calendarLabel");
    const year = calendarCursor.getFullYear();
    const month = calendarCursor.getMonth();
    const todayKey = toDateKey(new Date());

    label.textContent = `${MESES[month]} ${year}`;

    const firstWeekdayIndex = (new Date(year, month, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    let cellsHtml = "";

    for (let i = 0; i < firstWeekdayIndex; i += 1) {
        cellsHtml += '<div class="dash-calendar-day is-empty"></div>';
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
        const dateKey = toDateKey(new Date(year, month, day));
        const events = calendarEventsByDate.get(dateKey) || [];

        const classes = ["dash-calendar-day"];
        if (dateKey === todayKey) classes.push("is-today");
        if (dateKey === calendarSelectedDate) classes.push("is-selected");

        cellsHtml += `
            <div class="${classes.join(" ")}" data-date="${dateKey}">
                <span class="dash-calendar-day-number">${day}</span>
                <div class="dash-calendar-day-dots">
                    ${buildDayEventBadges(events, dateKey)}
                </div>
            </div>
        `;
    }

    grid.innerHTML = cellsHtml;
}

function renderCalendarAgenda() {
    const head = document.getElementById("calendarAgendaHead");
    const list = document.getElementById("calendarAgendaList");
    const events = calendarEventsByDate.get(calendarSelectedDate) || [];

    const selectedDate = new Date(`${calendarSelectedDate}T00:00:00`);
    head.textContent = Number.isNaN(selectedDate.getTime())
        ? "Selecciona un día"
        : selectedDate.toLocaleDateString("es-CO", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

    if (!events.length) {
        list.innerHTML = '<p class="dash-empty">Sin mantenimientos ni vencimientos este día.</p>';
        return;
    }

    list.innerHTML = events.map((event) => `
        <article class="dash-list-item dash-list-item-rich">
            <div>
                <strong>${escapeHtml(event.title)}</strong>
                <span class="dash-sub">${escapeHtml(event.sub)}</span>
            </div>
            <span class="badge ${event.kind === "vencimiento" ? "badge-rojo" : "badge-verde"}">
                ${event.kind === "vencimiento" ? "Vencimiento" : "Mantenimiento"}
            </span>
        </article>
    `).join("");
}

function renderCalendar() {
    renderCalendarGrid();
    renderCalendarAgenda();
}

function pintarCalendario(mantenimientos, documentos) {
    calendarEventsByDate = buildCalendarEvents(mantenimientos, documentos);
    renderCalendar();
}

document.getElementById("calendarPrev").addEventListener("click", () => {
    calendarCursor.setMonth(calendarCursor.getMonth() - 1);
    renderCalendarGrid();
});

document.getElementById("calendarNext").addEventListener("click", () => {
    calendarCursor.setMonth(calendarCursor.getMonth() + 1);
    renderCalendarGrid();
});

document.getElementById("calendarToday").addEventListener("click", () => {
    calendarCursor = new Date();
    calendarCursor.setDate(1);
    calendarSelectedDate = toDateKey(new Date());
    renderCalendar();
});

document.getElementById("calendarGrid").addEventListener("click", (event) => {
    const cell = event.target.closest("[data-date]");
    if (!cell) return;

    calendarSelectedDate = cell.dataset.date;
    renderCalendar();
});

async function inicializarDashboard() {
    const [vehiculosResult, mantenimientosResult, documentosResult] = await Promise.allSettled([
        window.VehiAmb.api.getVehiculosCatalogo(),
        window.VehiAmb.api.getMantenimientos(),
        window.VehiAmb.api.getDocumentos()
    ]);

    const vehiculos = vehiculosResult.status === "fulfilled" ? vehiculosResult.value : [];
    const mantenimientos = mantenimientosResult.status === "fulfilled" ? mantenimientosResult.value : [];
    const documentos = documentosResult.status === "fulfilled" ? documentosResult.value : [];

    if (vehiculosResult.status === "rejected") {
        console.error(vehiculosResult.reason);
        document.getElementById("fleetStatus").innerHTML =
            '<p class="dash-empty">No fue posible cargar los vehículos</p>';
    } else {
        pintarFlotaEstado(vehiculos);
    }

    if (mantenimientosResult.status === "rejected") {
        console.error(mantenimientosResult.reason);
        document.getElementById("costosMes").innerHTML =
            '<p class="dash-empty">No fue posible cargar los mantenimientos</p>';
    } else {
        pintarCostosMes(mantenimientos);
    }

    if (documentosResult.status === "rejected") {
        console.error(documentosResult.reason);
    }

    if (mantenimientosResult.status === "rejected" && documentosResult.status === "rejected") {
        document.getElementById("calendarAgendaList").innerHTML =
            '<p class="dash-empty">No fue posible cargar el calendario</p>';
    } else {
        pintarCalendario(mantenimientos, documentos);
    }

    pintarResumen(vehiculos, mantenimientos, documentos);
}

document.addEventListener("DOMContentLoaded", inicializarDashboard);
