const conductorForm = document.getElementById("conductorForm");
const conductorFormTitle = document.getElementById("conductorFormTitle");
const conductorId = document.getElementById("conductorId");
const conductorNombres = document.getElementById("conductorNombres");
const conductorApellidos = document.getElementById("conductorApellidos");
const conductorCedula = document.getElementById("conductorCedula");
const conductorTelefono = document.getElementById("conductorTelefono");
const conductorEmail = document.getElementById("conductorEmail");
const conductorPassword = document.getElementById("conductorPassword");
const conductorPasswordLabel = document.getElementById("conductorPasswordLabel");
const conductorPasswordHelp = document.getElementById("conductorPasswordHelp");
const conductorEstado = document.getElementById("conductorEstado");
const conductorExcluirCostos = document.getElementById("conductorExcluirCostos");
const conductorSubmitButton = document.getElementById("conductorSubmitButton");
const conductorCancelEditButton = document.getElementById("conductorCancelEditButton");

const conductorLicenciasSection = document.getElementById("conductorLicenciasSection");
const conductorLicenciasNombre = document.getElementById("conductorLicenciasNombre");
const conductorLicenciasTableBody = document.getElementById("conductorLicenciasTableBody");
const conductorLicenciaForm = document.getElementById("conductorLicenciaForm");
const licenciaId = document.getElementById("licenciaId");
const licenciaCategoria = document.getElementById("licenciaCategoria");
const licenciaFechaVencimiento = document.getElementById("licenciaFechaVencimiento");
const licenciaArchivo = document.getElementById("licenciaArchivo");
const licenciaArchivoActual = document.getElementById("licenciaArchivoActual");
const licenciaSubmitButton = document.getElementById("licenciaSubmitButton");
const licenciaCancelEditButton = document.getElementById("licenciaCancelEditButton");

const conductoresFilterForm = document.getElementById("conductoresFilterForm");
const conductoresSearch = document.getElementById("conductoresSearch");
const conductoresFiltroEstado = document.getElementById("conductoresFiltroEstado");
const conductoresTableBody = document.getElementById("conductoresTableBody");
const conductoresListSummary = document.getElementById("conductoresListSummary");
const conductoresPrevPage = document.getElementById("conductoresPrevPage");
const conductoresNextPage = document.getElementById("conductoresNextPage");

const loader = document.getElementById("loader");
const mensaje = document.getElementById("mensaje");

let currentPage = 1;
let totalPages = 1;
let searchDebounce = null;

