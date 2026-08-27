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
    tecnomecanica: "RTM",
    seguro: "Póliza Seguro",
    licencia_transito: "Licencia de tránsito",
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

function saludoSegunHora() {
    const hora = new Date().getHours();
    if (hora < 12) return "Buenos días";
    if (hora < 19) return "Buenas tardes";
    return "Buenas noches";
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

// Version corta ("$12,3 M") solo para el valor del KPI "Gasto del mes" -- la
// tarjeta es angosta y el monto completo ("$ 12.345.678") no cabe sin
// achicar la letra hasta ilegible o cortarla con "...". El monto completo
// sigue disponible en el atributo title (tooltip al pasar el mouse).
function formatCurrencyCompacta(value) {
    return new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        notation: "compact",
        maximumFractionDigits: 1
    }).format(Number(value || 0));
}

function perteneceAMes(fecha, mes, anio) {
    if (!fecha) return false;
    const date = new Date(`${String(fecha).slice(0, 10)}T00:00:00`);
    return !Number.isNaN(date.getTime()) && date.getMonth() === mes && date.getFullYear() === anio;
}

function pad2(value) {
    return String(value).padStart(2, "0");
}

function isoDate(date) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

// Rango del mes anterior completo (dia 1 al ultimo dia), para el delta del
// KPI "Gasto del mes" -- ver getCostosVehiculos() en inicializarDashboard().
function rangoMesAnterior() {
    const ahora = new Date();
    const desde = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);
    const hasta = new Date(ahora.getFullYear(), ahora.getMonth(), 0);
    return { desde: isoDate(desde), hasta: isoDate(hasta) };
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

// KPI "Total comparendos": suma total_comparendos de la ultima consulta
// SIMIT de cada vehiculo (ver simit-consultas.repository.js
// findUltimoEstadoPorFlota) y colorea la tarjeta segun la gravedad mas alta
// encontrada en la flota. El desglose de "vehiculos con comparendo" por
// estado de cartera (cobro coactivo / con multas / sin multas) ya vive en el
// resumen de simit.html -- no se duplica aqui.
function pintarComparendos(estadoFlotaSimit) {
    const card = document.getElementById("dashCardTotalComparendos");
    const sub = document.getElementById("comparendosSub");
    const valorTotalEl = document.getElementById("total-comparendos");
    if (!card || !sub || !valorTotalEl) return;

    const totalComparendos = estadoFlotaSimit.reduce((sum, item) => sum + Number(item.total_comparendos || 0), 0);
    valorTotalEl.textContent = totalComparendos;

    const enCobroCoactivo = estadoFlotaSimit.filter((item) => item.estado_cartera === "cobro_coactivo");
    const conMultas = estadoFlotaSimit.filter((item) => item.estado_cartera === "con_multas");

    if (enCobroCoactivo.length) {
        sub.textContent = `${enCobroCoactivo.length} en cobro coactivo`;
        sub.className = "dash-card-sub is-danger";
        card.style.setProperty("--card-accent", "var(--color-primary)");
    } else if (conMultas.length) {
        sub.textContent = `Afecta a ${conMultas.length} vehículo${conMultas.length === 1 ? "" : "s"}`;
        sub.className = "dash-card-sub is-warning";
        card.style.setProperty("--card-accent", "var(--color-warning)");
    } else {
        sub.textContent = totalComparendos ? "" : "Sin comparendos";
        sub.className = "dash-card-sub";
        card.style.removeProperty("--card-accent");
    }
}

function formatDateCorta(value) {
    if (!value) return "";
    return new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString("es-CO", {
        day: "2-digit",
        month: "short"
    });
}

