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
    if (Number.isNaN(target.getTime())) return null;

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
                title: `Proximo cambio de aceite - ${mantenimiento.placa || "Sin placa"}`,
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
        ? "Selecciona un dia"
        : selectedDate.toLocaleDateString("es-CO", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

    if (!events.length) {
        list.innerHTML = '<p class="dash-empty">Sin mantenimientos ni vencimientos este dia.</p>';
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

    if (mantenimientosResult.status === "rejected" && documentosResult.status === "rejected") {
        document.getElementById("calendarAgendaList").innerHTML =
            '<p class="dash-empty">No fue posible cargar el calendario</p>';
    } else {
        pintarCalendario(mantenimientos, documentos);
    }

    pintarResumen(vehiculos, mantenimientos, documentos);
}

document.addEventListener("DOMContentLoaded", inicializarDashboard);