// Conductor cuyas licencias se estan mostrando/editando en el panel de abajo
// del formulario (solo existe una vez que el conductor ya fue guardado, ya
// que una licencia necesita un conductor_id para poder crearse).
let conductorEnEdicionId = null;

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Filtra caracteres no numericos mientras el usuario escribe (en vez de
// solo rechazar al enviar), asi cedula y telefono nunca llegan a tener una
// letra o simbolo aunque el pattern/HTML5 igual valide la longitud al enviar.
function soloDigitos(input, maxLength) {
    input.addEventListener("input", () => {
        input.value = input.value.replace(/\D/g, "").slice(0, maxLength);
    });
}

soloDigitos(conductorCedula, 10);
soloDigitos(conductorTelefono, 10);

// Nombres y apellidos son texto estricto: se filtran numeros y simbolos en
// vivo (se permiten letras, tildes/ñ y espacios), ademas de la validacion
// del backend que rechaza el guardado si igual llega algo distinto.
function soloTexto(input) {
    input.addEventListener("input", () => {
        const { selectionStart, selectionEnd } = input;
        input.value = input.value.toUpperCase().replace(/[^A-ZÁÉÍÓÚÑÜ\s]/g, "");
        input.setSelectionRange(selectionStart, selectionEnd);
    });
}

soloTexto(conductorNombres);
soloTexto(conductorApellidos);

function resetLicenciaForm() {
    conductorLicenciaForm.reset();
    licenciaId.value = "";
    licenciaSubmitButton.textContent = "Agregar licencia";
    licenciaCancelEditButton.classList.add("hidden");
    licenciaArchivoActual.classList.add("hidden");
    licenciaArchivoActual.innerHTML = "";
}

function resetForm() {
    conductorForm.reset();
    conductorId.value = "";
    conductorEstado.value = "activo";
    conductorExcluirCostos.checked = false;
    conductorFormTitle.textContent = "Registrar conductor";
    conductorSubmitButton.textContent = "Guardar conductor";
    conductorCancelEditButton.classList.add("hidden");

    conductorEnEdicionId = null;
    conductorLicenciasSection.classList.add("hidden");
    resetLicenciaForm();

    // En creacion la contraseña es obligatoria (se crea el usuario del
    // conductor de una vez); en edicion se deja opcional para no forzar a
    // cambiarla cada vez que se edita algun otro dato.
    conductorPassword.required = true;
    conductorPasswordLabel.textContent = "Contraseña *";
    conductorPasswordHelp.textContent = "Con esta contraseña el conductor entra a su cuenta (mínimo 6 caracteres).";
}

function nombreCompleto(item) {
    return `${item.nombres} ${item.apellidos}`.trim();
}

function renderRow(item) {
    return `
        <tr>
            <td>${escapeHtml(nombreCompleto(item))}</td>
            <td>${escapeHtml(item.cedula || "--")}</td>
            <td class="conductores-col-telefono">${escapeHtml(item.telefono || "--")}</td>
            <td class="conductores-col-correo">${escapeHtml(item.email || "--")}</td>
            <td>${escapeHtml(item.licencias_resumen || "Sin licencias")}</td>
            <td><span class="badge ${item.estado === "activo" ? "badge-verde" : "badge-rojo"}">${item.estado === "activo" ? "Activo" : "Inactivo"}</span></td>
            <td><button type="button" class="btn-secondary" data-editar-conductor="${item.id}">Editar</button></td>
        </tr>
    `;
}

async function cargarConductores() {
    try {
        conductoresTableBody.innerHTML = '<tr><td colspan="7" class="dash-empty">Cargando...</td></tr>';
        const resultado = await window.VehiAmb.api.getConductores({
            search: conductoresSearch.value || undefined,
            estado: conductoresFiltroEstado.value || undefined,
            page: currentPage,
            limit: 3
        });

        totalPages = resultado.totalPages;

        conductoresTableBody.innerHTML = resultado.items.length
            ? resultado.items.map(renderRow).join("")
            : '<tr><td colspan="7" class="dash-empty">No hay conductores registrados con esos filtros</td></tr>';

        conductoresListSummary.textContent = `Página ${resultado.page} de ${resultado.totalPages} · ${resultado.total} conductores`;
        conductoresPrevPage.disabled = currentPage <= 1;
        conductoresNextPage.disabled = currentPage >= totalPages;
    } catch (error) {
        conductoresTableBody.innerHTML = '<tr><td colspan="7" class="dash-empty">No fue posible cargar los conductores</td></tr>';
    }
}

function formatFecha(value) {
    if (!value) return "--";
    return new Date(value).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}

function renderLicenciaRow(licencia) {
    const archivoUrl = licencia.archivo_url ? window.VehiAmb.api.getAssetUrl(licencia.archivo_url) : "";
    return `
        <tr>
            <td>${escapeHtml(licencia.categoria)}</td>
            <td>${formatFecha(licencia.fecha_vencimiento)}</td>
            <td>${archivoUrl ? `<a href="${escapeHtml(archivoUrl)}" target="_blank" rel="noopener">Ver</a>` : "--"}</td>
            <td>
                <button type="button" class="btn-secondary" data-editar-licencia="${licencia.id}">Editar</button>
                <button type="button" class="btn-secondary" data-eliminar-licencia="${licencia.id}">Eliminar</button>
            </td>
        </tr>
    `;
}

async function cargarLicencias(conductorId) {
    try {
        const licencias = await window.VehiAmb.api.getConductorLicencias(conductorId);
        conductorLicenciasTableBody.innerHTML = licencias.length
            ? licencias.map(renderLicenciaRow).join("")
            : '<tr><td colspan="4" class="dash-empty">Sin licencias registradas</td></tr>';
    } catch (error) {
        conductorLicenciasTableBody.innerHTML = '<tr><td colspan="4" class="dash-empty">No fue posible cargar las licencias</td></tr>';
    }
}

async function abrirLicenciasDe(conductor) {
    conductorEnEdicionId = conductor.id;
    conductorLicenciasNombre.textContent = nombreCompleto(conductor);
    conductorLicenciasSection.classList.remove("hidden");
    resetLicenciaForm();
    await cargarLicencias(conductor.id);
}

conductoresFilterForm.addEventListener("submit", (event) => event.preventDefault());

conductoresSearch.addEventListener("input", () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
        currentPage = 1;
        cargarConductores();
    }, 300);
});