// Sub-indicador de urgencia bajo el KPI "Documentos por vencer" -- el numero
// solo (ej. "6") no dice si son 6 vencimientos dentro de un mes o 6 de hoy,
// asi que se desglosa por severidad y se colorea la tarjeta acorde (rojo si
// ya hay vencidos, naranja si vencen esta semana, neutro si es mas lejano).
function pintarUrgenciaDocumentos(vencimientosCercanos) {
    const card = document.getElementById("dashCardDocs");
    const sub = document.getElementById("docsPorVencerSub");
    if (!card || !sub) return;

    const fechaMasProxima = (lista) => lista.map((doc) => doc.fecha_vencimiento).sort()[0];

    const vencidos = vencimientosCercanos.filter((doc) => daysUntil(doc.fecha_vencimiento) < 0);
    const estaSemana = vencimientosCercanos.filter((doc) => {
        const days = daysUntil(doc.fecha_vencimiento);
        return days >= 0 && days <= 7;
    });

    if (vencidos.length) {
        sub.textContent = `${vencidos.length} vencido${vencidos.length === 1 ? "" : "s"} (desde ${formatDateCorta(fechaMasProxima(vencidos))})`;
        sub.title = sub.textContent;
        sub.className = "dash-card-sub is-danger";
        card.style.setProperty("--card-accent", "var(--color-primary)");
    } else if (estaSemana.length) {
        sub.textContent = `${estaSemana.length} vence${estaSemana.length === 1 ? "" : "n"} esta semana (${formatDateCorta(fechaMasProxima(estaSemana))})`;
        sub.title = sub.textContent;
        sub.className = "dash-card-sub is-warning";
        card.style.setProperty("--card-accent", "var(--color-warning)");
    } else if (vencimientosCercanos.length) {
        sub.textContent = `Próximo: ${formatDateCorta(fechaMasProxima(vencimientosCercanos))}`;
        sub.title = sub.textContent;
        sub.className = "dash-card-sub";
        card.style.removeProperty("--card-accent");
    } else {
        sub.textContent = "";
        sub.title = "";
        sub.className = "dash-card-sub";
        card.style.removeProperty("--card-accent");
    }
}

function pintarResumen(vehiculos, mantenimientos = [], documentos = [], costosOperativosMes = [], costosOperativosMesAnterior = []) {
    const vencimientosCercanos = documentos.filter((documento) => {
        const days = daysUntil(documento.fecha_vencimiento);
        return days !== null && days <= 30;
    });

    const ahora = new Date();
    const mesAnteriorDate = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);

    const mantenimientosDelMes = mantenimientos.filter((item) => esDelMesActual(item.fecha));
    const mantenimientosMesAnterior = mantenimientos.filter((item) => perteneceAMes(item.fecha, mesAnteriorDate.getMonth(), mesAnteriorDate.getFullYear()));

    // "Gasto del mes" combina mantenimientos (mano de obra + repuestos) con
    // los gastos operativos (combustible, peajes, parqueaderos, almuerzos)
    // de las facturas importadas del modulo de Costos -- antes solo sumaba
    // mantenimientos, dejando afuera el gasto que suele ser el mas grande
    // de la flota.
    const costoMantenimientoMes = mantenimientosDelMes.reduce((sum, item) => sum + Number(item.valor || 0), 0);
    const costoMantenimientoMesAnterior = mantenimientosMesAnterior.reduce((sum, item) => sum + Number(item.valor || 0), 0);

    const costoOperativoMes = costosOperativosMes.reduce((sum, item) => sum + Number(item.totalGastado || 0), 0);
    const costoOperativoMesAnterior = costosOperativosMesAnterior.reduce((sum, item) => sum + Number(item.totalGastado || 0), 0);

    const costoMes = costoMantenimientoMes + costoOperativoMes;
    const costoMesAnterior = costoMantenimientoMesAnterior + costoOperativoMesAnterior;
    const delta = calcularDeltaCompacto(costoMes, costoMesAnterior);

    document.getElementById("total-vehiculos").textContent = vehiculos.length;
    document.getElementById("total-por-vencer").textContent = vencimientosCercanos.length;
    pintarUrgenciaDocumentos(vencimientosCercanos);
    document.getElementById("total-mantenimientos").textContent = mantenimientosDelMes.length;
    const valorCostoMesEl = document.getElementById("total-costo-mes");
    valorCostoMesEl.textContent = formatCurrencyCompacta(costoMes);
    valorCostoMesEl.title = formatCurrency(costoMes);

    const deltaEl = document.getElementById("costoMesDelta");
    deltaEl.textContent = delta.texto;
    deltaEl.className = `dash-card-delta ${delta.className}`;
}

