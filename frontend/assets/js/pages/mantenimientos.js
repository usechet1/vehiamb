const mantenimientoForm = document.getElementById("mantenimientoForm");
const mantenimientosFilterForm = document.getElementById("mantenimientosFilterForm");
const mantenimientoSelect = document.getElementById("vehiculoMantenimiento");
const mantenimientosList = document.getElementById("mantenimientosList");
const mantenimientosKpisGrid = document.getElementById("mantenimientosKpisGrid");
const filterBusqueda = document.getElementById("filterBusqueda");
const filterTipo = document.getElementById("filterTipo");
const filterFechaDesde = document.getElementById("filterFechaDesde");
const filterFechaHasta = document.getElementById("filterFechaHasta");
const filterTipoTrigger = document.getElementById("filterTipoTrigger");
const filterTipoTriggerLabel = document.getElementById("filterTipoTriggerLabel");
const filterTipoPopover = document.getElementById("filterTipoPopover");
const filterFechasTrigger = document.getElementById("filterFechasTrigger");
const filterFechasTriggerLabel = document.getElementById("filterFechasTriggerLabel");
const filterFechasPopover = document.getElementById("filterFechasPopover");
const filtersChips = document.getElementById("filtersChips");
const filterSummary = document.getElementById("filterSummary");
const clearFiltersButton = document.getElementById("clearFiltersButton");
const loader = document.getElementById("loader");
const mensaje = document.getElementById("mensaje");
const mantenimientoFecha = document.getElementById("mantenimientoFecha");
const wizardStep1 = document.getElementById("wizardStep1");
const wizardStep2 = document.getElementById("wizardStep2");
const wizardStep3 = document.getElementById("wizardStep3");
const wizardStep1Next = document.getElementById("wizardStep1Next");
const wizardStep2Back = document.getElementById("wizardStep2Back");
const wizardStep3Back = document.getElementById("wizardStep3Back");
const wizardStepIndicators = document.querySelectorAll("#wizardSteps [data-step-indicator]");
const wizardStepConnectors = document.querySelectorAll("#wizardSteps .wizard-step-connector");
const tipoCardGrid = document.getElementById("tipoCardGrid");
const mantenimientoKilometraje = document.getElementById("mantenimientoKilometraje");
const kilometrajeHelp = document.getElementById("kilometrajeHelp");
const mantenimientoDescripcion = document.getElementById("mantenimientoDescripcion");
const descripcionVozButton = document.getElementById("descripcionVozButton");
const descripcionVozHelp = document.getElementById("descripcionVozHelp");
const repuestosData = document.getElementById("repuestosData");
const repuestosEstructuradosData = document.getElementById("repuestosEstructuradosData");
const repuestoInput = document.getElementById("repuestoInput");
const repuestoEquivalenciasPicker = document.getElementById("repuestoEquivalenciasPicker");
const repuestosSugeridosAviso = document.getElementById("repuestosSugeridosAviso");
const repuestoBusquedaAviso = document.getElementById("repuestoBusquedaAviso");
const repuestosList = document.getElementById("repuestosList");
const repuestosEmpty = document.getElementById("repuestosEmpty");
const repuestoNoEncontradoAviso = document.getElementById("repuestoNoEncontradoAviso");
const mostrarCrearRepuestoButton = document.getElementById("mostrarCrearRepuestoButton");
const repuestoCrearForm = document.getElementById("repuestoCrearForm");
const nuevoRepuestoCodigoInput = document.getElementById("nuevoRepuestoCodigoInput");
const nuevoRepuestoNombreInput = document.getElementById("nuevoRepuestoNombreInput");
const nuevoRepuestoCategoriaInput = document.getElementById("nuevoRepuestoCategoriaInput");
const nuevoRepuestoValorInput = document.getElementById("nuevoRepuestoValorInput");
const crearRepuestoButton = document.getElementById("crearRepuestoButton");
const viewEtiquetaButton = document.getElementById("viewEtiquetaButton");
const subirSalidaInventarioButton = document.getElementById("subirSalidaInventarioButton");
const salidaInventarioInput = document.getElementById("salidaInventarioInput");
const valorManoObraInput = document.getElementById("valorManoObraInput");
const costoTotalDisplay = document.getElementById("costoTotalDisplay");
const mntSummaryRepuestosCount = document.getElementById("mntSummaryRepuestosCount");
const mntSummaryRepuestosTotal = document.getElementById("mntSummaryRepuestosTotal");
const mntStep3BlockingReason = document.getElementById("mntStep3BlockingReason");
const mantenimientoTipo = document.getElementById("mantenimientoTipo");
const cambioAceiteFields = document.getElementById("cambioAceiteFields");
const proximoCambioKmInput = document.getElementById("proximoCambioKmInput");
const proximoCambioKmHelp = document.getElementById("proximoCambioKmHelp");
const proximoCambioFechaInput = document.getElementById("proximoCambioFechaInput");
const programacionTitle = document.getElementById("programacionTitle");
const proximaFechaGroup = document.getElementById("proximaFechaGroup");
const kilometrajeGroup = document.getElementById("kilometrajeGroup");
const vehiculoVaradoGroup = document.getElementById("vehiculoVaradoGroup");
const vehiculoVaradoInput = document.getElementById("vehiculoVaradoInput");
const manoObraRow = document.getElementById("manoObraRow");
const maintenanceDrawer = document.getElementById("maintenanceDrawer");
const maintenanceDrawerBackdrop = document.getElementById("maintenanceDrawerBackdrop");
const closeMaintenanceDrawer = document.getElementById("closeMaintenanceDrawer");
const maintenanceDrawerTitle = document.getElementById("maintenanceDrawerTitle");
const maintenanceDrawerSubtitle = document.getElementById("maintenanceDrawerSubtitle");
const maintenanceDrawerBody = document.getElementById("maintenanceDrawerBody");
const exportMaintenanceButton = document.getElementById("exportMaintenanceButton");
const exportMaintenanceExcelButton = document.getElementById("exportMaintenanceExcelButton");
const deleteMaintenanceButton = document.getElementById("deleteMaintenanceButton");
const approveMaintenanceButton = document.getElementById("approveMaintenanceButton");
const exportHistorialButton = document.getElementById("exportHistorialButton");
const exportHistorialExcelButton = document.getElementById("exportHistorialExcelButton");
const exportMenuTrigger = document.getElementById("exportMenuTrigger");
const exportMenuPopover = document.getElementById("exportMenuPopover");
const tabHistorialButton = document.getElementById("tabHistorialButton");
const tabRegistrarButton = document.getElementById("tabRegistrarButton");
const historialMantenimientosSection = document.getElementById("historialMantenimientosSection");
const registrarMantenimientoSection = document.getElementById("registrarMantenimientoSection");

let repuestosState = [];
let mantenimientosState = [];
let mantenimientosFiltradosState = [];
let vehiculosState = [];
let totalMantenimientosCount = 0;
let filtersRequestToken = 0;
let currentDetailItem = null;
let repuestoSeleccionado = null;
let sugeridosRequestToken = 0;

// Set de ids de repuestos permitidos para el vehiculo+tipo actual (cambio de
// aceite unicamente): el sugerido del vehiculo + sus equivalencias. `null`
// significa "sin restriccion" (tipos distintos a cambio_aceite).
let repuestosPermitidosVehiculo = null;

const tiposMantenimiento = {
    revision: "Revisión general",
    preventivo: "Preventivo",
    correctivo: "Correctivo",
    cambio_aceite: "Cambio de aceite",
    frenos: "Frenos",
    llantas: "Llantas",
    otro: "Otro"
};

const estadosMantenimiento = {
    pendiente: "Pendiente de aprobación",
    aprobado: "Aprobado",
    rechazado: "Rechazado",
    completado: "Completado"
};

// Dictado por voz para la descripcion del mantenimiento -- Web Speech API,
// sin libreria externa. Solo Chrome/Edge la traen bajo el prefijo webkit; si
// ningun navegador la expone, el boton se oculta en vez de fallar al hacer
// clic.
function setupDictadoVoz(button, textarea, helpEl) {
    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!button || !textarea || !SpeechRecognitionClass) {
        button?.classList.add("hidden");
        return;
    }

    const recognition = new SpeechRecognitionClass();
    recognition.lang = "es-CO";
    recognition.interimResults = false;
    recognition.continuous = false;

    let escuchando = false;

    recognition.addEventListener("result", (event) => {
        const texto = event.results[0][0].transcript.trim();
        if (!texto) return;
        const separador = textarea.value.trim() ? " " : "";
        textarea.value = `${textarea.value}${separador}${texto}`;
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });

    recognition.addEventListener("error", (event) => {
        if (!helpEl) return;
        helpEl.textContent = event.error === "not-allowed"
            ? "Se necesita permiso del micrófono para dictar."
            : "No se pudo reconocer el audio, intenta de nuevo.";
        helpEl.classList.remove("hidden");
    });

    recognition.addEventListener("end", () => {
        escuchando = false;
        button.classList.remove("is-recording");
    });

    button.addEventListener("click", () => {
        if (escuchando) {
            recognition.stop();
            return;
        }

        helpEl?.classList.add("hidden");
        try {
            recognition.start();
            escuchando = true;
            button.classList.add("is-recording");
        } catch (error) {
            // Ya habia una sesion de reconocimiento activa -- se ignora, el
            // usuario solo tiene que volver a hacer clic.
        }
    });
}

setupDictadoVoz(descripcionVozButton, mantenimientoDescripcion, descripcionVozHelp);

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

