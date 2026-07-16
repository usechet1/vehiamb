const mantenimientoForm = document.getElementById("mantenimientoForm");
const mantenimientosFilterForm = document.getElementById("mantenimientosFilterForm");
const mantenimientoSelect = document.getElementById("vehiculoMantenimiento");
const mantenimientosList = document.getElementById("mantenimientosList");
const mantenimientosKpisGrid = document.getElementById("mantenimientosKpisGrid");
const filterPlaca = document.getElementById("filterPlaca");
const filterTipo = document.getElementById("filterTipo");
const filterFechaDesde = document.getElementById("filterFechaDesde");
const filterFechaHasta = document.getElementById("filterFechaHasta");
const filterSummary = document.getElementById("filterSummary");
const clearFiltersButton = document.getElementById("clearFiltersButton");
const loader = document.getElementById("loader");
const mensaje = document.getElementById("mensaje");
const mantenimientoKilometraje = document.getElementById("mantenimientoKilometraje");
const kilometrajeHelp = document.getElementById("kilometrajeHelp");
const repuestosData = document.getElementById("repuestosData");
const repuestosEstructuradosData = document.getElementById("repuestosEstructuradosData");
const repuestoInput = document.getElementById("repuestoInput");
const repuestoProveedorInput = document.getElementById("repuestoProveedorInput");
const repuestoCantidadInput = document.getElementById("repuestoCantidadInput");
const repuestoNotasInput = document.getElementById("repuestoNotasInput");
const addRepuestoButton = document.getElementById("addRepuestoButton");
const repuestoSeleccionadoInfo = document.getElementById("repuestoSeleccionadoInfo");
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
const valorManoObraInput = document.getElementById("valorManoObraInput");
const costoTotalDisplay = document.getElementById("costoTotalDisplay");
const mantenimientoTipo = document.getElementById("mantenimientoTipo");
const cambioAceiteFields = document.getElementById("cambioAceiteFields");
const proximoCambioKmInput = document.getElementById("proximoCambioKmInput");
const proximoCambioKmHelp = document.getElementById("proximoCambioKmHelp");
const proximoCambioFechaInput = document.getElementById("proximoCambioFechaInput");
const maintenanceDrawer = document.getElementById("maintenanceDrawer");
const maintenanceDrawerBackdrop = document.getElementById("maintenanceDrawerBackdrop");
const closeMaintenanceDrawer = document.getElementById("closeMaintenanceDrawer");
const maintenanceDrawerTitle = document.getElementById("maintenanceDrawerTitle");
const maintenanceDrawerSubtitle = document.getElementById("maintenanceDrawerSubtitle");
const maintenanceDrawerBody = document.getElementById("maintenanceDrawerBody");
const exportMaintenanceButton = document.getElementById("exportMaintenanceButton");
const exportMaintenanceExcelButton = document.getElementById("exportMaintenanceExcelButton");
const exportHistorialButton = document.getElementById("exportHistorialButton");
const exportHistorialExcelButton = document.getElementById("exportHistorialExcelButton");
const tabHistorialButton = document.getElementById("tabHistorialButton");
const tabRegistrarButton = document.getElementById("tabRegistrarButton");
const historialMantenimientosSection = document.getElementById("historialMantenimientosSection");
const registrarMantenimientoSection = document.getElementById("registrarMantenimientoSection");

let repuestosState = [];
let mantenimientosState = [];
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

const badgeClassEstadoMantenimiento = {
    pendiente: "badge-amarillo",
    aprobado: "badge-verde",
    rechazado: "badge-rojo",
    completado: "badge-verde"
};

function renderEstadoBadge(estado) {
    const label = estadosMantenimiento[estado] || estado || "Completado";
    const badgeClass = badgeClassEstadoMantenimiento[estado] || "badge-gris";
    return `<span class="badge ${badgeClass}">${label}</span>`;
}