const ESTADOS_VEHICULO = {
    activo: { label: "Activo", color: "var(--color-success)" },
    reparacion: { label: "En reparación", color: "var(--color-warning)" },
    fuera_servicio: { label: "Fuera de servicio", color: "var(--color-primary)" },
    dado_de_baja: { label: "Dado de baja", color: "var(--color-muted)" }
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
// mantenimiento del mes en curso, mas los gastos operativos (facturas
// importadas del modulo de Costos: combustible, peajes, parqueaderos,
// almuerzos -- ver costos.repository.js aggregarPorVehiculo, que los suma
// todos juntos por factura, no solo combustible), usando todo el recuadro.
function pintarCostosMes(mantenimientos, costosOperativosMes = []) {
    const container = document.getElementById("costosMes");
    const delMesActual = mantenimientos.filter((item) => esDelMesActual(item.fecha));

    const porTipo = new Map();
    delMesActual.forEach((item) => {
        const tipo = tiposMantenimiento[item.tipo] || item.tipo || "Otro";
        porTipo.set(tipo, (porTipo.get(tipo) || 0) + Number(item.valor || 0));
    });

    const totalOperativo = costosOperativosMes.reduce((sum, item) => sum + Number(item.totalGastado || 0), 0);
    if (totalOperativo > 0) {
        porTipo.set("Gastos operativos (combustible, peajes, etc.)", totalOperativo);
    }

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
            sub: vehicle,
            placa: mantenimiento.placa || "Sin placa"
        });

        if (mantenimiento.tipo === "cambio_aceite" && mantenimiento.proximo_cambio_fecha) {
            addEvent(mantenimiento.proximo_cambio_fecha, {
                kind: "mantenimiento",
                title: `Próximo cambio de aceite - ${mantenimiento.placa || "Sin placa"}`,
                sub: vehicle,
                placa: mantenimiento.placa || "Sin placa"
            });
        }
    });

    documentos.forEach((documento) => {
        const vehicle = `${documento.placa || "Sin placa"} - ${documento.marca || ""} ${documento.modelo || ""}`.trim();

        addEvent(documento.fecha_vencimiento, {
            kind: "vencimiento",
            title: tiposDocumento[documento.tipo] || documento.tipo || "Documento",
            sub: vehicle,
            placa: documento.placa || "Sin placa"
        });
    });

    return eventsByDate;
}