// Solo "pendiente"/"rechazado" son excepcionales y necesitan una etiqueta con
// color + una accion real ("Revisar") -- lo normal (completado/aprobado) no
// necesita destacarse, solo un texto en verde sin fondo.
function estadoInfo(item) {
    if (item.estado === "pendiente") {
        return { badge: true, clase: "pill-warning", texto: "Pendiente de aprobación", accion: "Revisar", esExcepcion: true };
    }
    if (item.estado === "rechazado") {
        return { badge: true, clase: "pill-danger", texto: "Rechazado", accion: "Revisar", esExcepcion: true };
    }
    return { badge: false, texto: estadosMantenimiento[item.estado] || "Completado", accion: "Ver detalle", esExcepcion: false };
}

function calcularKpisMantenimientos(mantenimientos) {
    const mesActual = new Date().toISOString().slice(0, 7);
    const vehiculosEnTaller = new Set();
    let pendientes = 0;
    let esteMes = 0;
    let gastoEsteMes = 0;

    for (const item of mantenimientos) {
        if (item.estado === "pendiente") {
            pendientes += 1;

            // Solo cuenta como "en taller" mientras el mantenimiento que lo
            // marco siga pendiente -- una vez se aprueba/rechaza, el vehiculo
            // ya quedo resuelto aunque ese registro conserve vehiculo_varado
            // en true como snapshot historico de cuando se creo.
            if (item.vehiculo_varado) vehiculosEnTaller.add(item.vehiculo_id);
        }

        if (String(item.fecha || "").slice(0, 7) === mesActual) {
            esteMes += 1;
            gastoEsteMes += Number(item.valor || 0);
        }
    }

    return { pendientes, enTaller: vehiculosEnTaller.size, esteMes, gastoEsteMes };
}

function renderKpisMantenimientos(mantenimientos) {
    const kpis = calcularKpisMantenimientos(mantenimientos);

    mantenimientosKpisGrid.innerHTML = `
        <div class="kpi-card" style="--kpi-accent: var(--color-warning)">
            <div class="kpi-label">Pendientes de aprobación</div>
            <div class="kpi-value">${kpis.pendientes}</div>
        </div>
        <div class="kpi-card" style="--kpi-accent: var(--color-primary)">
            <div class="kpi-label">Vehículos en taller</div>
            <div class="kpi-value">${kpis.enTaller}</div>
        </div>
        <div class="kpi-card" style="--kpi-accent: var(--color-success)">
            <div class="kpi-label">Mantenimientos este mes</div>
            <div class="kpi-value">${kpis.esteMes}</div>
        </div>
        <div class="kpi-card" style="--kpi-accent: var(--color-success)">
            <div class="kpi-label">Gasto este mes</div>
            <div class="kpi-value">${formatCurrency(kpis.gastoEsteMes)}</div>
        </div>
    `;
}