conductoresFiltroEstado.addEventListener("change", () => {
    currentPage = 1;
    cargarConductores();
});

conductoresPrevPage.addEventListener("click", () => {
    if (currentPage <= 1) return;
    currentPage -= 1;
    cargarConductores();
});

conductoresNextPage.addEventListener("click", () => {
    if (currentPage >= totalPages) return;
    currentPage += 1;
    cargarConductores();
});

conductoresTableBody.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-editar-conductor]");
    if (!button) return;

    try {
        const conductor = await window.VehiAmb.api.getConductor(button.dataset.editarConductor);

        conductorId.value = conductor.id;
        conductorNombres.value = conductor.nombres;
        conductorApellidos.value = conductor.apellidos;
        conductorCedula.value = conductor.cedula || "";
        conductorTelefono.value = conductor.telefono || "";
        conductorEmail.value = conductor.email || "";
        conductorPassword.value = "";
        conductorPassword.required = false;
        conductorPasswordLabel.textContent = "Contraseña";
        conductorPasswordHelp.textContent = conductor.usuario_id
            ? "Deja este campo en blanco para no cambiar la contraseña."
            : "Este conductor todavía no tiene acceso: ponle una contraseña (mínimo 6 caracteres) para crearle su cuenta.";
        conductorEstado.value = conductor.estado;
        conductorExcluirCostos.checked = Boolean(conductor.excluir_de_costos);

        conductorFormTitle.textContent = `Editar conductor: ${nombreCompleto(conductor)}`;
        conductorSubmitButton.textContent = "Guardar cambios";
        conductorCancelEditButton.classList.remove("hidden");
        conductorForm.scrollIntoView({ behavior: "smooth", block: "start" });

        await abrirLicenciasDe(conductor);
    } catch (error) {
        window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudo cargar el conductor", "error");
    }
});

conductorCancelEditButton.addEventListener("click", resetForm);

conductorForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const payload = {
        nombres: conductorNombres.value.trim(),
        apellidos: conductorApellidos.value.trim(),
        cedula: conductorCedula.value.trim(),
        telefono: conductorTelefono.value.trim(),
        email: conductorEmail.value.trim(),
        estado: conductorEstado.value,
        excluir_de_costos: conductorExcluirCostos.checked
    };
    if (conductorPassword.value) {
        payload.password = conductorPassword.value;
    }

    conductorSubmitButton.disabled = true;

    try {
        window.VehiAmb.ui.show(loader);

        let conductor;
        if (conductorId.value) {
            conductor = await window.VehiAmb.api.updateConductor(conductorId.value, payload);
            window.VehiAmb.ui.showMessage(mensaje, "Conductor actualizado correctamente");
        } else {
            conductor = await window.VehiAmb.api.createConductor(payload);
            window.VehiAmb.ui.showMessage(mensaje, "Conductor registrado correctamente. Ya puedes agregarle sus licencias abajo.");
        }

        currentPage = 1;
        await cargarConductores();

        // Tras crear o editar, se deja el formulario listo para seguir
        // editando ese mismo conductor (y poder agregarle licencias de una
        // vez) en vez de resetear todo -- solo "Cancelar edición" limpia.
        conductorId.value = conductor.id;
        conductorFormTitle.textContent = `Editar conductor: ${nombreCompleto(conductor)}`;
        conductorSubmitButton.textContent = "Guardar cambios";
        conductorCancelEditButton.classList.remove("hidden");
        conductorPassword.value = "";
        conductorPassword.required = false;
        conductorPasswordLabel.textContent = "Contraseña";
        conductorPasswordHelp.textContent = "Deja este campo en blanco para no cambiar la contraseña.";

        await abrirLicenciasDe(conductor);
    } catch (error) {
        window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudo guardar el conductor", "error");
    } finally {
        window.VehiAmb.ui.hide(loader);
        conductorSubmitButton.disabled = false;
    }
});

