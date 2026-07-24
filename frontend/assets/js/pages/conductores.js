const conductorForm = document.getElementById("conductorForm");
const conductorFormTitle = document.getElementById("conductorFormTitle");
const conductorId = document.getElementById("conductorId");
const conductorNombres = document.getElementById("conductorNombres");
const conductorApellidos = document.getElementById("conductorApellidos");
const conductorCedula = document.getElementById("conductorCedula");
const conductorTelefono = document.getElementById("conductorTelefono");
const conductorLicenciaCategoria = document.getElementById("conductorLicenciaCategoria");
const conductorLicenciaArchivo = document.getElementById("conductorLicenciaArchivo");
const conductorLicenciaArchivoActual = document.getElementById("conductorLicenciaArchivoActual");
const conductorEmail = document.getElementById("conductorEmail");
const conductorPassword = document.getElementById("conductorPassword");
const conductorPasswordLabel = document.getElementById("conductorPasswordLabel");
const conductorPasswordHelp = document.getElementById("conductorPasswordHelp");
const conductorEstado = document.getElementById("conductorEstado");
const conductorSubmitButton = document.getElementById("conductorSubmitButton");
const conductorCancelEditButton = document.getElementById("conductorCancelEditButton");

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

function resetForm() {
    conductorForm.reset();
    conductorId.value = "";
    conductorEstado.value = "activo";
    conductorFormTitle.textContent = "Registrar conductor";
    conductorSubmitButton.textContent = "Guardar conductor";
    conductorCancelEditButton.classList.add("hidden");
    conductorLicenciaArchivoActual.classList.add("hidden");
    conductorLicenciaArchivoActual.innerHTML = "";

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
    const archivoUrl = item.licencia_archivo_url ? window.VehiAmb.api.getAssetUrl(item.licencia_archivo_url) : "";
    return `
        <tr>
            <td>${escapeHtml(nombreCompleto(item))}</td>
            <td>${escapeHtml(item.cedula || "--")}</td>
            <td>${escapeHtml(item.telefono || "--")}</td>
            <td>${escapeHtml(item.email || "--")}</td>
            <td>${escapeHtml(item.licencia_categoria || "--")}</td>
            <td>${archivoUrl ? `<a href="${escapeHtml(archivoUrl)}" target="_blank" rel="noopener">Ver</a>` : "--"}</td>
            <td><span class="badge ${item.estado === "activo" ? "badge-verde" : "badge-rojo"}">${item.estado === "activo" ? "Activo" : "Inactivo"}</span></td>
            <td><button type="button" class="btn-secondary" data-editar-conductor="${item.id}">Editar</button></td>
        </tr>
    `;
}

async function cargarConductores() {
    try {
        conductoresTableBody.innerHTML = '<tr><td colspan="8" class="dash-empty">Cargando...</td></tr>';
        const resultado = await window.VehiAmb.api.getConductores({
            search: conductoresSearch.value || undefined,
            estado: conductoresFiltroEstado.value || undefined,
            page: currentPage,
            limit: 20
        });

        totalPages = resultado.totalPages;

        conductoresTableBody.innerHTML = resultado.items.length
            ? resultado.items.map(renderRow).join("")
            : '<tr><td colspan="8" class="dash-empty">No hay conductores registrados con esos filtros</td></tr>';

        conductoresListSummary.textContent = `Página ${resultado.page} de ${resultado.totalPages} · ${resultado.total} conductores`;
        conductoresPrevPage.disabled = currentPage <= 1;
        conductoresNextPage.disabled = currentPage >= totalPages;
    } catch (error) {
        conductoresTableBody.innerHTML = '<tr><td colspan="8" class="dash-empty">No fue posible cargar los conductores</td></tr>';
    }
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
        conductorLicenciaCategoria.value = conductor.licencia_categoria || "";
        conductorEmail.value = conductor.email || "";
        conductorPassword.value = "";
        conductorPassword.required = false;
        conductorPasswordLabel.textContent = "Contraseña";
        conductorPasswordHelp.textContent = conductor.usuario_id
            ? "Deja este campo en blanco para no cambiar la contraseña."
            : "Este conductor todavía no tiene acceso: ponle una contraseña (mínimo 6 caracteres) para crearle su cuenta.";
        conductorEstado.value = conductor.estado;

        if (conductor.licencia_archivo_url) {
            const archivoUrl = window.VehiAmb.api.getAssetUrl(conductor.licencia_archivo_url);
            conductorLicenciaArchivoActual.innerHTML = `Archivo actual: <a href="${escapeHtml(archivoUrl)}" target="_blank" rel="noopener">${escapeHtml(conductor.licencia_archivo_nombre || "ver archivo")}</a> (sube uno nuevo para reemplazarlo)`;
            conductorLicenciaArchivoActual.classList.remove("hidden");
        } else {
            conductorLicenciaArchivoActual.classList.add("hidden");
            conductorLicenciaArchivoActual.innerHTML = "";
        }

        conductorFormTitle.textContent = `Editar conductor: ${nombreCompleto(conductor)}`;
        conductorSubmitButton.textContent = "Guardar cambios";
        conductorCancelEditButton.classList.remove("hidden");
        conductorForm.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
        window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudo cargar el conductor", "error");
    }
});

conductorCancelEditButton.addEventListener("click", resetForm);

conductorForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData();
    formData.append("nombres", conductorNombres.value.trim());
    formData.append("apellidos", conductorApellidos.value.trim());
    formData.append("cedula", conductorCedula.value.trim());
    formData.append("telefono", conductorTelefono.value.trim());
    formData.append("licencia_categoria", conductorLicenciaCategoria.value.trim());
    formData.append("email", conductorEmail.value.trim());
    formData.append("estado", conductorEstado.value);
    if (conductorPassword.value) {
        formData.append("password", conductorPassword.value);
    }
    if (conductorLicenciaArchivo.files[0]) {
        formData.append("licencia_archivo", conductorLicenciaArchivo.files[0]);
    }

    conductorSubmitButton.disabled = true;

    try {
        window.VehiAmb.ui.show(loader);

        if (conductorId.value) {
            await window.VehiAmb.api.updateConductor(conductorId.value, formData);
            window.VehiAmb.ui.showMessage(mensaje, "Conductor actualizado correctamente");
        } else {
            await window.VehiAmb.api.createConductor(formData);
            window.VehiAmb.ui.showMessage(mensaje, "Conductor registrado correctamente");
        }

        resetForm();
        currentPage = 1;
        await cargarConductores();
    } catch (error) {
        window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudo guardar el conductor", "error");
    } finally {
        window.VehiAmb.ui.hide(loader);
        conductorSubmitButton.disabled = false;
    }
});

document.addEventListener("DOMContentLoaded", () => {
    if (!window.VehiAmb.auth?.hasPermission?.("conductores.manage")) {
        conductorForm.closest(".section-card")?.classList.add("hidden");
    }

    resetForm();
    cargarConductores();
});