function hoyISO() {
    const hoy = new Date();
    const offset = hoy.getTimezoneOffset();
    return new Date(hoy.getTime() - offset * 60000).toISOString().slice(0, 10);
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
    if (!value) return "Sin fecha";
    return new Date(value).toLocaleString("es-CO", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function selectedVehicle() {
    return vehiculosState.find((vehiculo) => String(vehiculo.id) === String(mantenimientoSelect.value));
}

function fillVehicleSelect(select, vehiculos, placeholder = "Selecciona un vehículo", valueField = "id") {
    const previousValue = select.value;
    select.innerHTML = `<option value="">${placeholder}</option>`;

    if (!vehiculos.length) {
        select.innerHTML = '<option value="">Primero registra un vehiculo</option>';
        return;
    }

    vehiculos.forEach((vehiculo) => {
        const option = document.createElement("option");
        option.value = vehiculo[valueField] || "";
        option.dataset.kilometraje = vehiculo.kilometraje_actual || 0;
        option.textContent = `${vehiculo.placa} - ${vehiculo.marca} ${vehiculo.modelo}`;
        select.appendChild(option);
    });

    if (previousValue && Array.from(select.options).some((option) => option.value === previousValue)) {
        select.value = previousValue;
    }
}

function updateKilometrajeValidation() {
    const vehiculo = selectedVehicle();
    const minKm = Number(vehiculo?.kilometraje_actual || 0);

    mantenimientoKilometraje.setCustomValidity("");

    if (!vehiculo) {
        kilometrajeHelp.textContent = "Selecciona un vehículo para validar el kilometraje.";
        return;
    }

    kilometrajeHelp.textContent = `Kilometraje actual registrado: ${minKm.toLocaleString("es-CO")} km. El nuevo valor no puede ser menor.`;

    const value = window.VehiAmb.ui.parseFormattedNumber(mantenimientoKilometraje.value);
    if (value !== "" && Number(value) < minKm) {
        mantenimientoKilometraje.setCustomValidity(`El kilometraje debe ser mayor o igual a ${minKm.toLocaleString("es-CO")} km.`);
    }
}

function validateKilometrajeBeforeSubmit() {
    updateKilometrajeValidation();

    // Se evita reportValidity() (globo nativo del navegador, poco confiable
    // en moviles) y en su lugar se usa el toast + foco/scroll al campo.
    if (!mantenimientoKilometraje.checkValidity()) {
        mantenimientoKilometraje.focus();
        mantenimientoKilometraje.scrollIntoView({ behavior: "smooth", block: "center" });
        window.VehiAmb.ui.showMessage(mensaje, mantenimientoKilometraje.validationMessage, "error");
        return false;
    }

    return true;
}

// Se muestra proactivamente junto a los botones de guardar (no solo como
// toast despues de un intento fallido) -- "que falta para guardar", no solo
// "no se pudo guardar".
function actualizarBloqueoStep3() {
    const bloqueado = mantenimientoTipo.value === "cambio_aceite" && !proximoCambioKmInput.value;

    mntStep3BlockingReason.textContent = bloqueado
        ? "Este vehículo no tiene intervalo de cambio configurado -- no se puede guardar el cambio de aceite."
        : "";
    mntStep3BlockingReason.classList.toggle("hidden", !bloqueado);
}

// La proxima fecha de un cambio de aceite se sugiere sola (fecha del
// mantenimiento + 3 meses) para no dejar el campo vacio, pero sigue siendo
// editable -- una vez que el usuario la toca a mano, se deja de recalcular
// para no pisarle la eleccion.
let proximaFechaEditadaManualmente = false;

function sumarMeses(fechaISO, meses) {
    if (!fechaISO) return "";
    const fecha = new Date(`${fechaISO}T00:00:00`);
    if (Number.isNaN(fecha.getTime())) return "";

    fecha.setMonth(fecha.getMonth() + meses);
    const yyyy = fecha.getFullYear();
    const mm = String(fecha.getMonth() + 1).padStart(2, "0");
    const dd = String(fecha.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

function autocompletarProximaFecha() {
    if (mantenimientoTipo.value !== "cambio_aceite" || proximaFechaEditadaManualmente) return;
    proximoCambioFechaInput.value = sumarMeses(mantenimientoFecha.value, 3);
}

function updateCambioAceiteFields() {
    const isCambioAceite = mantenimientoTipo.value === "cambio_aceite";

    programacionTitle.classList.toggle("hidden", !isCambioAceite);
    cambioAceiteFields.classList.toggle("hidden", !isCambioAceite);
    proximaFechaGroup.classList.toggle("hidden", !isCambioAceite);
    kilometrajeGroup.classList.toggle("mnt-span-all", !isCambioAceite);
    proximoCambioFechaInput.required = isCambioAceite;

    // "Vehiculo varado" y "Mano de obra" no aplican a un cambio de aceite
    // (es rutina, no deja el vehiculo fuera de servicio ni tiene mano de
    // obra aparte) -- se ocultan y se resetean para que no quede un valor
    // viejo guardado sin que se vea en pantalla.
    vehiculoVaradoGroup.classList.toggle("hidden", isCambioAceite);
    manoObraRow.classList.toggle("hidden", isCambioAceite);
    if (isCambioAceite) {
        vehiculoVaradoInput.checked = false;
        valorManoObraInput.value = "$ 0";
        updateCostoTotal();
        autocompletarProximaFecha();
    }

    if (!isCambioAceite) {
        proximoCambioKmInput.value = "";
        proximoCambioKmHelp.textContent = "";
        proximoCambioFechaInput.value = "";
        proximaFechaEditadaManualmente = false;
        repuestosSugeridosAviso.classList.add("hidden");
        repuestosPermitidosVehiculo = null;
        actualizarEstadoBusquedaRepuesto();
        actualizarBloqueoStep3();
        return;
    }

    cargarRepuestosSugeridos();
}

function goToWizardStep(step) {
    [wizardStep1, wizardStep2, wizardStep3].forEach((panel, index) => {
        panel.classList.toggle("hidden", index + 1 !== step);
    });

    wizardStepIndicators.forEach((indicator) => {
        const indicatorStep = Number(indicator.dataset.stepIndicator);
        indicator.classList.toggle("is-active", indicatorStep === step);
        indicator.classList.toggle("is-done", indicatorStep < step);
    });

    wizardStepConnectors.forEach((connector, index) => {
        connector.classList.toggle("is-done", index + 1 < step);
    });

    registrarMantenimientoSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

function validateWizardStep1() {
    if (!mantenimientoSelect.checkValidity()) {
        mantenimientoSelect.focus();
        window.VehiAmb.ui.showMessage(mensaje, "Selecciona un vehículo para continuar", "error");
        return false;
    }

    if (!mantenimientoFecha.checkValidity()) {
        mantenimientoFecha.focus();
        window.VehiAmb.ui.showMessage(mensaje, "Selecciona una fecha para continuar", "error");
        return false;
    }

    return true;
}

function seleccionarTipoCard(tipo) {
    mantenimientoTipo.value = tipo;
    mantenimientoTipo.dispatchEvent(new Event("change"));

    tipoCardGrid.querySelectorAll(".type-card").forEach((card) => {
        card.classList.toggle("is-selected", card.dataset.tipo === tipo);
    });
}

wizardStep1Next.addEventListener("click", () => {
    if (!validateWizardStep1()) return;
    goToWizardStep(2);
});

wizardStep2Back.addEventListener("click", () => goToWizardStep(1));
wizardStep3Back.addEventListener("click", () => goToWizardStep(2));

tipoCardGrid.addEventListener("click", (event) => {
    const card = event.target.closest(".type-card");
    if (!card) return;
    seleccionarTipoCard(card.dataset.tipo);
    goToWizardStep(3);
});

/**
 * Habilita/deshabilita el buscador de repuestos y muestra el aviso
 * correspondiente segun si hay restriccion vigente por vehiculo (solo aplica
 * a cambio_aceite: el excel de configuracion define que repuestos usa cada
 * vehiculo puntual, no se puede mezclar con los de otro).
 */
function actualizarEstadoBusquedaRepuesto() {
    const isCambioAceite = mantenimientoTipo.value === "cambio_aceite" && window.VehiAmb.auth.hasPermission("vehicles.repuestos_sugeridos");

    if (!isCambioAceite) {
        repuestoInput.disabled = false;
        repuestoInput.placeholder = "Buscar repuesto del catálogo...";
        repuestoBusquedaAviso.classList.add("hidden");
        return;
    }

    const vehiculo = selectedVehicle();
    const sinPermitidos = !repuestosPermitidosVehiculo || repuestosPermitidosVehiculo.size === 0;

    repuestoInput.disabled = !vehiculo || sinPermitidos;

    if (!vehiculo) {
        repuestoInput.placeholder = "Selecciona un vehículo primero...";
        repuestoBusquedaAviso.classList.add("hidden");
    } else if (sinPermitidos) {
        repuestoInput.placeholder = "Sin repuestos configurados para este vehículo";
        repuestoBusquedaAviso.textContent = "Este vehículo no tiene repuestos configurados para cambio de aceite. Configúralos desde su ficha.";
        repuestoBusquedaAviso.classList.remove("hidden");
    } else {
        repuestoInput.placeholder = "Buscar entre los repuestos configurados para este vehículo...";
        repuestoBusquedaAviso.classList.add("hidden");
    }
}

// "Próximo cambio (km)" se calcula sobre el kilometraje que se esta
// digitando para ESTE mantenimiento (no el kilometraje_actual guardado en
// la ficha del vehiculo, que puede estar desactualizado) -- por eso el
// campo de kilometraje va primero en el formulario y este calculo se
// recalcula en vivo cada vez que cambia. Si todavia no se ha escrito nada,
// se usa el kilometraje de la ficha solo como vista previa inicial. El
// resultado sigue siendo de solo lectura: se corrige configurando el
// intervalo en la ficha del vehiculo, no escribiendolo aca a mano.
function actualizarProximoCambioKm(vehiculo) {
    proximoCambioKmInput.value = "";
    proximoCambioKmHelp.textContent = "";

    if (!vehiculo) return;

    if (!vehiculo.intervalo_cambio_aceite_km) {
        proximoCambioKmHelp.textContent = "Este vehículo no tiene un intervalo de cambio configurado. Configúralo desde su ficha.";
        return;
    }

    const intervalo = Number(vehiculo.intervalo_cambio_aceite_km);
    const kmDigitado = Number(window.VehiAmb.ui.parseFormattedNumber(mantenimientoKilometraje.value));
    const kmBase = kmDigitado > 0 ? kmDigitado : Number(vehiculo.kilometraje_actual || 0);

    proximoCambioKmInput.value = window.VehiAmb.ui.formatearNumeroParaMostrar(Math.round(kmBase + intervalo));
    proximoCambioKmHelp.textContent = `A los próximos ${intervalo.toLocaleString("es-CO")} km`;
}

/**
 * Cuando el tipo es "cambio de aceite" y hay un vehiculo seleccionado, trae
 * los repuestos configurados para ese vehiculo (ficha del vehiculo) y los
 * pre-llena en el builder -- el usuario puede quitarlos o agregar otros.
 * Cada sugerido pasa por la misma verificacion de disponibilidad que un
 * repuesto elegido manualmente (principal con stock -> se usa; sin stock ->
 * se ofrece la primera equivalencia disponible automaticamente).
 *
 * Ademas calcula el set de repuestos "permitidos" para este vehiculo (los
 * configurados + sus equivalencias) para restringir el buscador manual: no
 * se puede usar en un vehiculo un repuesto que el excel/ficha configuro para
 * otro vehiculo distinto.
 */
async function cargarRepuestosSugeridos() {
    const vehiculo = selectedVehicle();
    limpiarSeleccionRepuesto();
    repuestoInput.value = "";

    if (mantenimientoTipo.value !== "cambio_aceite") {
        repuestosPermitidosVehiculo = null;
        actualizarEstadoBusquedaRepuesto();
        return;
    }

    actualizarProximoCambioKm(vehiculo);
    actualizarBloqueoStep3();

    // Algunas empresas no usan repuestos sugeridos para cambio de aceite (ver
    // empresas.modulos_deshabilitados): para esas, cambio de aceite se
    // comporta como cualquier otro tipo de mantenimiento -- busqueda libre de
    // repuestos, sin pre-llenado ni restriccion.
    if (!window.VehiAmb.auth.hasPermission("vehicles.repuestos_sugeridos")) {
        repuestosPermitidosVehiculo = null;
        actualizarEstadoBusquedaRepuesto();
        return;
    }

    if (!vehiculo) {
        repuestosPermitidosVehiculo = new Set();
        actualizarEstadoBusquedaRepuesto();
        return;
    }

    const requestToken = ++sugeridosRequestToken;

    let sugeridos = [];
    try {
        const respuesta = await window.VehiAmb.api.getVehiculoRepuestosSugeridos(vehiculo.id, "cambio_aceite");
        sugeridos = respuesta.items;
    } catch (error) {
        return;
    }
    if (requestToken !== sugeridosRequestToken) return;

    const permitidos = new Set(sugeridos.map((item) => item.repuesto_id));
    try {
        const equivalenciasPorSugerido = await Promise.all(
            sugeridos.map((item) => window.VehiAmb.api.getRepuestoEquivalencias(item.repuesto_id).catch(() => []))
        );
        equivalenciasPorSugerido.forEach((lista) => lista.forEach((eq) => permitidos.add(eq.repuesto_equivalente_id)));
    } catch (error) {
        // Si fallan las equivalencias, al menos queda la restriccion por los sugeridos.
    }
    if (requestToken !== sugeridosRequestToken) return;

    repuestosPermitidosVehiculo = permitidos;
    actualizarEstadoBusquedaRepuesto();

    if (!sugeridos.length) return;

    repuestosState = [];

    const sinStock = [];

    for (const sugerido of sugeridos) {
        let disponibilidad;
        try {
            disponibilidad = await window.VehiAmb.api.getRepuestoDisponibilidad(sugerido.repuesto_id);
        } catch (error) {
            continue;
        }
        if (requestToken !== sugeridosRequestToken) return;

        // El aceite (medido por volumen: GLS/GLN/LTR) es el unico repuesto
        // sugerido que NO es obligatorio en un cambio de aceite (se puede
        // desmarcar, a diferencia de los filtros que van en UND) -- pero
        // todos, obligatorios o no, arrancan seleccionados: son exactamente
        // los que el excel de configuracion define para este vehiculo.
        const esAceite = String(sugerido.unidad_medida || "").toUpperCase() !== "UND";
        const obligatorio = !esAceite;

        // No basta con "tiene algo de stock" (> 0): si el principal tiene
        // menos del que este cambio de aceite necesita (ej. 0.5 disponible
        // pero se necesitan 2.5), hay que saltar al equivalente en vez de
        // dejarlo seleccionado con stock insuficiente -- antes esto elegia
        // el principal con cualquier stock mayor a cero, sin importar si
        // alcanzaba, y nunca llegaba a ofrecer el equivalente aunque tuviera
        // de sobra.
        const cantidadRequerida = Number(sugerido.cantidad || 1);

        if (disponibilidad.principal.stock_disponible >= cantidadRequerida) {
            repuestosState.push({
                repuesto: sugerido.nombre,
                proveedor: "",
                valor: Number(sugerido.valor_promedio || 0) * Number(sugerido.cantidad || 1),
                notas: "",
                repuesto_id: sugerido.repuesto_id,
                cantidad: Number(sugerido.cantidad || 1),
                valor_unitario: Number(sugerido.valor_promedio || 0),
                incluido: true,
                obligatorio,
                cantidadFija: true
            });
        } else if (disponibilidad.equivalencias.length) {
            const elegida = disponibilidad.equivalencias.find((eq) => eq.stock_disponible >= cantidadRequerida)
                || disponibilidad.equivalencias[0];
            repuestosState.push({
                repuesto: elegida.nombre,
                proveedor: "",
                valor: Number(elegida.valor_promedio || 0) * Number(sugerido.cantidad || 1),
                notas: `Sustituye a ${sugerido.nombre} (sin stock)`,
                repuesto_id: elegida.id,
                repuesto_sugerido_id: sugerido.repuesto_id,
                motivo_sustitucion: "Sin stock del repuesto principal",
                cantidad: Number(sugerido.cantidad || 1),
                valor_unitario: Number(elegida.valor_promedio || 0),
                incluido: true,
                obligatorio,
                cantidadFija: true,
                // Ni el equivalente elegido alcanza (se usa igual, es el
                // "menos malo" disponible) -- se marca para que se vea en el
                // builder y quede claro por que el backend va a rechazar el
                // guardado hasta que haya stock suficiente.
                sinStock: elegida.stock_disponible < cantidadRequerida
            });
        } else {
            // Sin ningun equivalente configurado: antes esto se descartaba
            // en silencio y el mantenimiento se guardaba sin este repuesto,
            // sin que nada lo bloqueara. Ahora se deja el principal en la
            // lista igual, marcado sin stock, para que se vea y para que el
            // backend lo rechace (en vez de desaparecer sin dejar rastro).
            repuestosState.push({
                repuesto: sugerido.nombre,
                proveedor: "",
                valor: Number(sugerido.valor_promedio || 0) * Number(sugerido.cantidad || 1),
                notas: "",
                repuesto_id: sugerido.repuesto_id,
                cantidad: Number(sugerido.cantidad || 1),
                valor_unitario: Number(sugerido.valor_promedio || 0),
                incluido: true,
                obligatorio,
                cantidadFija: true,
                sinStock: true
            });
            sinStock.push(sugerido.nombre);
        }
    }

    renderRepuestosBuilder();

    if (sinStock.length) {
        repuestosSugeridosAviso.textContent = `Sin repuesto compatible disponible para: ${sinStock.join(", ")}. Queda marcado "Sin stock" abajo -- no podrás guardar hasta resolverlo.`;
        repuestosSugeridosAviso.classList.remove("hidden");
    } else {
        repuestosSugeridosAviso.classList.add("hidden");
    }
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
            // Fallback para formatos antiguos en texto plano.
        }

        return value
            .split(/\n|,/)
            .map((item) => ({ repuesto: item.trim(), proveedor: "", valor: "", notas: "" }))
            .filter((item) => item.repuesto);
    }

    return [];
}

// El JSON legado (mantenimientos.repuestos) sigue teniendo exactamente estos
// 4 campos, sin importar los datos internos nuevos que traiga cada item --
// el render del detalle (renderDetailRepuestos) no necesita cambiar una
// linea.
function syncRepuestosField() {
    const incluidos = repuestosState.filter((item) => item.incluido !== false);

    repuestosData.value = JSON.stringify(
        incluidos.map((item) => ({ repuesto: item.repuesto, proveedor: item.proveedor, valor: item.valor, notas: item.notas }))
    );

    repuestosEstructuradosData.value = JSON.stringify(
        incluidos
            .filter((item) => item.repuesto_id)
            .map((item) => ({
                repuesto_id: item.repuesto_id,
                cantidad: item.cantidad || 1,
                repuesto_sugerido_id: item.repuesto_sugerido_id || null,
                motivo_sustitucion: item.motivo_sustitucion || null
            }))
    );
}

function updateCostoTotal() {
    const manoObra = Number(window.VehiAmb.ui.parseFormattedMoneda(valorManoObraInput.value));
    const repuestosIncluidos = repuestosState.filter((item) => item.incluido !== false);
    const totalRepuestos = repuestosIncluidos.reduce((sum, item) => sum + Number(item.valor || 0), 0);

    mntSummaryRepuestosCount.textContent = repuestosIncluidos.length;
    mntSummaryRepuestosTotal.textContent = formatCurrency(totalRepuestos);
    costoTotalDisplay.textContent = formatCurrency(manoObra + totalRepuestos);
}

// Cada repuesto (sugerido o agregado a mano) trae un checkbox marcado por
// defecto ("incluido"): desmarcarlo lo excluye del total y de lo que se
// guarda, sin borrarlo de la lista -- asi el usuario puede desmarcar/volver a
// marcar sin perder el item ni tener que buscarlo de nuevo. Proveedor/notas
// nunca muestran su ausencia como texto ("Sin proveedor") -- son inputs
// "fantasma" que solo invitan a llenarse via placeholder. Un obligatorio sin
// precio se resalta como fila-alerta con el input de valor ahi mismo.
function renderRepuestosBuilder() {
    repuestosList.innerHTML = repuestosState.map((item, index) => {
        const faltaPrecio = item.obligatorio && !item.valor;

        return `
        <li class="mnt-repuesto-row${item.incluido === false ? " mnt-repuesto-row--excluido" : ""}${(faltaPrecio || item.sinStock) ? " mnt-repuesto-row--alerta" : ""}">
            <label class="mnt-repuesto-check" title="${item.obligatorio ? "Repuesto obligatorio" : ""}">
                <input type="checkbox" data-index="${index}" ${item.incluido !== false ? "checked" : ""} ${item.obligatorio ? "disabled" : ""}>
            </label>
            <div class="mnt-repuesto-main">
                <div class="mnt-repuesto-name">${escapeHtml(item.repuesto)}${item.obligatorio ? ' <span class="simple-checklist-badge">Obligatorio</span>' : ""}${item.sinStock ? ' <span class="pill pill-danger">Sin stock</span>' : ""}</div>
                <div class="mnt-repuesto-extra">
                    <input type="text" class="mnt-repuesto-ghost-input" data-field="proveedor" data-index="${index}" placeholder="+ proveedor" value="${escapeHtml(item.proveedor || "")}">
                    <input type="text" class="mnt-repuesto-ghost-input" data-field="notas" data-index="${index}" placeholder="+ notas" value="${escapeHtml(item.notas || "")}">
                </div>
                ${item.motivo_sustitucion ? `<div class="field-help">${escapeHtml(item.motivo_sustitucion)}</div>` : ""}
                ${faltaPrecio ? `<div class="mnt-repuesto-alerta-texto">Falta el valor de este repuesto obligatorio</div>` : ""}
                ${item.sinStock ? `<div class="mnt-repuesto-alerta-texto">No hay stock suficiente -- no podrás guardar hasta que haya disponible o cambies el repuesto.</div>` : ""}
            </div>
            <input type="number" class="mnt-repuesto-cantidad" data-index="${index}" value="${item.cantidad || 1}" min="0.01" step="0.01" aria-label="Cantidad" ${item.cantidadFija ? `readonly title="Cantidad configurada para este vehículo, no editable"` : ""}>
            <input type="text" inputmode="numeric" class="mnt-repuesto-valor" data-index="${index}" value="${item.valor ? formatCurrency(item.valor) : ""}" placeholder="$ 0" aria-label="Valor">
        </li>
    `;
    }).join("");

    repuestosEmpty.classList.toggle("hidden", repuestosState.length > 0);
    syncRepuestosField();
    updateCostoTotal();

    repuestosList.querySelectorAll(".mnt-repuesto-check input:not([disabled])").forEach((checkbox) => {
        checkbox.addEventListener("change", () => {
            const index = Number(checkbox.dataset.index);
            repuestosState[index].incluido = checkbox.checked;
            renderRepuestosBuilder();
        });
    });

    repuestosList.querySelectorAll(".mnt-repuesto-ghost-input").forEach((input) => {
        input.addEventListener("change", () => {
            const index = Number(input.dataset.index);
            repuestosState[index][input.dataset.field] = input.value.trim();
            syncRepuestosField();
        });
    });

    repuestosList.querySelectorAll(".mnt-repuesto-cantidad").forEach((input) => {
        input.addEventListener("change", () => {
            const index = Number(input.dataset.index);
            const item = repuestosState[index];
            const cantidad = Number(input.value) > 0 ? Number(input.value) : 1;

            // Si el valor actual coincide con lo que daba la cantidad
            // anterior x el unitario, se recalcula con la cantidad nueva --
            // si el usuario ya habia sobreescrito el precio a mano, se
            // respeta tal cual y no se pisa.
            const valorEsperadoAnterior = Number(item.valor_unitario || 0) * Number(item.cantidad || 1);
            if (item.valor_unitario && Number(item.valor || 0) === valorEsperadoAnterior) {
                item.valor = Number(item.valor_unitario) * cantidad;
            }
            item.cantidad = cantidad;
            renderRepuestosBuilder();
        });
    });

    repuestosList.querySelectorAll(".mnt-repuesto-valor").forEach((input) => {
        input.addEventListener("input", () => window.VehiAmb.ui.formatearMonedaEnVivo(input));
        input.addEventListener("change", () => {
            const index = Number(input.dataset.index);
            repuestosState[index].valor = Number(window.VehiAmb.ui.parseFormattedMoneda(input.value));
            renderRepuestosBuilder();
        });
    });
}

function limpiarSeleccionRepuesto() {
    repuestoSeleccionado = null;
    repuestoEquivalenciasPicker.classList.add("hidden");
    repuestoEquivalenciasPicker.innerHTML = "";
}

function mostrarEquivalencias(principalNombre, equivalencias) {
    if (!equivalencias.length) {
        repuestoEquivalenciasPicker.innerHTML = `<p class="repuesto-sin-stock-aviso">No existen repuestos compatibles disponibles para este mantenimiento.</p>`;
        repuestoEquivalenciasPicker.classList.remove("hidden");
        return;
    }

    repuestoEquivalenciasPicker.innerHTML = `
        <p class="field-help">"${principalNombre}" sin existencias. Repuestos compatibles disponibles:</p>
        ${equivalencias.map((eq) => `
            <button type="button" class="btn-secondary repuesto-equivalencia-opcion" data-id="${eq.id}" data-nombre="${eq.nombre}" data-valor-promedio="${eq.valor_promedio || 0}">
                ✔ ${eq.nombre} (${eq.stock_disponible} unidades)
            </button>
        `).join("")}
    `;
    repuestoEquivalenciasPicker.classList.remove("hidden");
}

// Elegir un resultado del autocomplete ya agrega la fila de una vez (cantidad
// 1, proveedor/notas vacios) -- los detalles se editan en linea despues,
// sin un boton "Agregar" ni campos sueltos que llenar antes. La unica pausa
// es cuando el principal no tiene stock: ahi si hay que elegir un
// equivalente antes de que se pueda agregar algo.
async function seleccionarRepuestoDelAutocomplete(repuesto) {
    repuestoEquivalenciasPicker.classList.add("hidden");
    repuestoEquivalenciasPicker.innerHTML = "";

    let disponibilidad;
    try {
        disponibilidad = await window.VehiAmb.api.getRepuestoDisponibilidad(repuesto.id);
    } catch (error) {
        disponibilidad = null;
    }

    const stockDisponible = disponibilidad ? disponibilidad.principal.stock_disponible : Number(repuesto.stock_disponible || 0);

    if (stockDisponible <= 0 && disponibilidad) {
        repuestoSeleccionado = repuesto;
        // Las equivalencias tambien se restringen al set permitido del
        // vehiculo: un repuesto puede ser equivalente de otro en el catalogo
        // general sin estar configurado para este vehiculo puntual.
        const restringir = mantenimientoTipo.value === "cambio_aceite" && repuestosPermitidosVehiculo;
        const equivalenciasPermitidas = restringir
            ? disponibilidad.equivalencias.filter((eq) => repuestosPermitidosVehiculo.has(eq.id))
            : disponibilidad.equivalencias;
        mostrarEquivalencias(repuesto.nombre, equivalenciasPermitidas);
        return;
    }

    agregarRepuestoAlBuilder(repuesto, 1);
}

function agregarRepuestoAlBuilder(repuesto, cantidad, { repuestoSugeridoId, motivoSustitucion } = {}) {
    repuestosState.push({
        repuesto: repuesto.nombre,
        proveedor: "",
        valor: Number(repuesto.valor_promedio || 0) * cantidad,
        notas: "",
        repuesto_id: repuesto.id,
        repuesto_sugerido_id: repuestoSugeridoId || null,
        motivo_sustitucion: motivoSustitucion || null,
        cantidad,
        valor_unitario: Number(repuesto.valor_promedio || 0),
        incluido: true
    });

    repuestoInput.value = "";
    limpiarSeleccionRepuesto();
    renderRepuestosBuilder();
    repuestoInput.focus();
}

// Si la busqueda en el catalogo no encuentra nada, se ofrece crear el
// repuesto ahi mismo (codigo interno + nombre son los unicos obligatorios en
// el backend) y agregarlo de una vez al mantenimiento actual.
function ocultarCrearRepuesto() {
    repuestoNoEncontradoAviso.classList.add("hidden");
    repuestoCrearForm.classList.add("hidden");
}

function mostrarAvisoRepuestoNoEncontrado(term) {
    if (!term) {
        ocultarCrearRepuesto();
        return;
    }

    repuestoCrearForm.classList.add("hidden");
    repuestoNoEncontradoAviso.classList.remove("hidden");
}

function actualizarEstadoCrearRepuesto() {
    crearRepuestoButton.disabled = !nuevoRepuestoCodigoInput.value.trim() || !nuevoRepuestoNombreInput.value.trim();
}

mostrarCrearRepuestoButton.addEventListener("click", () => {
    repuestoNoEncontradoAviso.classList.add("hidden");
    repuestoCrearForm.classList.remove("hidden");
    nuevoRepuestoNombreInput.value = repuestoInput.value.trim();
    nuevoRepuestoCodigoInput.value = "";
    nuevoRepuestoValorInput.value = "";
    actualizarEstadoCrearRepuesto();
    nuevoRepuestoCodigoInput.focus();
});

nuevoRepuestoCodigoInput.addEventListener("input", actualizarEstadoCrearRepuesto);
nuevoRepuestoNombreInput.addEventListener("input", actualizarEstadoCrearRepuesto);
nuevoRepuestoValorInput.addEventListener("input", () => window.VehiAmb.ui.formatearMonedaEnVivo(nuevoRepuestoValorInput));

crearRepuestoButton.addEventListener("click", async () => {
    const payload = {
        codigo_interno: nuevoRepuestoCodigoInput.value.trim(),
        nombre: nuevoRepuestoNombreInput.value.trim(),
        categoria: nuevoRepuestoCategoriaInput.value,
        valor_promedio: Number(window.VehiAmb.ui.parseFormattedMoneda(nuevoRepuestoValorInput.value))
    };

    crearRepuestoButton.disabled = true;
    try {
        const nuevoRepuesto = await window.VehiAmb.api.createRepuesto(payload);
        agregarRepuestoAlBuilder(nuevoRepuesto, 1);

        nuevoRepuestoCodigoInput.value = "";
        nuevoRepuestoNombreInput.value = "";
        nuevoRepuestoCategoriaInput.value = "otros";
        nuevoRepuestoValorInput.value = "";
        ocultarCrearRepuesto();
        window.VehiAmb.ui.showMessage(mensaje, "Repuesto creado y agregado al catálogo");
    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudo crear el repuesto", "error");
    } finally {
        actualizarEstadoCrearRepuesto();
    }
});

repuestoEquivalenciasPicker.addEventListener("click", (event) => {
    const button = event.target.closest(".repuesto-equivalencia-opcion");
    if (!button || !repuestoSeleccionado) return;

    agregarRepuestoAlBuilder(
        { id: Number(button.dataset.id), nombre: button.dataset.nombre, valor_promedio: Number(button.dataset.valorPromedio || 0) },
        1,
        { repuestoSugeridoId: repuestoSeleccionado.id, motivoSustitucion: `Sin stock de ${repuestoSeleccionado.nombre}` }
    );
});

async function buscarRepuestosParaMantenimiento(term) {
    const resultados = await window.VehiAmb.api.buscarRepuestos(term);
    if (mantenimientoTipo.value !== "cambio_aceite" || !repuestosPermitidosVehiculo) return resultados;
    return resultados.filter((repuesto) => repuestosPermitidosVehiculo.has(repuesto.id));
}

window.VehiAmb.crearRepuestoAutocomplete(repuestoInput, {
    onSelect: seleccionarRepuestoDelAutocomplete,
    buscarFn: buscarRepuestosParaMantenimiento,
    onSinResultados: mostrarAvisoRepuestoNoEncontrado
});

function renderDetailAttachment(item) {
    if (!item.soporte_url) {
        return '<p class="dash-empty detail-empty">No hay archivos adjuntos.</p>';
    }

    const fileUrl = window.VehiAmb.api.getAssetUrl(item.soporte_url);
    const fileLabel = escapeHtml(item.soporte_nombre || "Ver adjunto");
    const mime = String(item.soporte_mime || "");
    const isImage = mime.startsWith("image/");

    return `
        <div class="detail-attachment">
            ${isImage ? `<img src="${fileUrl}" alt="${fileLabel}">` : ""}
            <a class="record-link" href="${fileUrl}" target="_blank" rel="noreferrer">${fileLabel}</a>
            <span class="pill">${escapeHtml(mime || "Archivo adjunto")}</span>
        </div>
    `;
}

function detailRow(label, value) {
    return `
        <div>
            <dt>${escapeHtml(label)}</dt>
            <dd>${escapeHtml(value || "--")}</dd>
        </div>
    `;
}

function renderDetailRepuestos(value) {
    const repuestos = parseRepuestos(value);

    if (!repuestos.length) {
        return '<p class="dash-empty detail-empty">No hay repuestos registrados.</p>';
    }

    return `
        <div class="detail-parts-list">
            ${repuestos.map((repuesto) => `
                <article class="detail-part-item">
                    <strong>${escapeHtml(repuesto.repuesto)}</strong>
                    <span>Proveedor: ${escapeHtml(repuesto.proveedor || "Sin proveedor")}</span>
                    <span>${escapeHtml(repuesto.valor ? formatCurrency(repuesto.valor) : "Sin valor")}</span>
                    <p>${escapeHtml(repuesto.notas || "Sin notas")}</p>
                </article>
            `).join("")}
        </div>
    `;
}

function renderRepuestosCatalogo(items) {
    return `
        <div class="detail-parts-list">
            ${items.map((item) => `
                <article class="detail-part-item">
                    <strong>${escapeHtml(item.nombre)} (${escapeHtml(item.codigo_interno)})</strong>
                    <span>Cantidad: ${item.cantidad} ${escapeHtml(item.unidad_medida)}</span>
                    <span>${formatCurrency(item.valor_unitario)} c/u · Total: ${formatCurrency(item.valor_total)}</span>
                    ${item.repuesto_sugerido_id ? `<p>Sustituyo a ${escapeHtml(item.sugerido_nombre || "")} — ${escapeHtml(item.motivo_sustitucion || "")}</p>` : ""}
                </article>
            `).join("")}
        </div>
    `;
}

async function openMaintenanceDetail(item) {
    currentDetailItem = item;
    const vehicleName = `${item.marca || ""} ${item.modelo || ""}`.trim() || "Vehículo";

    maintenanceDrawerTitle.textContent = tiposMantenimiento[item.tipo] || item.tipo || "Mantenimiento";
    maintenanceDrawerSubtitle.textContent = `${item.placa || "Sin placa"} - ${vehicleName}`;
    const esCambioAceite = item.tipo === "cambio_aceite";
    viewEtiquetaButton.classList.toggle("hidden", !esCambioAceite);
    subirSalidaInventarioButton.classList.toggle("hidden", !esCambioAceite);
    subirSalidaInventarioButton.textContent = item.salida_inventario_url
        ? "Reemplazar salida de inventario"
        : "Subir salida de inventario";
    deleteMaintenanceButton.classList.toggle("hidden", !window.VehiAmb.auth?.hasPermission?.("maintenance.delete"));
    const puedeAprobar = item.estado === "pendiente" && Boolean(window.VehiAmb.auth?.hasPermission?.("maintenance.approve"));
    approveMaintenanceButton.classList.toggle("hidden", !puedeAprobar);

    maintenanceDrawerBody.innerHTML = `
        <dl class="detail-list drawer-detail-list mnt-detail-2col">
            ${detailRow("Vehículo", vehicleName)}
            ${detailRow("Placa", item.placa || "Sin placa")}
            ${detailRow("Estado", estadosMantenimiento[item.estado] || item.estado || "Completado")}
            ${detailRow("Fecha", formatDate(item.fecha))}
            ${detailRow("Tipo", tiposMantenimiento[item.tipo] || item.tipo)}
            ${detailRow("Valor", formatCurrency(item.valor))}
            ${detailRow("Kilometraje", `${Number(item.kilometraje || 0).toLocaleString("es-CO")} km`)}
            ${detailRow("Fecha de creación", formatDateTime(item.created_at))}
        </dl>

        ${item.descripcion ? `
            <section class="drawer-section">
                <h3>Descripción</h3>
                <p>${escapeHtml(item.descripcion)}</p>
            </section>
        ` : ""}

        <section class="drawer-section">
            <h3>Repuestos utilizados</h3>
            <div id="repuestosUtilizadosSection">${renderDetailRepuestos(item.repuestos)}</div>
        </section>

        <section class="drawer-section">
            <h3>Archivos adjuntos</h3>
            ${renderDetailAttachment(item)}
        </section>

        ${esCambioAceite ? `
            <section class="drawer-section">
                <h3>Salida de inventario</h3>
                ${item.salida_inventario_url ? `
                    <a class="record-link" href="${escapeHtml(window.VehiAmb.api.getAssetUrl(item.salida_inventario_url))}" target="_blank" rel="noreferrer">
                        ${escapeHtml(item.salida_inventario_nombre) || "Ver documento"}
                    </a>
                ` : `<p class="dash-empty detail-empty">Aún no se ha subido el documento de salida de inventario. Súbelo y luego imprime la etiqueta para aprobar este cambio de aceite.</p>`}
            </section>
        ` : ""}
    `;

    window.VehiAmb.ui.show(maintenanceDrawerBackdrop);
    window.VehiAmb.ui.show(maintenanceDrawer);
    maintenanceDrawer.setAttribute("aria-hidden", "false");
    closeMaintenanceDrawer.focus();

    try {
        const repuestosCatalogo = await window.VehiAmb.api.getMantenimientoRepuestos(item.id);
        if (!repuestosCatalogo.length) return; // Sin datos de catalogo: se deja el detalle legado ya mostrado.

        const contenedor = document.getElementById("repuestosUtilizadosSection");
        if (contenedor) contenedor.innerHTML = renderRepuestosCatalogo(repuestosCatalogo);
    } catch (error) {
        // Mantenimientos viejos (o sin repuestos de catalogo) se quedan con el detalle legado ya mostrado.
    }
}

viewEtiquetaButton.addEventListener("click", () => {
    if (!currentDetailItem) return;
    window.open(`etiqueta-cambio-aceite.html?mantenimiento_id=${currentDetailItem.id}`, "_blank", "noreferrer");
});

subirSalidaInventarioButton.addEventListener("click", () => {
    if (!currentDetailItem) return;
    salidaInventarioInput.value = "";
    salidaInventarioInput.click();
});

// La aprobacion de un cambio de aceite depende de este documento (ver
// confirmarCambioAceite en el backend) -- se sube desde el detalle y se
// vuelve a abrir el drawer ya actualizado para que se vea de una vez.
salidaInventarioInput.addEventListener("change", async (event) => {
    const file = event.target.files[0];
    const mantenimientoId = currentDetailItem?.id;
    if (!file || !mantenimientoId) return;

    const formData = new FormData();
    formData.append("salida_inventario", file);

    try {
        window.VehiAmb.ui.show(loader);
        await window.VehiAmb.api.subirSalidaInventarioMantenimiento(mantenimientoId, formData);
        window.VehiAmb.ui.showMessage(mensaje, "Documento de salida de inventario subido correctamente");
        await cargarDatos();
        const actualizado = mantenimientosState.find((registro) => String(registro.id) === String(mantenimientoId));
        if (actualizado) openMaintenanceDetail(actualizado);
    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudo subir el documento", "error");
    } finally {
        window.VehiAmb.ui.hide(loader);
    }
});

function closeDetailDrawer() {
    window.VehiAmb.ui.hide(maintenanceDrawerBackdrop);
    window.VehiAmb.ui.hide(maintenanceDrawer);
    maintenanceDrawer.setAttribute("aria-hidden", "true");
}

// El backend ya trae los mantenimientos ordenados por fecha DESC, asi que
// agrupar por mes es solo detectar cuando cambia el "YYYY-MM" a medida que
// se recorre la lista -- no hace falta reordenar nada.
function agruparPorMes(mantenimientos) {
    const grupos = [];
    let actual = null;

    for (const item of mantenimientos) {
        const fechaStr = String(item.fecha || "").slice(0, 10);
        const clave = fechaStr.slice(0, 7);

        if (!actual || actual.clave !== clave) {
            const fecha = new Date(`${fechaStr}T00:00:00`);
            const label = fechaStr && !Number.isNaN(fecha.getTime())
                ? `${MESES[fecha.getMonth()].charAt(0).toUpperCase()}${MESES[fecha.getMonth()].slice(1)} ${fecha.getFullYear()}`
                : "Sin fecha";
            actual = { clave, label, items: [] };
            grupos.push(actual);
        }
        actual.items.push(item);
    }

    return grupos;
}

function renderMantenimientos(mantenimientos) {
    if (!mantenimientos.length) {
        mantenimientosList.innerHTML = '<p class="dash-empty">No hay mantenimientos para los filtros seleccionados</p>';
        return;
    }

    const grupos = agruparPorMes(mantenimientos);

    mantenimientosList.innerHTML = grupos.map((grupo) => {
        const totalGrupo = grupo.items.reduce((sum, item) => sum + Number(item.valor || 0), 0);

        return `
            <div class="mnt-hist-month">
                <span class="mnt-hist-month-label">${escapeHtml(grupo.label)}</span>
                <span class="mnt-hist-month-summary">${grupo.items.length} ${grupo.items.length === 1 ? "registro" : "registros"} · ${formatCurrency(totalGrupo)}</span>
            </div>
            ${grupo.items.map((item) => {
                const estado = estadoInfo(item);
                const fechaStr = String(item.fecha || "").slice(0, 10);
                const fecha = new Date(`${fechaStr}T00:00:00`);
                const fechaValida = fechaStr && !Number.isNaN(fecha.getTime());
                const vehicleName = `${item.marca || ""} ${item.modelo || ""}`.trim();
                const km = Number(item.kilometraje || 0);
                const puedeAprobarFila = item.estado === "pendiente" && Boolean(window.VehiAmb.auth?.hasPermission?.("maintenance.approve"));

                return `
                    <article class="mnt-hist-row" data-maintenance-id="${item.id}" tabindex="0" role="button" aria-label="Ver detalle de mantenimiento ${escapeHtml(item.placa) || ""}">
                        <div class="mnt-hist-date">
                            <span class="mnt-hist-date-day">${fechaValida ? fecha.getDate() : "--"}</span>
                            <span class="mnt-hist-date-month">${fechaValida ? MESES[fecha.getMonth()].slice(0, 3).toUpperCase() : ""}</span>
                        </div>
                        <div class="mnt-hist-main">
                            <div class="mnt-hist-title-row">
                                <span class="mnt-hist-title">${escapeHtml(tiposMantenimiento[item.tipo] || item.tipo)}</span>
                                ${estado.badge
                                    ? `<span class="pill ${estado.clase}">${estado.texto}</span>`
                                    : `<span class="mnt-hist-status-ok">✓ ${estado.texto}</span>`}
                                ${item.vehiculo_varado && item.estado === "pendiente" ? '<span class="pill pill-danger">⚠ En taller</span>' : ""}
                                ${puedeAprobarFila ? `<button type="button" class="btn-primary mnt-hist-approve" data-approve-id="${item.id}">Aprobar</button>` : ""}
                            </div>
                            <div class="mnt-hist-sub">${escapeHtml(item.placa) || "Sin placa"}${vehicleName ? ` · ${escapeHtml(vehicleName)}` : ""}${km > 0 ? ` · ${km.toLocaleString("es-CO")} km` : ""}</div>
                        </div>
                        <div class="mnt-hist-end">
                            ${item.valor
                                ? `<span class="mnt-hist-amount">${formatCurrency(item.valor)}</span>`
                                : `<span class="mnt-hist-amount mnt-hist-amount--muted">Sin costo</span>`}
                            <div class="mnt-hist-end-row">
                                ${item.tipo === "cambio_aceite" ? `
                                    <button type="button" class="mnt-hist-print" data-etiqueta-id="${item.id}" title="Ver etiqueta" aria-label="Ver etiqueta de cambio de aceite">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                                    </button>
                                ` : ""}
                                <span class="mnt-hist-action${estado.esExcepcion ? " mnt-hist-action--revisar" : ""}">${estado.accion}</span>
                            </div>
                        </div>
                    </article>
                `;
            }).join("")}
        `;
    }).join("");
}

function currentMaintenanceFilters() {
    return {
        tipo: filterTipo.value,
        fecha_desde: filterFechaDesde.value,
        fecha_hasta: filterFechaHasta.value
    };
}

// La busqueda por placa/tipo es del lado del cliente (sobre lo que ya trajo
// el servidor filtrado por tipo/fechas) -- evita depender de un match exacto
// de placa en el backend y deja escribir cualquiera de los dos.
function coincideBusqueda(item) {
    const termino = filterBusqueda.value.trim().toLowerCase();
    if (!termino) return true;

    const enPlaca = String(item.placa || "").toLowerCase().includes(termino);
    const enTipo = String(tiposMantenimiento[item.tipo] || item.tipo || "").toLowerCase().includes(termino);
    return enPlaca || enTipo;
}

function updateFilterSummary(filteredCount) {
    const total = totalMantenimientosCount;
    const filters = currentMaintenanceFilters();
    const hasFilters = Boolean(filterBusqueda.value.trim() || filters.tipo || filters.fecha_desde || filters.fecha_hasta);

    if (!total) {
        filterSummary.textContent = "Aún no hay mantenimientos registrados.";
    } else {
        filterSummary.textContent = hasFilters
            ? `Mostrando ${filteredCount} de ${total} mantenimientos.`
            : `Mostrando todos los mantenimientos (${total}).`;
    }

    renderFiltersChips();
}

// Los popovers de Tipo/Fechas son solo una capa de presentacion sobre los
// <select>/<input> nativos que ya existen (ocultos) -- se les cambia el
// .value y se dispara "change", y toda la logica de filtrado/exportacion
// que ya lee esos elementos sigue funcionando igual, sin tocarla.
function updateTipoTriggerLabel() {
    filterTipoTriggerLabel.textContent = filterTipo.value ? (tiposMantenimiento[filterTipo.value] || filterTipo.value) : "Tipo";
    filterTipoTrigger.classList.toggle("is-active", Boolean(filterTipo.value));
    filterTipoPopover.querySelectorAll("[data-tipo-value]").forEach((boton) => {
        boton.classList.toggle("is-active", boton.dataset.tipoValue === filterTipo.value);
    });
}

function updateFechasTriggerLabel() {
    const hayFecha = filterFechaDesde.value || filterFechaHasta.value;
    filterFechasTrigger.classList.toggle("is-active", Boolean(hayFecha));
}

function renderFiltersChips() {
    const chips = [];

    if (filterTipo.value) {
        chips.push({ id: "tipo", label: tiposMantenimiento[filterTipo.value] || filterTipo.value });
    }
    if (filterFechaDesde.value || filterFechaHasta.value) {
        const desde = filterFechaDesde.value ? formatDate(filterFechaDesde.value) : "…";
        const hasta = filterFechaHasta.value ? formatDate(filterFechaHasta.value) : "…";
        chips.push({ id: "fechas", label: `${desde} → ${hasta}` });
    }

    filtersChips.classList.toggle("hidden", chips.length === 0);
    filtersChips.innerHTML = chips.map((chip) => `
        <span class="pill">${escapeHtml(chip.label)} <button type="button" class="pill-remove" data-remove-chip="${chip.id}" aria-label="Quitar filtro">×</button></span>
    `).join("");
}

function cerrarPopoversFiltroHistorial() {
    filterTipoPopover.classList.add("hidden");
    filterFechasPopover.classList.add("hidden");
    exportMenuPopover.classList.add("hidden");
}

filterTipoTrigger.addEventListener("click", (event) => {
    event.stopPropagation();
    const estabaAbierto = !filterTipoPopover.classList.contains("hidden");
    cerrarPopoversFiltroHistorial();
    filterTipoPopover.classList.toggle("hidden", estabaAbierto);
});

filterFechasTrigger.addEventListener("click", (event) => {
    event.stopPropagation();
    const estabaAbierto = !filterFechasPopover.classList.contains("hidden");
    cerrarPopoversFiltroHistorial();
    filterFechasPopover.classList.toggle("hidden", estabaAbierto);
});

exportMenuTrigger.addEventListener("click", (event) => {
    event.stopPropagation();
    const estabaAbierto = !exportMenuPopover.classList.contains("hidden");
    cerrarPopoversFiltroHistorial();
    exportMenuPopover.classList.toggle("hidden", estabaAbierto);
});

document.addEventListener("click", (event) => {
    if (!event.target.closest(".doc-filter-popover-wrap, .mnt-export-wrap")) cerrarPopoversFiltroHistorial();
});

filterTipoPopover.addEventListener("click", (event) => {
    const opcion = event.target.closest("[data-tipo-value]");
    if (!opcion) return;

    filterTipo.value = opcion.dataset.tipoValue;
    filterTipo.dispatchEvent(new Event("change"));
    updateTipoTriggerLabel();
    cerrarPopoversFiltroHistorial();
});

[filterFechaDesde, filterFechaHasta].forEach((input) => {
    input.addEventListener("input", updateFechasTriggerLabel);
});

filterBusqueda.addEventListener("input", () => {
    mantenimientosFiltradosState = mantenimientosState.filter(coincideBusqueda);
    renderMantenimientos(mantenimientosFiltradosState);
    updateFilterSummary(mantenimientosFiltradosState.length);
});

filtersChips.addEventListener("click", (event) => {
    const boton = event.target.closest("[data-remove-chip]");
    if (!boton) return;

    if (boton.dataset.removeChip === "tipo") {
        filterTipo.value = "";
        filterTipo.dispatchEvent(new Event("change"));
        updateTipoTriggerLabel();
    } else if (boton.dataset.removeChip === "fechas") {
        filterFechaDesde.value = "";
        filterFechaHasta.value = "";
        updateFechasTriggerLabel();
        applyMaintenanceFilters();
    }
});

async function applyMaintenanceFilters() {
    const requestToken = ++filtersRequestToken;

    try {
        window.VehiAmb.ui.show(loader);
        const mantenimientos = await window.VehiAmb.api.getMantenimientos(currentMaintenanceFilters());
        if (requestToken !== filtersRequestToken) return;

        mantenimientosState = mantenimientos;
        mantenimientosFiltradosState = mantenimientos.filter(coincideBusqueda);
        renderMantenimientos(mantenimientosFiltradosState);
        updateFilterSummary(mantenimientosFiltradosState.length);
    } catch (error) {
        if (requestToken !== filtersRequestToken) return;

        console.error(error);
        mantenimientosList.innerHTML = '<p class="dash-empty">No fue posible cargar el historial de mantenimientos</p>';
        updateFilterSummary(0);
    } finally {
        if (requestToken === filtersRequestToken) window.VehiAmb.ui.hide(loader);
    }
}

async function cargarDatos() {
    try {
        window.VehiAmb.ui.show(loader);

        const vehiculos = await window.VehiAmb.api.getVehiculosCatalogo();
        vehiculosState = vehiculos;
        fillVehicleSelect(mantenimientoSelect, vehiculos);

        const vehiculoPreseleccionado = new URLSearchParams(window.location.search).get("vehiculo");
        if (vehiculoPreseleccionado && Array.from(mantenimientoSelect.options).some((option) => option.value === vehiculoPreseleccionado)) {
            mantenimientoSelect.value = vehiculoPreseleccionado;
        }

        updateKilometrajeValidation();
    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(mensaje, "No fue posible cargar los vehículos", "error");
        window.VehiAmb.ui.hide(loader);
        return;
    }

    try {
        const todosLosMantenimientos = await window.VehiAmb.api.getMantenimientos();
        totalMantenimientosCount = todosLosMantenimientos.length;
        renderKpisMantenimientos(todosLosMantenimientos);
        await applyMaintenanceFilters();
    } catch (error) {
        console.error(error);
        mantenimientosList.innerHTML = '<p class="dash-empty">No fue posible cargar el historial de mantenimientos</p>';
        updateFilterSummary(0);
        window.VehiAmb.ui.showMessage(mensaje, "Los vehículos cargaron, pero no fue posible cargar el historial", "error");
    } finally {
        window.VehiAmb.ui.hide(loader);
    }
}

mantenimientoForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    // El boton de guardar vive dentro del paso 3, pero el navegador igual
    // intenta enviar el formulario con Enter desde un campo de un paso
    // anterior -- sin esto se saltaria la seleccion de tipo (paso 2).
    if (wizardStep3.classList.contains("hidden")) return;

    if (!validateKilometrajeBeforeSubmit()) return;

    if (mantenimientoTipo.value === "cambio_aceite" && !proximoCambioKmInput.value) {
        window.VehiAmb.ui.showMessage(mensaje, "Este vehículo no tiene un intervalo de cambio configurado. Configúralo desde su ficha antes de registrar el cambio de aceite.", "error");
        return;
    }

    const formData = new FormData(mantenimientoForm);
    formData.set("kilometraje", window.VehiAmb.ui.parseFormattedNumber(mantenimientoKilometraje.value));
    formData.set("valor_mano_obra", window.VehiAmb.ui.parseFormattedMoneda(valorManoObraInput.value));
    if (proximoCambioKmInput.value) {
        formData.set("proximo_cambio_km", window.VehiAmb.ui.parseFormattedNumber(proximoCambioKmInput.value));
    }

    try {
        window.VehiAmb.ui.show(loader);
        const creado = await window.VehiAmb.api.createMantenimiento(formData);

        if (creado.advertenciasStock?.length) {
            window.VehiAmb.ui.showMessage(mensaje, `Mantenimiento guardado. Aviso: ${creado.advertenciasStock.join(" · ")}`, "error");
        } else {
            window.VehiAmb.ui.showMessage(mensaje, "Mantenimiento guardado correctamente");
        }

        mantenimientoForm.reset();
        mantenimientoFecha.value = hoyISO();
        tipoCardGrid.querySelectorAll(".type-card.is-selected").forEach((card) => card.classList.remove("is-selected"));
        goToWizardStep(1);
        repuestosState = [];
        limpiarSeleccionRepuesto();
        renderRepuestosBuilder();
        updateKilometrajeValidation();
        updateCostoTotal();
        updateCambioAceiteFields();
        await cargarDatos();
        switchTab("historial");
    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(mensaje, error.message || "Error al guardar el mantenimiento", "error");
    } finally {
        window.VehiAmb.ui.hide(loader);
    }
});

mantenimientoSelect.addEventListener("change", () => {
    updateKilometrajeValidation();
    cargarRepuestosSugeridos();
});

mantenimientoKilometraje.addEventListener("input", () => {
    window.VehiAmb.ui.formatearNumeroEnVivo(mantenimientoKilometraje);
    updateKilometrajeValidation();
    actualizarProximoCambioKm(selectedVehicle());
});
valorManoObraInput.addEventListener("input", () => {
    window.VehiAmb.ui.formatearMonedaEnVivo(valorManoObraInput);
    updateCostoTotal();
});
mantenimientoTipo.addEventListener("change", updateCambioAceiteFields);
mantenimientoFecha.addEventListener("input", autocompletarProximaFecha);
proximoCambioFechaInput.addEventListener("input", () => {
    proximaFechaEditadaManualmente = true;
});

mantenimientosFilterForm.addEventListener("submit", (event) => {
    event.preventDefault();
});

[filterTipo, filterFechaDesde, filterFechaHasta].forEach((input) => {
    input.addEventListener("input", applyMaintenanceFilters);
    input.addEventListener("change", applyMaintenanceFilters);
});

function switchTab(tab) {
    const esRegistrar = tab === "registrar";

    tabRegistrarButton.classList.toggle("active", esRegistrar);
    tabHistorialButton.classList.toggle("active", !esRegistrar);
    tabRegistrarButton.setAttribute("aria-selected", String(esRegistrar));
    tabHistorialButton.setAttribute("aria-selected", String(!esRegistrar));

    window.VehiAmb.ui[esRegistrar ? "show" : "hide"](registrarMantenimientoSection);
    window.VehiAmb.ui[esRegistrar ? "hide" : "show"](historialMantenimientosSection);
}

tabHistorialButton.addEventListener("click", () => switchTab("historial"));
tabRegistrarButton.addEventListener("click", () => switchTab("registrar"));

clearFiltersButton.addEventListener("click", () => {
    mantenimientosFilterForm.reset();
    updateTipoTriggerLabel();
    updateFechasTriggerLabel();
    applyMaintenanceFilters();
});

mantenimientosList.addEventListener("click", (event) => {
    if (event.target.closest("a")) return;

    const etiquetaButton = event.target.closest("[data-etiqueta-id]");
    if (etiquetaButton) {
        event.stopPropagation();
        window.open(`etiqueta-cambio-aceite.html?mantenimiento_id=${etiquetaButton.dataset.etiquetaId}`, "_blank", "noreferrer");
        return;
    }

    const approveButton = event.target.closest("[data-approve-id]");
    if (approveButton) {
        event.stopPropagation();
        const item = mantenimientosState.find((maintenance) => String(maintenance.id) === String(approveButton.dataset.approveId));
        if (item) aprobarMantenimientoConConfirmacion(item, approveButton);
        return;
    }

    const card = event.target.closest("[data-maintenance-id]");
    if (!card) return;

    const item = mantenimientosState.find((maintenance) => String(maintenance.id) === String(card.dataset.maintenanceId));
    if (item) openMaintenanceDetail(item);
});

mantenimientosList.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;

    const card = event.target.closest("[data-maintenance-id]");
    if (!card) return;

    event.preventDefault();
    const item = mantenimientosState.find((maintenance) => String(maintenance.id) === String(card.dataset.maintenanceId));
    if (item) openMaintenanceDetail(item);
});