function buildEventBadgeTooltip(kind, events, dateKey) {
    const config = CALENDAR_EVENT_TYPES[kind];
    const dateLabel = formatDate(dateKey);

    const detailLines = events
        .filter((event) => event.kind === kind)
        .map((event) => `${escapeHtml(event.title)}<br>${escapeHtml(event.placa)}`)
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

// El vehiculo elegido ya no vive en un <select> sino en el estado de las
// tarjetas clicables del grid -- este es el unico lugar que lo guarda.
let conductorVehiculoSeleccionado = "";

// Destino elegido = "Ciudad, Departamento", armado a partir de los dos
// selects en cascada (departamento -> ciudad) en vez de texto libre.
function obtenerConductorDestino() {
    const departamento = document.getElementById("conductorDepartamentoSelect").value;
    const ciudad = document.getElementById("conductorCiudadSelect").value;
    return ciudad && departamento ? `${ciudad}, ${departamento}` : "";
}

function actualizarConductorMapsLink() {
    const destino = obtenerConductorDestino();
    const mapsLink = document.getElementById("conductorMapsLink");
    const previewText = document.getElementById("conductorMapsPreviewText");

    if (destino) {
        mapsLink.href = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destino)}`;
        mapsLink.classList.remove("is-disabled");
        mapsLink.removeAttribute("aria-disabled");
        previewText.textContent = destino;
    } else {
        mapsLink.href = "#";
        mapsLink.classList.add("is-disabled");
        mapsLink.setAttribute("aria-disabled", "true");
        previewText.textContent = "Elige un destino para previsualizar la ruta";
    }
}

function actualizarConductorBotonIniciar() {
    const destino = obtenerConductorDestino();
    document.getElementById("conductorIniciarViajeBtn").disabled = !conductorVehiculoSeleccionado || !destino;
}

function getVehiculoThumbnail(vehiculo) {
    const rawSource = vehiculo.imagen_url || vehiculo.imagen || vehiculo.foto_url || vehiculo.foto;
    if (!rawSource) return `<span class="conductor-vehiculo-icon" aria-hidden="true">🚚</span>`;

    const src = window.VehiAmb.api.getAssetUrl(rawSource);
    return `<span class="conductor-vehiculo-icon"><img src="${escapeHtml(src)}" alt="" loading="lazy" onerror="this.parentElement.innerHTML='🚚'"></span>`;
}

// Con flotas grandes (cientos de vehiculos) no tiene sentido pintar todas
// las tarjetas de una: obliga a deslizar muchisimo para llegar a la
// siguiente opcion. Sin texto en el buscador solo se muestran las primeras
// VEHICULOS_LIMITE_INICIAL; al escribir, el filtro corre sobre la lista
// completa sin ese limite.
const VEHICULOS_LIMITE_INICIAL = 0;

function renderConductorVehiculoGrid(vehiculos) {
    const grid = document.getElementById("conductorVehiculoGrid");
    const limiteHint = document.getElementById("conductorVehiculoLimiteHint");

    if (!vehiculos.length) {
        grid.innerHTML = '<p class="dash-empty">No hay vehículos disponibles.</p>';
        return;
    }

    grid.innerHTML = vehiculos
        .map((vehiculo) => `
            <button type="button" class="conductor-vehiculo-card" data-vehiculo-id="${vehiculo.id}" data-placa="${escapeHtml(String(vehiculo.placa || "").toLowerCase())}">
                ${getVehiculoThumbnail(vehiculo)}
                <span class="conductor-vehiculo-info">
                    <span class="plate">${escapeHtml(vehiculo.placa)}</span>
                    <strong>${escapeHtml(vehiculo.marca)} ${escapeHtml(vehiculo.modelo)}</strong>
                </span>
            </button>
        `)
        .join("");

    grid.querySelectorAll(".conductor-vehiculo-card").forEach((card) => {
        card.addEventListener("click", () => {
            conductorVehiculoSeleccionado = card.dataset.vehiculoId;
            grid.querySelectorAll(".conductor-vehiculo-card").forEach((el) => {
                el.classList.toggle("is-selected", el === card);
            });
            actualizarConductorBotonIniciar();
        });
    });

    if (limiteHint && vehiculos.length > VEHICULOS_LIMITE_INICIAL) {
        limiteHint.textContent = `Mostrando ${VEHICULOS_LIMITE_INICIAL} de ${vehiculos.length} vehículos. Escribe la placa para buscar el tuyo.`;
        limiteHint.classList.remove("hidden");
    }

    aplicarLimiteVehiculos("");
}

function aplicarLimiteVehiculos(texto) {
    const grid = document.getElementById("conductorVehiculoGrid");
    const limiteHint = document.getElementById("conductorVehiculoLimiteHint");
    const tarjetas = [...grid.querySelectorAll(".conductor-vehiculo-card")];

    if (texto) {
        limiteHint?.classList.add("hidden");
        tarjetas.forEach((card) => card.classList.toggle("hidden", !card.dataset.placa.includes(texto)));
        return;
    }

    limiteHint?.classList.toggle("hidden", tarjetas.length <= VEHICULOS_LIMITE_INICIAL);
    tarjetas.forEach((card, index) => card.classList.toggle("hidden", index >= VEHICULOS_LIMITE_INICIAL));
}

function initBuscadorVehiculo() {
    const buscarInput = document.getElementById("conductorVehiculoBuscar");

    buscarInput.addEventListener("input", () => {
        aplicarLimiteVehiculos(buscarInput.value.trim().toLowerCase());
    });
}

function initSelectorUbicacion(departamentos) {
    const departamentoSelect = document.getElementById("conductorDepartamentoSelect");
    const ciudadSelect = document.getElementById("conductorCiudadSelect");

    for (const { departamento } of departamentos) {
        const option = document.createElement("option");
        option.value = departamento;
        option.textContent = departamento;
        departamentoSelect.appendChild(option);
    }

    departamentoSelect.addEventListener("change", () => {
        const seleccionado = departamentos.find((item) => item.departamento === departamentoSelect.value);

        ciudadSelect.innerHTML = "";
        if (!seleccionado) {
            ciudadSelect.disabled = true;
            ciudadSelect.appendChild(new Option("Selecciona primero un departamento...", ""));
        } else {
            ciudadSelect.disabled = false;
            ciudadSelect.appendChild(new Option("Selecciona una ciudad...", ""));
            for (const ciudad of seleccionado.ciudades) {
                ciudadSelect.appendChild(new Option(ciudad, ciudad));
            }
        }

        actualizarConductorMapsLink();
        actualizarConductorBotonIniciar();
    });

    ciudadSelect.addEventListener("change", () => {
        actualizarConductorMapsLink();
        actualizarConductorBotonIniciar();
    });
}

function pintarViajesRecientes(viajes) {
    const contenedor = document.getElementById("conductorViajesRecientes");

    if (!viajes.length) {
        contenedor.innerHTML = '<p class="dash-empty">Todavía no has registrado ningún viaje.</p>';
        return;
    }

    contenedor.innerHTML = viajes
        .map((viaje) => {
            const vehiculoLabel = escapeHtml(`${viaje.vehiculo_placa || ""} · ${viaje.vehiculo_marca || ""} ${viaje.vehiculo_modelo || ""}`.trim());
            return `
                <div class="conductor-viaje-item">
                    <div>
                        <strong>${vehiculoLabel}</strong>
                        <p>${escapeHtml(viaje.destino)}</p>
                    </div>
                    <span class="conductor-viaje-fecha">${formatDate(viaje.creado_en)}</span>
                </div>
            `;
        })
        .join("");
}

// Si el conductor tiene una ruta asignada para hoy (modulo "Asignacion de
// rutas"), el vehiculo y el destino ya quedan resueltos -- no se le muestra
// la grilla de vehiculos ni los selects de departamento/ciudad, solo un
// resumen y el boton para iniciar el viaje. El destino que se envia es
// directamente el nombre de la ruta asignada (confirmado con el negocio: no
// tiene sentido pedirle tambien departamento/ciudad si ya sabe a donde va).
function inicializarConductorAsignacionHoy(asignacion) {
    document.getElementById("conductorAsignacionCard").classList.remove("hidden");
    document.getElementById("conductorAsignacionRuta").textContent = asignacion.ruta_nombre || "Sin nombre";

    document.getElementById("conductorAsignacionPlaca").textContent = asignacion.vehiculo.placa || "";

    const iniciarBtn = document.getElementById("conductorAsignacionIniciarBtn");
    const mensaje = document.getElementById("conductorAsignacionMensaje");

    iniciarBtn.addEventListener("click", async () => {
        mensaje.classList.add("hidden");
        iniciarBtn.disabled = true;

        try {
            const viaje = await window.VehiAmb.api.crearViaje({
                vehiculo_id: asignacion.vehiculo.id,
                destino: asignacion.ruta_nombre
            });
            window.location.href = `vehiculo.html?id=${asignacion.vehiculo.id}&viaje=${viaje.id}&asignacion=${asignacion.id}`;
        } catch (error) {
            mensaje.textContent = error.message || "No se pudo registrar el viaje";
            mensaje.classList.remove("hidden");
            iniciarBtn.disabled = false;
        }
    });
}

// Si el conductor tiene una ruta asignada para MAÑANA y todavia no preparo
// la inspeccion del vehiculo para ella, se le ofrece hacerla de una vez --
// asi no le toca hacer inspeccion + preoperacional + firma la misma
// madrugada de la ruta. No crea ningun viaje (el viaje todavia no existe),
// solo manda a vehiculo.html en modo "preinspeccion". Devuelve si la
// tarjeta quedo visible -- inicializarConductorHome la usa para no mostrar
// tambien la seleccion manual (ya tiene ruta, no tiene sentido ofrecerle
// armar un viaje aparte).
function inicializarConductorPreinspeccion(asignacion) {
    if (!asignacion?.vehiculo || asignacion.inspeccion_completada) return false;

    const card = document.getElementById("conductorPreinspeccionCard");
    if (!card) return false;

    document.getElementById("conductorPreinspeccionRuta").textContent = asignacion.ruta_nombre || "Sin nombre";
    document.getElementById("conductorPreinspeccionPlaca").textContent = asignacion.vehiculo.placa || "";

    const link = document.getElementById("conductorPreinspeccionLink");
    link.href = `vehiculo.html?id=${asignacion.vehiculo.id}&asignacion=${asignacion.id}&modo=preinspeccion`;

    card.classList.remove("hidden");
    return true;
}

// Flujo manual de siempre: el conductor elige vehiculo y destino a mano
// (sin ruta asignada para hoy, o sin conductor vinculado a la asignacion).
async function inicializarConductorSeleccionManual() {
    document.getElementById("conductorSeleccionManual").classList.remove("hidden");

    const iniciarBtn = document.getElementById("conductorIniciarViajeBtn");
    const mensaje = document.getElementById("conductorMensaje");

    const [vehiculosResult, departamentosResult] = await Promise.allSettled([
        window.VehiAmb.api.getVehiculosCatalogo(),
        window.VehiAmb.ubicaciones.cargarDepartamentosCiudades()
    ]);

    if (vehiculosResult.status === "fulfilled") {
        renderConductorVehiculoGrid(vehiculosResult.value);
        initBuscadorVehiculo();
    } else {
        console.error(vehiculosResult.reason);
        document.getElementById("conductorVehiculoGrid").innerHTML =
            '<p class="dash-empty">No fue posible cargar los vehículos</p>';
    }

    if (departamentosResult.status === "fulfilled") {
        initSelectorUbicacion(departamentosResult.value);
    } else {
        console.error(departamentosResult.reason);
        document.getElementById("conductorDepartamentoSelect").innerHTML =
            '<option value="">No se pudo cargar el listado de departamentos</option>';
    }

    iniciarBtn.addEventListener("click", async () => {
        mensaje.classList.add("hidden");
        iniciarBtn.disabled = true;

        try {
            const viaje = await window.VehiAmb.api.crearViaje({
                vehiculo_id: conductorVehiculoSeleccionado,
                destino: obtenerConductorDestino()
            });
            window.location.href = `vehiculo.html?id=${conductorVehiculoSeleccionado}&viaje=${viaje.id}`;
        } catch (error) {
            mensaje.textContent = error.message || "No se pudo registrar el viaje";
            mensaje.classList.remove("hidden");
            iniciarBtn.disabled = false;
        }
    });
}

async function inicializarConductorHome(user) {
    document.getElementById("dashboardHome").classList.add("hidden");
    document.getElementById("conductorHome").classList.remove("hidden");

    const primerNombre = String(user?.nombre || "").trim().split(" ")[0];
    document.getElementById("conductorSaludo").textContent = primerNombre
        ? `${saludoSegunHora()}, ${primerNombre}`
        : saludoSegunHora();

    window.VehiAmb.api.getMisViajesRecientes()
        .then(pintarViajesRecientes)
        .catch((error) => {
            console.error(error);
            document.getElementById("conductorViajesRecientes").innerHTML =
                '<p class="dash-empty">No fue posible cargar tus últimos viajes</p>';
        });

    const [asignacionHoyResult, asignacionMananaResult] = await Promise.allSettled([
        window.VehiAmb.api.getAsignacionHoy(),
        window.VehiAmb.api.getAsignacionManana()
    ]);

    let tienePreinspeccionPendiente = false;
    if (asignacionMananaResult.status === "fulfilled") {
        tienePreinspeccionPendiente = inicializarConductorPreinspeccion(asignacionMananaResult.value);
    } else {
        console.error(asignacionMananaResult.reason);
    }

    const asignacion = asignacionHoyResult.status === "fulfilled" ? asignacionHoyResult.value : null;
    if (asignacionHoyResult.status === "rejected") console.error(asignacionHoyResult.reason);

    // "Tus ultimos viajes" solo tiene sentido cuando el conductor arma el
    // viaje el mismo dia (no sabe de antemano que vehiculo/ruta le toca, el
    // historial le da contexto) -- con una ruta ya asignada (hoy o mañana)
    // esa info ya esta arriba, en la tarjeta grande, y el historial abajo
    // solo estorba.
    const viajesPanel = document.querySelector(".conductor-viajes-panel");

    if (asignacion?.vehiculo) {
        viajesPanel?.classList.add("hidden");
        inicializarConductorAsignacionHoy(asignacion);
        return;
    }

    // La seleccion manual (armar un viaje sobre la marcha) solo tiene
    // sentido cuando el conductor no tiene ninguna ruta -- ni hoy, ni
    // mañana pendiente de inspeccionar.
    if (tienePreinspeccionPendiente) {
        viajesPanel?.classList.add("hidden");
        return;
    }

    await inicializarConductorSeleccionManual();
}

async function inicializarDashboard() {
    const user = await window.VehiAmb.auth.fetchCurrentUser();

    if (user?.rol === "Conductor") {
        await inicializarConductorHome(user);
        return;
    }

    const primerNombre = String(user?.nombre || "").trim().split(" ")[0];
    document.getElementById("dashboardSaludoNombre").textContent = primerNombre;

    // Los KPI ahora son accesos directos a su modulo (ver dash-cards en
    // index.html) -- se ocultan los que el rol actual no puede abrir, igual
    // que ya se hace con los botones del sidebar (sidebar.js).
    document.querySelectorAll(".dash-card[data-permission]").forEach((card) => {
        if (!window.VehiAmb.auth.hasPermission(card.dataset.permission)) {
            card.remove();
        }
    });

    const [vehiculosResult, mantenimientosResult, documentosResult, costosMesResult, costosMesAnteriorResult, conductoresResult, simitResult] = await Promise.allSettled([
        window.VehiAmb.api.getVehiculosCatalogo(),
        window.VehiAmb.api.getMantenimientos(),
        window.VehiAmb.api.getDocumentos(),
        window.VehiAmb.api.getCostosVehiculos(),
        window.VehiAmb.api.getCostosVehiculos(rangoMesAnterior()),
        window.VehiAmb.api.getConductores({ limit: 1 }),
        window.VehiAmb.api.getSimitEstadoFlota()
    ]);

    const vehiculos = vehiculosResult.status === "fulfilled" ? vehiculosResult.value : [];
    const mantenimientos = mantenimientosResult.status === "fulfilled" ? mantenimientosResult.value : [];
    const documentos = documentosResult.status === "fulfilled" ? documentosResult.value : [];
    // Si el rol no tiene permiso sobre Costos (costs.view), esta llamada
    // simplemente falla en silencio y el KPI queda solo con mantenimientos --
    // igual que se comportaba antes de este cambio.
    const costosOperativosMes = costosMesResult.status === "fulfilled" ? costosMesResult.value.items : [];
    const costosOperativosMesAnterior = costosMesAnteriorResult.status === "fulfilled" ? costosMesAnteriorResult.value.items : [];
    const totalConductores = conductoresResult.status === "fulfilled" ? conductoresResult.value.total : null;
    const estadoFlotaSimit = simitResult.status === "fulfilled" ? simitResult.value : [];

    if (vehiculosResult.status === "rejected") {
        console.error(vehiculosResult.reason);
        document.getElementById("fleetStatus").innerHTML =
            '<p class="dash-empty">No fue posible cargar los vehículos</p>';
    } else {
        pintarFlotaEstado(vehiculos);
    }

    if (mantenimientosResult.status === "rejected" && costosMesResult.status === "rejected") {
        console.error(mantenimientosResult.reason);
        document.getElementById("costosMes").innerHTML =
            '<p class="dash-empty">No fue posible cargar los gastos</p>';
    } else {
        pintarCostosMes(mantenimientos, costosOperativosMes);
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

    pintarResumen(vehiculos, mantenimientos, documentos, costosOperativosMes, costosOperativosMesAnterior);

    document.getElementById("total-conductores").textContent = totalConductores ?? "--";
    pintarComparendos(estadoFlotaSimit);
}

document.addEventListener("DOMContentLoaded", inicializarDashboard);