conductorLicenciasTableBody.addEventListener("click", async (event) => {
    const editarButton = event.target.closest("[data-editar-licencia]");
    if (editarButton) {
        try {
            const licencias = await window.VehiAmb.api.getConductorLicencias(conductorEnEdicionId);
            const licencia = licencias.find((item) => String(item.id) === editarButton.dataset.editarLicencia);
            if (!licencia) return;

            licenciaId.value = licencia.id;
            licenciaCategoria.value = licencia.categoria;
            licenciaFechaVencimiento.value = licencia.fecha_vencimiento ? String(licencia.fecha_vencimiento).slice(0, 10) : "";
            licenciaSubmitButton.textContent = "Guardar cambios";
            licenciaCancelEditButton.classList.remove("hidden");

            if (licencia.archivo_url) {
                const archivoUrl = window.VehiAmb.api.getAssetUrl(licencia.archivo_url);
                licenciaArchivoActual.innerHTML = `Archivo actual: <a href="${escapeHtml(archivoUrl)}" target="_blank" rel="noopener">${escapeHtml(licencia.archivo_nombre || "ver archivo")}</a> (sube uno nuevo para reemplazarlo)`;
                licenciaArchivoActual.classList.remove("hidden");
            } else {
                licenciaArchivoActual.classList.add("hidden");
                licenciaArchivoActual.innerHTML = "";
            }

            conductorLicenciaForm.scrollIntoView({ behavior: "smooth", block: "start" });
        } catch (error) {
            window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudo cargar la licencia", "error");
        }
        return;
    }

    const eliminarButton = event.target.closest("[data-eliminar-licencia]");
    if (eliminarButton) {
        const confirmado = await window.VehiAmb.ui.confirm({
            title: "Eliminar licencia",
            message: "¿Eliminar esta licencia del conductor? Esta acción no se puede deshacer.",
            confirmText: "Eliminar"
        });
        if (!confirmado) return;

        try {
            await window.VehiAmb.api.deleteConductorLicencia(eliminarButton.dataset.eliminarLicencia);
            window.VehiAmb.ui.showMessage(mensaje, "Licencia eliminada correctamente");
            await cargarLicencias(conductorEnEdicionId);
        } catch (error) {
            window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudo eliminar la licencia", "error");
        }
    }
});

licenciaCancelEditButton.addEventListener("click", resetLicenciaForm);

conductorLicenciaForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!conductorEnEdicionId) return;

    const formData = new FormData();
    formData.append("categoria", licenciaCategoria.value);
    if (licenciaFechaVencimiento.value) {
        formData.append("fecha_vencimiento", licenciaFechaVencimiento.value);
    }
    if (licenciaArchivo.files[0]) {
        formData.append("archivo", licenciaArchivo.files[0]);
    }

    licenciaSubmitButton.disabled = true;

    try {
        window.VehiAmb.ui.show(loader);

        if (licenciaId.value) {
            await window.VehiAmb.api.updateConductorLicencia(licenciaId.value, formData);
            window.VehiAmb.ui.showMessage(mensaje, "Licencia actualizada correctamente");
        } else {
            await window.VehiAmb.api.createConductorLicencia(conductorEnEdicionId, formData);
            window.VehiAmb.ui.showMessage(mensaje, "Licencia agregada correctamente");
        }

        resetLicenciaForm();
        await cargarLicencias(conductorEnEdicionId);
        await cargarConductores();
    } catch (error) {
        window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudo guardar la licencia", "error");
    } finally {
        window.VehiAmb.ui.hide(loader);
        licenciaSubmitButton.disabled = false;
    }
});

document.addEventListener("DOMContentLoaded", () => {
    if (!window.VehiAmb.auth?.hasPermission?.("conductores.manage")) {
        conductorForm.closest(".section-card")?.classList.add("hidden");
        conductorLicenciasSection.classList.add("hidden");
    }

    resetForm();
    cargarConductores();
});
