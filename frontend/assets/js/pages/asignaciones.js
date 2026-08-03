const asignacionForm = document.getElementById("asignacionForm");
const asignacionFormTitle = document.getElementById("asignacionFormTitle");
const asignacionId = document.getElementById("asignacionId");
const asignacionFecha = document.getElementById("asignacionFecha");
const asignacionConductor = document.getElementById("asignacionConductor");
const asignacionVehiculo = document.getElementById("asignacionVehiculo");
const asignacionRuta = document.getElementById("asignacionRuta");
const rutasDatalist = document.getElementById("rutasDatalist");
const asignacionTelefono = document.getElementById("asignacionTelefono");
const asignacionSubmitButton = document.getElementById("asignacionSubmitButton");
const asignacionCancelEditButton = document.getElementById("asignacionCancelEditButton");

const asignacionesFilterForm = document.getElementById("asignacionesFilterForm");
const asignacionesFiltroFecha = document.getElementById("asignacionesFiltroFecha");
const asignacionesTableBody = document.getElementById("asignacionesTableBody");
const asignacionesExportarButton = document.getElementById("asignacionesExportarButton");

const loader = document.getElementById("loader");
const mensaje = document.getElementById("mensaje");

let conductoresCatalogo = [];
let asignacionesActuales = [];

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function hoyISO() {
    const hoy = new Date();
    const offset = hoy.getTimezoneOffset();
    return new Date(hoy.getTime() - offset * 60000).toISOString().slice(0, 10);
}

async function cargarCatalogos() {
    const [conductores, vehiculos, rutas] = await Promise.all([
        window.VehiAmb.api.getConductoresCatalogo(),
        window.VehiAmb.api.getVehiculosCatalogo(),
        window.VehiAmb.api.getRutasCatalogo()
    ]);

    conductoresCatalogo = conductores || [];

    asignacionConductor.innerHTML = '<option value="">Selecciona...</option>' + conductoresCatalogo
        .map((c) => `<option value="${c.id}">${escapeHtml(`${c.nombres} ${c.apellidos}`.trim())}</option>`)
        .join("");

    asignacionVehiculo.innerHTML = '<option value="">Selecciona...</option>' + vehiculos
        .filter((v) => v.estado === "activo")
        .map((v) => `<option value="${v.id}">${escapeHtml(v.placa)}</option>`)
        .join("");

    rutasDatalist.innerHTML = rutas.map((r) => `<option value="${escapeHtml(r.nombre)}"></option>`).join("");
}

// Al elegir un conductor se rellena el telefono con el que ya tiene
// registrado en su ficha -- se puede editar despues si para esta asignacion
// puntual aplica otro numero de contacto.
asignacionConductor.addEventListener("change", () => {
    const conductor = conductoresCatalogo.find((c) => String(c.id) === asignacionConductor.value);
    asignacionTelefono.value = conductor?.telefono || "";
});

function resetForm() {
    asignacionForm.reset();
    asignacionId.value = "";
    asignacionFecha.value = asignacionesFiltroFecha.value || hoyISO();
    asignacionFormTitle.textContent = "Nueva asignación";
    asignacionSubmitButton.textContent = "Guardar asignación";
    asignacionCancelEditButton.classList.add("hidden");
}

function renderRow(item, indice) {
    return `
        <tr>
            <td>${indice + 1}</td>
            <td>${escapeHtml(item.conductor_nombre || "Sin conductor")}</td>
            <td>${escapeHtml(item.ruta_nombre || "--")}</td>
            <td>${escapeHtml(item.telefono || "--")}</td>
            <td>${escapeHtml(item.vehiculo_placa || "Sin vehículo")}</td>
            <td>
                <button type="button" class="btn-secondary" data-editar-asignacion="${item.id}">Editar</button>
                <button type="button" class="btn-secondary" data-eliminar-asignacion="${item.id}">Eliminar</button>
            </td>
        </tr>
    `;
}

async function cargarAsignaciones() {
    try {
        asignacionesTableBody.innerHTML = '<tr><td colspan="6" class="dash-empty">Cargando...</td></tr>';
        asignacionesActuales = await window.VehiAmb.api.getAsignacionesPorFecha(asignacionesFiltroFecha.value);

        asignacionesTableBody.innerHTML = asignacionesActuales.length
            ? asignacionesActuales.map(renderRow).join("")
            : '<tr><td colspan="6" class="dash-empty">Sin asignaciones para esta fecha</td></tr>';
    } catch (error) {
        asignacionesActuales = [];
        asignacionesTableBody.innerHTML = '<tr><td colspan="6" class="dash-empty">No fue posible cargar las asignaciones</td></tr>';
    }
}

