const asignacionForm = document.getElementById("asignacionForm");
const asignacionFormTitle = document.getElementById("asignacionFormTitle");
const asignacionId = document.getElementById("asignacionId");
const asignacionFecha = document.getElementById("asignacionFecha");
const asignacionConductor = document.getElementById("asignacionConductor");
const asignacionVehiculo = document.getElementById("asignacionVehiculo");
const asignacionDestinos = document.getElementById("asignacionDestinos");
const asignacionAgregarDestinoButton = document.getElementById("asignacionAgregarDestinoButton");
const asignacionDestinosLegacyHint = document.getElementById("asignacionDestinosLegacyHint");
const asignacionTelefono = document.getElementById("asignacionTelefono");
const asignacionObservaciones = document.getElementById("asignacionObservaciones");
const asignacionSubmitButton = document.getElementById("asignacionSubmitButton");
const asignacionCancelEditButton = document.getElementById("asignacionCancelEditButton");

const asignacionesFilterForm = document.getElementById("asignacionesFilterForm");
const asignacionesFiltroFecha = document.getElementById("asignacionesFiltroFecha");
const asignacionesTableBody = document.getElementById("asignacionesTableBody");
const asignacionesExportarImagenButton = document.getElementById("asignacionesExportarImagenButton");
const asignacionesExportarExcelButton = document.getElementById("asignacionesExportarExcelButton");

const loader = document.getElementById("loader");
const mensaje = document.getElementById("mensaje");

let conductoresCatalogo = [];
let asignacionesActuales = [];
let departamentosCatalogo = [];

// Cada fila = un destino ({ departamento, municipio }) en el orden del
// recorrido. Se arman con los mismos selects en cascada que usaba antes el
// conductor para elegir su destino (ver frontend/assets/js/shared/ubicaciones.js).
function crearFilaDestino(valores = {}) {
    const fila = document.createElement("div");
    fila.className = "asignacion-destino-fila";
    fila.innerHTML = `
        <div class="form-group">
            <label>Departamento</label>
            <select class="asignacion-destino-departamento">
                <option value="">Selecciona...</option>
            </select>
        </div>
        <div class="form-group">
            <label>Municipio</label>
            <select class="asignacion-destino-municipio" disabled>
                <option value="">Selecciona primero un departamento...</option>
            </select>
        </div>
        <button type="button" class="btn-secondary asignacion-destino-quitar" aria-label="Quitar destino" title="Quitar destino">✕</button>
    `;

    const departamentoSelect = fila.querySelector(".asignacion-destino-departamento");
    const municipioSelect = fila.querySelector(".asignacion-destino-municipio");

    for (const { departamento } of departamentosCatalogo) {
        departamentoSelect.appendChild(new Option(departamento, departamento));
    }

    departamentoSelect.addEventListener("change", () => {
        const seleccionado = departamentosCatalogo.find((item) => item.departamento === departamentoSelect.value);

        municipioSelect.innerHTML = "";
        if (!seleccionado) {
            municipioSelect.disabled = true;
            municipioSelect.appendChild(new Option("Selecciona primero un departamento...", ""));
        } else {
            municipioSelect.disabled = false;
            municipioSelect.appendChild(new Option("Selecciona un municipio...", ""));
            for (const ciudad of seleccionado.ciudades) {
                municipioSelect.appendChild(new Option(ciudad, ciudad));
            }
        }
    });

    fila.querySelector(".asignacion-destino-quitar").addEventListener("click", () => {
        if (asignacionDestinos.children.length <= 1) return;
        fila.remove();
    });

    if (valores.departamento) {
        departamentoSelect.value = valores.departamento;
        departamentoSelect.dispatchEvent(new Event("change"));
        if (valores.municipio) municipioSelect.value = valores.municipio;
    }

    return fila;
}

function agregarFilaDestino(valores = {}) {
    const fila = crearFilaDestino(valores);
    asignacionDestinos.appendChild(fila);
    return fila;
}

function resetDestinos() {
    asignacionDestinos.innerHTML = "";
    asignacionDestinosLegacyHint.classList.add("hidden");
    agregarFilaDestino();
}

function obtenerDestinosSeleccionados() {
    return [...asignacionDestinos.querySelectorAll(".asignacion-destino-fila")].map((fila) => ({
        departamento: fila.querySelector(".asignacion-destino-departamento").value,
        municipio: fila.querySelector(".asignacion-destino-municipio").value
    }));
}