closeMaintenanceDrawer.addEventListener("click", closeDetailDrawer);
maintenanceDrawerBackdrop.addEventListener("click", closeDetailDrawer);

exportMaintenanceButton.addEventListener("click", async () => {
    if (!currentDetailItem) return;

    const originalLabel = exportMaintenanceButton.textContent;
    exportMaintenanceButton.disabled = true;
    exportMaintenanceButton.textContent = "Generando...";

    try {
        await window.VehiAmb.mantenimientos.exportPdf(currentDetailItem);
    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudo exportar el PDF", "error");
    } finally {
        exportMaintenanceButton.disabled = false;
        exportMaintenanceButton.textContent = originalLabel;
    }
});

exportMaintenanceExcelButton.addEventListener("click", async () => {
    if (!currentDetailItem) return;

    const originalLabel = exportMaintenanceExcelButton.textContent;
    exportMaintenanceExcelButton.disabled = true;
    exportMaintenanceExcelButton.textContent = "Generando...";

    try {
        await window.VehiAmb.mantenimientos.exportExcel(currentDetailItem);
    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudo exportar el Excel", "error");
    } finally {
        exportMaintenanceExcelButton.disabled = false;
        exportMaintenanceExcelButton.textContent = originalLabel;
    }
});

deleteMaintenanceButton.addEventListener("click", async () => {
    if (!currentDetailItem) return;

    const confirmado = await window.VehiAmb.ui.confirm({
        title: "Eliminar mantenimiento",
        message: "Si consumió repuestos, el stock se devuelve. Esta acción no se puede deshacer.",
        confirmText: "Eliminar"
    });
    if (!confirmado) return;

    deleteMaintenanceButton.disabled = true;

    try {
        await window.VehiAmb.api.deleteMantenimiento(currentDetailItem.id);
        window.VehiAmb.ui.showMessage(mensaje, "Mantenimiento eliminado correctamente");
        closeDetailDrawer();
        await cargarDatos();
    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudo eliminar el mantenimiento", "error");
    } finally {
        deleteMaintenanceButton.disabled = false;
    }
});