function calcularKpisMantenimientos(mantenimientos) {
    const mesActual = new Date().toISOString().slice(0, 7);
    const vehiculosVistos = new Set();
    let pendientes = 0;
    let varados = 0;
    let esteMes = 0;
    let gastoEsteMes = 0;

    for (const item of mantenimientos) {
        if (item.estado === "pendiente") pendientes += 1;

        // mantenimientos ya viene ordenado fecha DESC, id DESC: la primera
        // vez que aparece un vehiculo_id es su mantenimiento mas reciente.
        if (!vehiculosVistos.has(item.vehiculo_id)) {
            vehiculosVistos.add(item.vehiculo_id);
            if (item.vehiculo_varado) varados += 1;
        }

        if (String(item.fecha || "").slice(0, 7) === mesActual) {
            esteMes += 1;
            gastoEsteMes += Number(item.valor || 0);
        }
    }

    return { pendientes, varados, esteMes, gastoEsteMes };
}

function renderKpisMantenimientos(mantenimientos) {
    const kpis = calcularKpisMantenimientos(mantenimientos);

    mantenimientosKpisGrid.innerHTML = `
        <div class="kpi-card" style="--kpi-accent: var(--color-warning)">
            <div class="kpi-label">Pendientes de aprobación</div>
            <div class="kpi-value">${kpis.pendientes}</div>
        </div>
        <div class="kpi-card" style="--kpi-accent: var(--color-primary)">
            <div class="kpi-label">Vehículos varados</div>
            <div class="kpi-value">${kpis.varados}</div>
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

function updateCambioAceiteFields() {
    const isCambioAceite = mantenimientoTipo.value === "cambio_aceite";

    cambioAceiteFields.classList.toggle("hidden", !isCambioAceite);
    proximoCambioFechaInput.required = isCambioAceite;

    if (!isCambioAceite) {
        proximoCambioKmInput.value = "";
        proximoCambioKmHelp.textContent = "";
        proximoCambioFechaInput.value = "";
        repuestosSugeridosAviso.classList.add("hidden");
        repuestosPermitidosVehiculo = null;
        actualizarEstadoBusquedaRepuesto();
        return;
    }

    cargarRepuestosSugeridos();
}

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

    // El intervalo de cambio siempre se auto-completa (es un dato propio del
    // vehiculo, ver vehiculos.intervalo_cambio_aceite_km), independiente de
    // si esta empresa usa repuestos sugeridos. El campo es de solo lectura
    // (igual que "Gasto total del mantenimiento"): no se recalcula a mano,
    // se corrige configurando el intervalo en la ficha del vehiculo.
    proximoCambioKmInput.value = "";
    proximoCambioKmHelp.textContent = "";

    if (vehiculo) {
        if (vehiculo.intervalo_cambio_aceite_km) {
            proximoCambioKmInput.value = window.VehiAmb.ui.formatearNumeroParaMostrar(
                Math.round(Number(vehiculo.kilometraje_actual || 0) + Number(vehiculo.intervalo_cambio_aceite_km))
            );
        } else {
            proximoCambioKmHelp.textContent = "Este vehículo no tiene un intervalo de cambio configurado. Configúralo desde su ficha.";
        }
    }

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

        if (disponibilidad.principal.stock_disponible > 0) {
            repuestosState.push({
                repuesto: sugerido.nombre,
                proveedor: "",
                valor: Number(sugerido.valor_promedio || 0) * Number(sugerido.cantidad || 1),
                notas: "",
                repuesto_id: sugerido.repuesto_id,
                cantidad: Number(sugerido.cantidad || 1),
                valor_unitario: Number(sugerido.valor_promedio || 0)
            });
        } else if (disponibilidad.equivalencias.length) {
            const elegida = disponibilidad.equivalencias[0];
            repuestosState.push({
                repuesto: elegida.nombre,
                proveedor: "",
                valor: 0,
                notas: `Sustituye a ${sugerido.nombre} (sin stock)`,
                repuesto_id: elegida.id,
                repuesto_sugerido_id: sugerido.repuesto_id,
                motivo_sustitucion: "Sin stock del repuesto principal",
                cantidad: Number(sugerido.cantidad || 1),
                valor_unitario: 0
            });
        } else {
            sinStock.push(sugerido.nombre);
        }
    }

    renderRepuestosBuilder();

    if (sinStock.length) {
        repuestosSugeridosAviso.textContent = `No existen repuestos compatibles disponibles para: ${sinStock.join(", ")}.`;
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
// el render del historial (renderRepuestosMeta/renderDetailRepuestos) no
// necesita cambiar una linea.
function syncRepuestosField() {
    repuestosData.value = JSON.stringify(
        repuestosState.map((item) => ({ repuesto: item.repuesto, proveedor: item.proveedor, valor: item.valor, notas: item.notas }))
    );

    repuestosEstructuradosData.value = JSON.stringify(
        repuestosState
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
    const totalRepuestos = repuestosState.reduce((sum, item) => sum + Number(item.valor || 0), 0);
    costoTotalDisplay.value = formatCurrency(manoObra + totalRepuestos);
}

function renderRepuestosBuilder() {
    repuestosList.innerHTML = repuestosState.map((item, index) => `
        <li class="simple-checklist-item">
            <div class="simple-checklist-content">
                <span class="simple-checklist-label">${item.repuesto}${item.cantidad ? ` × ${item.cantidad}` : ""}</span>
                <span class="simple-checklist-detail">${item.proveedor || "Sin proveedor"}</span>
                <span class="simple-checklist-detail">${item.valor ? formatCurrency(item.valor) : "Sin valor"}</span>
                <span class="simple-checklist-detail">${item.notas || "Sin notas"}</span>
            </div>
            <button type="button" class="simple-checklist-remove" data-index="${index}">Quitar</button>
        </li>
    `).join("");

    repuestosEmpty.classList.toggle("hidden", repuestosState.length > 0);
    syncRepuestosField();
    updateCostoTotal();

    repuestosList.querySelectorAll(".simple-checklist-remove").forEach((button) => {
        button.addEventListener("click", () => {
            const index = Number(button.dataset.index);
            repuestosState.splice(index, 1);
            renderRepuestosBuilder();
        });
    });
}

function limpiarSeleccionRepuesto() {
    repuestoSeleccionado = null;
    repuestoSeleccionadoInfo.classList.add("hidden");
    repuestoEquivalenciasPicker.classList.add("hidden");
    repuestoEquivalenciasPicker.innerHTML = "";
    addRepuestoButton.disabled = true;
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
            <button type="button" class="btn-secondary repuesto-equivalencia-opcion" data-id="${eq.id}" data-nombre="${eq.nombre}">
                ✔ ${eq.nombre} (${eq.stock_disponible} unidades)
            </button>
        `).join("")}
    `;
    repuestoEquivalenciasPicker.classList.remove("hidden");
}

async function seleccionarRepuestoDelAutocomplete(repuesto) {
    repuestoSeleccionado = repuesto;
    repuestoEquivalenciasPicker.classList.add("hidden");
    repuestoEquivalenciasPicker.innerHTML = "";

    let disponibilidad;
    try {
        disponibilidad = await window.VehiAmb.api.getRepuestoDisponibilidad(repuesto.id);
    } catch (error) {
        disponibilidad = null;
    }

    const stockDisponible = disponibilidad ? disponibilidad.principal.stock_disponible : Number(repuesto.stock_disponible || 0);

    repuestoSeleccionadoInfo.textContent =
        `${repuesto.codigo_interno} · ${repuesto.marca || "Sin marca"} · ${formatCurrency(repuesto.valor_promedio)} · ${repuesto.unidad_medida} · Stock: ${stockDisponible}`;
    repuestoSeleccionadoInfo.classList.remove("hidden");
    addRepuestoButton.disabled = false;

    if (stockDisponible <= 0 && disponibilidad) {
        // Las equivalencias tambien se restringen al set permitido del
        // vehiculo: un repuesto puede ser equivalente de otro en el catalogo
        // general sin estar configurado para este vehiculo puntual.
        const restringir = mantenimientoTipo.value === "cambio_aceite" && repuestosPermitidosVehiculo;
        const equivalenciasPermitidas = restringir
            ? disponibilidad.equivalencias.filter((eq) => repuestosPermitidosVehiculo.has(eq.id))
            : disponibilidad.equivalencias;
        mostrarEquivalencias(repuesto.nombre, equivalenciasPermitidas);
    }
}

function agregarRepuestoAlBuilder(repuesto, cantidad, { repuestoSugeridoId, motivoSustitucion } = {}) {
    repuestosState.push({
        repuesto: repuesto.nombre,
        proveedor: repuestoProveedorInput.value.trim(),
        valor: Number(repuesto.valor_promedio || 0) * cantidad,
        notas: repuestoNotasInput.value.trim(),
        repuesto_id: repuesto.id,
        repuesto_sugerido_id: repuestoSugeridoId || null,
        motivo_sustitucion: motivoSustitucion || null,
        cantidad,
        valor_unitario: Number(repuesto.valor_promedio || 0)
    });

    repuestoInput.value = "";
    repuestoProveedorInput.value = "";
    repuestoCantidadInput.value = "";
    repuestoNotasInput.value = "";
    limpiarSeleccionRepuesto();
    renderRepuestosBuilder();
    repuestoInput.focus();
}

function addRepuesto() {
    if (!repuestoSeleccionado) return;

    const cantidad = Number(repuestoCantidadInput.value) > 0 ? Number(repuestoCantidadInput.value) : 1;
    agregarRepuestoAlBuilder(repuestoSeleccionado, cantidad);
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
        const cantidad = Number(repuestoCantidadInput.value) > 0 ? Number(repuestoCantidadInput.value) : 1;
        agregarRepuestoAlBuilder(nuevoRepuesto, cantidad);

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

    const cantidad = Number(repuestoCantidadInput.value) > 0 ? Number(repuestoCantidadInput.value) : 1;
    agregarRepuestoAlBuilder(
        { id: Number(button.dataset.id), nombre: button.dataset.nombre, valor_promedio: 0 },
        cantidad,
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

function renderRepuestosMeta(value) {
    const repuestos = parseRepuestos(value);

    if (!repuestos.length) {
        return '<span class="pill">Repuestos: No registrados</span>';
    }

    return repuestos.map((repuesto) => `
        <span class="pill">
            ${escapeHtml(repuesto.repuesto)}
            ${repuesto.proveedor ? ` - ${escapeHtml(repuesto.proveedor)}` : ""}
            ${repuesto.valor ? ` - ${formatCurrency(repuesto.valor)}` : ""}
            ${repuesto.notas ? ` - ${escapeHtml(repuesto.notas)}` : ""}
        </span>
    `).join("");
}

function renderAttachment(item) {
    if (!item.soporte_url) return "";

    const fileUrl = escapeHtml(window.VehiAmb.api.getAssetUrl(item.soporte_url));
    const fileLabel = escapeHtml(item.soporte_nombre || "Ver adjunto");

    return `
        <a class="record-link" href="${fileUrl}" target="_blank" rel="noreferrer">
            ${fileLabel}
        </a>
    `;
}

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
    if (!items.length) return "";

    return `
        <section class="drawer-section">
            <h3>Repuestos del catalogo</h3>
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
        </section>
    `;
}

async function openMaintenanceDetail(item) {
    currentDetailItem = item;
    const vehicleName = `${item.marca || ""} ${item.modelo || ""}`.trim() || "Vehículo";

    maintenanceDrawerTitle.textContent = tiposMantenimiento[item.tipo] || item.tipo || "Mantenimiento";
    maintenanceDrawerSubtitle.textContent = `${item.placa || "Sin placa"} - ${vehicleName}`;
    viewEtiquetaButton.classList.toggle("hidden", item.tipo !== "cambio_aceite");

    maintenanceDrawerBody.innerHTML = `
        <dl class="detail-list drawer-detail-list">
            ${detailRow("Vehículo", vehicleName)}
            ${detailRow("Placa", item.placa || "Sin placa")}
            ${detailRow("Estado", estadosMantenimiento[item.estado] || item.estado || "Completado")}
            ${detailRow("Fecha", formatDate(item.fecha))}
            ${detailRow("Tipo", tiposMantenimiento[item.tipo] || item.tipo)}
            ${detailRow("Valor", formatCurrency(item.valor))}
            ${detailRow("Kilometraje", `${Number(item.kilometraje || 0).toLocaleString("es-CO")} km`)}
            ${detailRow("Autorizado por", item.autorizado_por || "No registrado")}
            ${detailRow("Realizado por", item.hecho_por || "No registrado")}
            ${detailRow("Fecha de creación", formatDateTime(item.created_at))}
        </dl>

        <section class="drawer-section">
            <h3>Descripción / trabajo realizado</h3>
            <p>${escapeHtml(item.descripcion || "Sin detalle de revisión")}</p>
        </section>

        <section class="drawer-section">
            <h3>Repuestos utilizados</h3>
            ${renderDetailRepuestos(item.repuestos)}
        </section>

        <div id="repuestosCatalogoSection"></div>

        <section class="drawer-section">
            <h3>Archivos adjuntos</h3>
            ${renderDetailAttachment(item)}
        </section>
    `;

    window.VehiAmb.ui.show(maintenanceDrawerBackdrop);
    window.VehiAmb.ui.show(maintenanceDrawer);
    maintenanceDrawer.setAttribute("aria-hidden", "false");
    closeMaintenanceDrawer.focus();

    try {
        const repuestosCatalogo = await window.VehiAmb.api.getMantenimientoRepuestos(item.id);
        const contenedor = document.getElementById("repuestosCatalogoSection");
        if (contenedor) contenedor.innerHTML = renderRepuestosCatalogo(repuestosCatalogo);
    } catch (error) {
        // Mantenimientos viejos (o sin repuestos de catalogo) simplemente no muestran esta seccion.
    }
}

viewEtiquetaButton.addEventListener("click", () => {
    if (!currentDetailItem) return;
    window.open(`etiqueta-cambio-aceite.html?mantenimiento_id=${currentDetailItem.id}`, "_blank", "noreferrer");
});

function closeDetailDrawer() {
    window.VehiAmb.ui.hide(maintenanceDrawerBackdrop);
    window.VehiAmb.ui.hide(maintenanceDrawer);
    maintenanceDrawer.setAttribute("aria-hidden", "true");
}

function renderMantenimientos(mantenimientos) {
    if (!mantenimientos.length) {
        mantenimientosList.innerHTML = '<p class="dash-empty">No hay mantenimientos para los filtros seleccionados</p>';
        return;
    }

    mantenimientosList.innerHTML = mantenimientos.map((item) => `
        <article class="record-item clickable-record" data-maintenance-id="${item.id}" tabindex="0" role="button" aria-label="Ver detalle de mantenimiento ${escapeHtml(item.placa) || ""}">
            <div class="record-top">
                <div>
                    <span class="record-title">${escapeHtml(tiposMantenimiento[item.tipo] || item.tipo)}</span>
                    <span class="record-sub">${escapeHtml(item.placa) || "Sin placa"} - ${escapeHtml(item.marca) || ""} ${escapeHtml(item.modelo) || ""}</span>
                </div>
                <span class="pill">${formatDate(item.fecha)}</span>
            </div>
            <p>${escapeHtml(item.descripcion) || "Sin detalle de revisión"}</p>
            <div class="record-meta">
                <span class="pill">${formatCurrency(item.valor)}</span>
                <span class="pill">${Number(item.kilometraje || 0).toLocaleString("es-CO")} km</span>
                ${renderEstadoBadge(item.estado)}
                ${item.vehiculo_varado ? '<span class="pill">Vehículo varado</span>' : ""}
                ${renderRepuestosMeta(item.repuestos)}
                <span class="pill">Autorizado por: ${escapeHtml(item.autorizado_por) || "No registrado"}</span>
                <span class="pill">Hecho por: ${escapeHtml(item.hecho_por) || "No registrado"}</span>
                ${item.soporte_url ? '<span class="pill">Soporte adjunto</span>' : ""}
            </div>
            ${renderAttachment(item)}
        </article>
    `).join("");
}

function currentMaintenanceFilters() {
    return {
        placa: filterPlaca.value.trim(),
        tipo: filterTipo.value,
        fecha_desde: filterFechaDesde.value,
        fecha_hasta: filterFechaHasta.value
    };
}

function updateFilterSummary(filteredCount) {
    const total = totalMantenimientosCount;
    const filters = currentMaintenanceFilters();
    const hasFilters = Boolean(filters.placa || filters.tipo || filters.fecha_desde || filters.fecha_hasta);

    if (!total) {
        filterSummary.textContent = "Aún no hay mantenimientos registrados.";
        return;
    }

    filterSummary.textContent = hasFilters
        ? `Mostrando ${filteredCount} de ${total} mantenimientos.`
        : `Mostrando todos los mantenimientos (${total}).`;
}

async function applyMaintenanceFilters() {
    const requestToken = ++filtersRequestToken;

    try {
        window.VehiAmb.ui.show(loader);
        const mantenimientos = await window.VehiAmb.api.getMantenimientos(currentMaintenanceFilters());
        if (requestToken !== filtersRequestToken) return;

        mantenimientosState = mantenimientos;
        renderMantenimientos(mantenimientos);
        updateFilterSummary(mantenimientos.length);
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
        fillVehicleSelect(filterPlaca, vehiculos, "Todas las placas", "placa");

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
});
valorManoObraInput.addEventListener("input", () => {
    window.VehiAmb.ui.formatearMonedaEnVivo(valorManoObraInput);
    updateCostoTotal();
});
mantenimientoTipo.addEventListener("change", updateCambioAceiteFields);

mantenimientosFilterForm.addEventListener("submit", (event) => {
    event.preventDefault();
});

[filterPlaca, filterTipo, filterFechaDesde, filterFechaHasta].forEach((input) => {
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
    applyMaintenanceFilters();
});

mantenimientosList.addEventListener("click", (event) => {
    if (event.target.closest("a")) return;

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

exportHistorialButton.addEventListener("click", async () => {
    const originalLabel = exportHistorialButton.textContent;
    exportHistorialButton.disabled = true;
    exportHistorialButton.textContent = "Generando...";

    try {
        await window.VehiAmb.mantenimientos.exportHistorialPdf(mantenimientosState, currentMaintenanceFilters());
    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudo exportar el historial", "error");
    } finally {
        exportHistorialButton.disabled = false;
        exportHistorialButton.textContent = originalLabel;
    }
});

exportHistorialExcelButton.addEventListener("click", async () => {
    const originalLabel = exportHistorialExcelButton.textContent;
    exportHistorialExcelButton.disabled = true;
    exportHistorialExcelButton.textContent = "Generando...";

    try {
        await window.VehiAmb.mantenimientos.exportHistorialExcel(mantenimientosState, currentMaintenanceFilters());
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

addRepuestoButton.addEventListener("click", addRepuesto);
repuestoInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        event.preventDefault();
        addRepuesto();
    }
});

document.addEventListener("DOMContentLoaded", async () => {
    await window.VehiAmb.auth.fetchCurrentUser();

    if (!window.VehiAmb.auth.hasPermission("maintenance.create")) {
        document.getElementById("registrarMantenimientoSection")?.classList.add("hidden");
    }

    renderRepuestosBuilder();
    updateCostoTotal();
    updateCambioAceiteFields();
    cargarDatos();
});
