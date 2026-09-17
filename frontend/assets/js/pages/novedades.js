const loader = document.getElementById("loader");
const mensaje = document.getElementById("mensaje");

const registrarNovedadSection = document.getElementById("registrarNovedadSection");
const novedadForm = document.getElementById("novedadForm");
const novedadVehiculo = document.getElementById("novedadVehiculo");
const novedadFecha = document.getElementById("novedadFecha");
const novedadSubmitButton = document.getElementById("novedadSubmitButton");

const novedadesTablaBody = document.getElementById("novedadesTablaBody");
const filterNovedadVehiculo = document.getElementById("filterNovedadVehiculo");
const filterNovedadDesde = document.getElementById("filterNovedadDesde");
const filterNovedadHasta = document.getElementById("filterNovedadHasta");
const novedadesFilterSummary = document.getElementById("novedadesFilterSummary");
const clearNovedadesFiltersButton = document.getElementById("clearNovedadesFiltersButton");
const novedadesFilterForm = document.getElementById("novedadesFilterForm");

let novedadesState = [];

function hoyISO() {
    const hoy = new Date();
    const offset = hoy.getTimezoneOffset();
    return new Date(hoy.getTime() - offset * 60000).toISOString().slice(0, 10);
}

function escapeHtml(valor) {
    return String(valor ?? "").replace(/[&<>"']/g, (caracter) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[caracter]);
}

function formatFecha(valor) {
    if (!valor) return "-";
    const [anio, mes, dia] = String(valor).slice(0, 10).split("-");
    return anio && mes && dia ? `${dia}/${mes}/${anio}` : "-";
}

function fillVehicleSelect(select, vehiculos, placeholder = "Selecciona un vehículo", valueField = "id") {
    if (!select) return;

    const seleccionado = select.value;
    select.innerHTML = `<option value="">${placeholder}</option>`;

    vehiculos.forEach((vehiculo) => {
        const option = document.createElement("option");
        option.value = vehiculo[valueField];
        option.textContent = `${vehiculo.placa} — ${vehiculo.marca || ""} ${vehiculo.modelo || ""}`.trim();
        select.appendChild(option);
    });

    select.value = seleccionado;
}

function puedeCrear() {
    return Boolean(window.VehiAmb.auth?.hasPermission?.("novedades.create"));
}

function puedeEliminar() {
    return Boolean(window.VehiAmb.auth?.hasPermission?.("novedades.delete"));
}

function filtrarNovedades() {
    const vehiculoId = filterNovedadVehiculo.value;
    const desde = filterNovedadDesde.value;
    const hasta = filterNovedadHasta.value;

    return novedadesState.filter((novedad) => {
        if (vehiculoId && String(novedad.vehiculo_id) !== vehiculoId) return false;
        if (desde && novedad.fecha < desde) return false;
        if (hasta && novedad.fecha > hasta) return false;
        return true;
    });
}

function renderNovedades() {
    const filtradas = filtrarNovedades();

    const hayFiltros = Boolean(filterNovedadVehiculo.value || filterNovedadDesde.value || filterNovedadHasta.value);
    novedadesFilterSummary.textContent = hayFiltros
        ? `Mostrando ${filtradas.length} de ${novedadesState.length} novedades.`
        : "Mostrando todas las novedades.";

    if (!filtradas.length) {
        novedadesTablaBody.innerHTML = '<tr><td colspan="5" class="dash-empty">No hay novedades registradas</td></tr>';
        return;
    }

    novedadesTablaBody.innerHTML = filtradas
        .map((novedad) => `
            <tr>
                <td>${formatFecha(novedad.fecha)}</td>
                <td>${escapeHtml(novedad.placa)} — ${escapeHtml(novedad.marca || "")} ${escapeHtml(novedad.modelo || "")}</td>
                <td>${escapeHtml(novedad.descripcion)}</td>
                <td>${novedad.foto_url ? `<a href="${window.VehiAmb.api.getAssetUrl(novedad.foto_url)}" target="_blank" rel="noopener">Ver foto</a>` : "-"}</td>
                <td class="table-actions">${puedeEliminar() ? `<button type="button" class="btn-secondary btn-danger" data-eliminar-novedad="${novedad.id}">Eliminar</button>` : ""}</td>
            </tr>
        `)
        .join("");
}

async function cargarNovedades() {
    try {
        novedadesState = await window.VehiAmb.api.getNovedades();
        renderNovedades();
    } catch (error) {
        console.error(error);
        novedadesTablaBody.innerHTML = '<tr><td colspan="5" class="dash-empty">No fue posible cargar las novedades</td></tr>';
    }
}

function resetNovedadForm() {
    novedadForm.reset();
    novedadFecha.value = hoyISO();
}

novedadForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(novedadForm);

    try {
        window.VehiAmb.ui.show(loader);
        await window.VehiAmb.api.createNovedad(formData);
        window.VehiAmb.ui.showMessage(mensaje, "Novedad registrada correctamente");
        resetNovedadForm();
        await cargarNovedades();
    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudo guardar la novedad", "error");
    } finally {
        window.VehiAmb.ui.hide(loader);
    }
});

novedadesTablaBody?.addEventListener("click", async (event) => {
    const eliminarButton = event.target.closest("[data-eliminar-novedad]");
    if (!eliminarButton) return;

    const confirmado = await window.VehiAmb.ui.confirm({
        title: "Eliminar novedad",
        message: "Esta acción no se puede deshacer.",
        confirmText: "Eliminar"
    });
    if (!confirmado) return;

    try {
        window.VehiAmb.ui.show(loader);
        await window.VehiAmb.api.deleteNovedad(eliminarButton.dataset.eliminarNovedad);
        window.VehiAmb.ui.showMessage(mensaje, "Novedad eliminada correctamente");
        await cargarNovedades();
    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudo eliminar la novedad", "error");
    } finally {
        window.VehiAmb.ui.hide(loader);
    }
});

// Sin esto, Enter dentro de un campo del filtro dispara el submit implicito
// del <form> y recarga la pagina (mismo guard que en seguridad.js/documentos.js).
novedadesFilterForm?.addEventListener("submit", (event) => event.preventDefault());

filterNovedadVehiculo?.addEventListener("change", renderNovedades);
filterNovedadDesde?.addEventListener("change", renderNovedades);
filterNovedadHasta?.addEventListener("change", renderNovedades);

clearNovedadesFiltersButton?.addEventListener("click", () => {
    filterNovedadVehiculo.value = "";
    filterNovedadDesde.value = "";
    filterNovedadHasta.value = "";
    renderNovedades();
});

document.addEventListener("DOMContentLoaded", async () => {
    await window.VehiAmb.auth.fetchCurrentUser();

    if (!puedeCrear()) {
        registrarNovedadSection?.remove();
    } else {
        window.VehiAmb.ui.show(registrarNovedadSection);
        novedadFecha.value = hoyISO();
    }

    try {
        window.VehiAmb.ui.show(loader);

        const vehiculos = await window.VehiAmb.api.getVehiculosCatalogo();
        fillVehicleSelect(novedadVehiculo, vehiculos);
        fillVehicleSelect(filterNovedadVehiculo, vehiculos, "Todos los vehículos");

        await cargarNovedades();
    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(mensaje, error.message || "No fue posible cargar la página", "error");
    } finally {
        window.VehiAmb.ui.hide(loader);
    }
});