// Al agregar un destino manualmente (no al reconstruir filas en modo edicion
// ni al resetear el formulario) se resalta la fila nueva un momento, para que
// quede notorio que el clic si agrego una fila y no pase desapercibido.
asignacionAgregarDestinoButton.addEventListener("click", () => {
    const fila = agregarFilaDestino();
    fila.classList.add("es-nueva");
    // setTimeout en vez de esperar "animationend": con prefers-reduced-motion
    // la animacion no corre y ese evento nunca se dispara, dejando la fila
    // resaltada para siempre.
    setTimeout(() => fila.classList.remove("es-nueva"), 1300);
    fila.scrollIntoView({ behavior: "smooth", block: "nearest" });
});

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
    const [conductores, vehiculos, departamentos] = await Promise.all([
        window.VehiAmb.api.getConductoresCatalogo(),
        window.VehiAmb.api.getVehiculosCatalogo(),
        window.VehiAmb.ubicaciones.cargarDepartamentosCiudades()
    ]);

    conductoresCatalogo = conductores || [];
    departamentosCatalogo = departamentos || [];

    asignacionConductor.innerHTML = '<option value="">Selecciona...</option>' + conductoresCatalogo
        .map((c) => `<option value="${c.id}">${escapeHtml(`${c.nombres} ${c.apellidos}`.trim())}</option>`)
        .join("");

    asignacionVehiculo.innerHTML = '<option value="">Selecciona...</option>' + vehiculos
        .filter((v) => v.estado === "activo")
        .map((v) => `<option value="${v.id}">${escapeHtml(v.placa)}</option>`)
        .join("");
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
    resetDestinos();
}

function renderRow(item, indice) {
    return `
        <tr>
            <td>${indice + 1}</td>
            <td>${escapeHtml(item.conductor_nombre || "Sin conductor")}</td>
            <td>${escapeHtml(item.ruta_nombre || "--")}</td>
            <td>${escapeHtml(item.telefono || "--")}</td>
            <td>${escapeHtml(item.vehiculo_placa || "Sin vehículo")}</td>
            <td>${escapeHtml(item.observaciones || "--")}</td>
            <td>
                <button type="button" class="btn-secondary" data-editar-asignacion="${item.id}">Editar</button>
                <button type="button" class="btn-secondary" data-eliminar-asignacion="${item.id}">Eliminar</button>
            </td>
        </tr>
    `;
}

async function cargarAsignaciones() {
    try {
        asignacionesTableBody.innerHTML = '<tr><td colspan="7" class="dash-empty">Cargando...</td></tr>';
        asignacionesActuales = await window.VehiAmb.api.getAsignacionesPorFecha(asignacionesFiltroFecha.value);

        asignacionesTableBody.innerHTML = asignacionesActuales.length
            ? asignacionesActuales.map(renderRow).join("")
            : '<tr><td colspan="7" class="dash-empty">Sin asignaciones para esta fecha</td></tr>';
    } catch (error) {
        asignacionesActuales = [];
        asignacionesTableBody.innerHTML = '<tr><td colspan="7" class="dash-empty">No fue posible cargar las asignaciones</td></tr>';
    }
}

asignacionesExportarImagenButton.addEventListener("click", async () => {
    asignacionesExportarImagenButton.disabled = true;
    try {
        await window.VehiAmb.asignacionesExport.exportReporteImagen({
            fecha: asignacionesFiltroFecha.value,
            asignaciones: asignacionesActuales
        });
    } catch (error) {
        window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudo generar la imagen", "error");
    } finally {
        asignacionesExportarImagenButton.disabled = false;
    }
});

asignacionesExportarExcelButton.addEventListener("click", async () => {
    asignacionesExportarExcelButton.disabled = true;
    try {
        await window.VehiAmb.asignacionesExport.exportReporteExcel({
            fecha: asignacionesFiltroFecha.value,
            asignaciones: asignacionesActuales
        });
    } catch (error) {
        window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudo generar el Excel", "error");
    } finally {
        asignacionesExportarExcelButton.disabled = false;
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

    const destinos = obtenerDestinosSeleccionados();
    if (!destinos.length || destinos.some((destino) => !destino.departamento || !destino.municipio)) {
        window.VehiAmb.ui.showMessage(mensaje, "Selecciona departamento y municipio en cada destino", "error");
        return;
    }

    const payload = {
        fecha: asignacionFecha.value,
        conductor_id: asignacionConductor.value,
        vehiculo_id: asignacionVehiculo.value,
        destinos,
        telefono: asignacionTelefono.value.trim(),
        observaciones: asignacionObservaciones.value.trim()
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
        asignacionTelefono.value = asignacion.telefono || "";
        asignacionObservaciones.value = asignacion.observaciones || "";

        asignacionDestinos.innerHTML = "";
        if (asignacion.destinos?.length) {
            asignacionDestinosLegacyHint.classList.add("hidden");
            asignacion.destinos.forEach((destino) => agregarFilaDestino(destino));
        } else {
            // Asignaciones creadas antes de este cambio solo tienen ruta_nombre
            // (texto libre) -- no hay forma confiable de reconstruir los
            // destinos estructurados a partir de ese texto, se le pide al
            // usuario que los vuelva a seleccionar.
            asignacionDestinosLegacyHint.textContent = asignacion.ruta_nombre
                ? `Ruta actual (texto libre): "${asignacion.ruta_nombre}". Selecciona los destinos para reemplazarla.`
                : "";
            asignacionDestinosLegacyHint.classList.toggle("hidden", !asignacion.ruta_nombre);
            agregarFilaDestino();
        }

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
        resetDestinos();
    } catch (error) {
        window.VehiAmb.ui.showMessage(mensaje, "No se pudieron cargar conductores/vehículos/rutas", "error");
    }

    await cargarAsignaciones();
});