// Compartida entre el boton "Aprobar" inline de cada fila del listado y el
// del detalle -- ambos deben mostrar la misma confirmacion y refrescar el
// listado de la misma forma una vez el backend aprueba el mantenimiento (ver
// POST /mantenimientos/:id/aprobar).
async function aprobarMantenimientoConConfirmacion(item, botonDisparador) {
    const confirmado = await window.VehiAmb.ui.confirm({
        title: "Aprobar mantenimiento",
        message: `¿Desea aprobar/confirmar el mantenimiento al vehículo ${item.placa || ""}?`,
        confirmText: "Confirmar",
        cancelText: "Cancelar"
    });
    if (!confirmado) return;

    if (botonDisparador) botonDisparador.disabled = true;

    try {
        await window.VehiAmb.api.aprobarMantenimiento(item.id);
        window.VehiAmb.ui.showMessage(mensaje, "Mantenimiento aprobado correctamente");
        if (currentDetailItem && String(currentDetailItem.id) === String(item.id)) closeDetailDrawer();
        await cargarDatos();
    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudo aprobar el mantenimiento", "error");
    } finally {
        if (botonDisparador) botonDisparador.disabled = false;
    }
}

approveMaintenanceButton.addEventListener("click", () => {
    if (!currentDetailItem) return;
    aprobarMantenimientoConConfirmacion(currentDetailItem, approveMaintenanceButton);
});