asignacionesExportarButton.addEventListener("click", async () => {
    asignacionesExportarButton.disabled = true;
    try {
        await window.VehiAmb.asignacionesExport.exportReportePdf({
            fecha: asignacionesFiltroFecha.value,
            asignaciones: asignacionesActuales
        });
    } catch (error) {
        window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudo generar el PDF", "error");
    } finally {
        asignacionesExportarButton.disabled = false;
    }
});

asignacionesFilterForm.addEventListener("submit", (event) => event.preventDefault());

asignacionesFiltroFecha.addEventListener("change", () => {
    cargarAsignaciones();
    if (!asignacionId.value) {
        asignacionFecha.value = asignacionesFiltroFecha.value;
    }
});

asignacionCancelEditButton.addEventListener("click", resetForm);

asignacionForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const payload = {
        fecha: asignacionFecha.value,
        conductor_id: asignacionConductor.value,
        vehiculo_id: asignacionVehiculo.value,
        ruta_nombre: asignacionRuta.value.trim(),
        telefono: asignacionTelefono.value.trim()
    };

    asignacionSubmitButton.disabled = true;

    try {
        window.VehiAmb.ui.show(loader);

        if (asignacionId.value) {
            await window.VehiAmb.api.actualizarAsignacion(asignacionId.value, payload);
            window.VehiAmb.ui.showMessage(mensaje, "Asignación actualizada correctamente");
        } else {
            await window.VehiAmb.api.crearAsignacion(payload);
            window.VehiAmb.ui.showMessage(mensaje, "Asignación registrada correctamente");
        }

        await cargarCatalogos();
        resetForm();
        await cargarAsignaciones();
    } catch (error) {
        window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudo guardar la asignación", "error");
    } finally {
        window.VehiAmb.ui.hide(loader);
        asignacionSubmitButton.disabled = false;
    }
});

asignacionesTableBody.addEventListener("click", async (event) => {
    const editarButton = event.target.closest("[data-editar-asignacion]");
    if (editarButton) {
        const asignaciones = await window.VehiAmb.api.getAsignacionesPorFecha(asignacionesFiltroFecha.value);
        const asignacion = asignaciones.find((item) => String(item.id) === editarButton.dataset.editarAsignacion);
        if (!asignacion) return;

        asignacionId.value = asignacion.id;
        asignacionFecha.value = asignacion.fecha ? String(asignacion.fecha).slice(0, 10) : hoyISO();
        asignacionConductor.value = asignacion.conductor_id || "";
        asignacionVehiculo.value = asignacion.vehiculo_id || "";
        asignacionRuta.value = asignacion.ruta_nombre || "";
        asignacionTelefono.value = asignacion.telefono || "";

        asignacionFormTitle.textContent = "Editar asignación";
        asignacionSubmitButton.textContent = "Guardar cambios";
        asignacionCancelEditButton.classList.remove("hidden");
        asignacionForm.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
    }

    const eliminarButton = event.target.closest("[data-eliminar-asignacion]");
    if (eliminarButton) {
        const confirmado = await window.VehiAmb.ui.confirm({
            title: "Eliminar asignación",
            message: "¿Eliminar esta asignación del reporte? Esta acción no se puede deshacer.",
            confirmText: "Eliminar"
        });
        if (!confirmado) return;

        try {
            await window.VehiAmb.api.eliminarAsignacion(eliminarButton.dataset.eliminarAsignacion);
            window.VehiAmb.ui.showMessage(mensaje, "Asignación eliminada correctamente");
            await cargarAsignaciones();
        } catch (error) {
            window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudo eliminar la asignación", "error");
        }
    }
});

document.addEventListener("DOMContentLoaded", async () => {
    if (!window.VehiAmb.auth?.hasPermission?.("asignaciones.create")) {
        asignacionForm.closest(".section-card")?.classList.add("hidden");
    }

    asignacionesFiltroFecha.value = hoyISO();
    asignacionFecha.value = hoyISO();

    try {
        await cargarCatalogos();
    } catch (error) {
        window.VehiAmb.ui.showMessage(mensaje, "No se pudieron cargar conductores/vehículos/rutas", "error");
    }

    await cargarAsignaciones();
});