exportHistorialButton.addEventListener("click", async () => {
    cerrarPopoversFiltroHistorial();
    const originalLabel = exportHistorialButton.textContent;
    exportHistorialButton.disabled = true;
    exportHistorialButton.textContent = "Generando...";

    try {
        await window.VehiAmb.mantenimientos.exportHistorialPdf(mantenimientosFiltradosState, currentMaintenanceFilters());
    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudo exportar el historial", "error");
    } finally {
        exportHistorialButton.disabled = false;
        exportHistorialButton.textContent = originalLabel;
    }
});

exportHistorialExcelButton.addEventListener("click", async () => {
    cerrarPopoversFiltroHistorial();
    const originalLabel = exportHistorialExcelButton.textContent;
    exportHistorialExcelButton.disabled = true;
    exportHistorialExcelButton.textContent = "Generando...";

    try {
        await window.VehiAmb.mantenimientos.exportHistorialExcel(mantenimientosFiltradosState, currentMaintenanceFilters());
    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudo exportar el historial en Excel", "error");
    } finally {
        exportHistorialExcelButton.disabled = false;
        exportHistorialExcelButton.textContent = originalLabel;
    }
});

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !maintenanceDrawer.classList.contains("hidden")) {
        closeDetailDrawer();
    }
});

document.addEventListener("DOMContentLoaded", async () => {
    await window.VehiAmb.auth.fetchCurrentUser();

    const puedeRegistrar = window.VehiAmb.auth.hasPermission("maintenance.create");

    if (!puedeRegistrar) {
        // Ocultar solo la seccion no alcanza: el boton de la pestaña sigue
        // ahi y switchTab() la vuelve a mostrar al hacer clic (no valida
        // permisos, solo alterna visibilidad). Hay que quitar tambien el
        // boton para que un rol de solo consulta (ej. Consulta) no pueda
        // llegar al formulario de registrar.
        tabRegistrarButton.remove();
        registrarMantenimientoSection.remove();
    }

    // Registrar mantenimiento es la pestaña que se abre de entrada -- el
    // historial queda a un clic, pero no es lo primero que se ve. Si el rol
    // no puede registrar, no tiene sentido abrir esa pestaña (ya no existe).
    switchTab(puedeRegistrar ? "registrar" : "historial");

    mantenimientoFecha.value = hoyISO();
    goToWizardStep(1);
    renderRepuestosBuilder();
    updateCostoTotal();
    updateCambioAceiteFields();
    await cargarDatos();

    // Llegada desde una notificacion ("Ver mantenimiento") -- abre de una
    // vez el detalle del mantenimiento puntual en vez de dejar al usuario a
    // buscarlo a mano en el historial.
    const mantenimientoIdParam = new URLSearchParams(window.location.search).get("mantenimiento_id");
    if (mantenimientoIdParam) {
        const item = mantenimientosState.find((m) => String(m.id) === mantenimientoIdParam);
        if (item) {
            switchTab("historial");
            openMaintenanceDetail(item);
        }
    }
});
