const repuestoForm = document.getElementById("repuestoForm");
const repuestoFormTitle = document.getElementById("repuestoFormTitle");
const repuestoId = document.getElementById("repuestoId");
const repuestoCodigoInterno = document.getElementById("repuestoCodigoInterno");
const repuestoNombre = document.getElementById("repuestoNombre");
const repuestoCategoria = document.getElementById("repuestoCategoria");
const repuestoMarca = document.getElementById("repuestoMarca");
const repuestoReferencia = document.getElementById("repuestoReferencia");
const repuestoUnidadMedida = document.getElementById("repuestoUnidadMedida");
const repuestoValorPromedio = document.getElementById("repuestoValorPromedio");
const repuestoEstado = document.getElementById("repuestoEstado");
const repuestoObservaciones = document.getElementById("repuestoObservaciones");
const repuestoSubmitButton = document.getElementById("repuestoSubmitButton");
const repuestoCancelEditButton = document.getElementById("repuestoCancelEditButton");

const equivalenciasSection = document.getElementById("equivalenciasSection");
const equivalenciaInput = document.getElementById("equivalenciaInput");
const addEquivalenciaButton = document.getElementById("addEquivalenciaButton");
const equivalenciaSeleccionadaInfo = document.getElementById("equivalenciaSeleccionadaInfo");
const equivalenciasList = document.getElementById("equivalenciasList");
const equivalenciasEmpty = document.getElementById("equivalenciasEmpty");

const repuestosFilterForm = document.getElementById("repuestosFilterForm");
const repuestosSearch = document.getElementById("repuestosSearch");
const repuestosFiltroCategoria = document.getElementById("repuestosFiltroCategoria");
const repuestosFiltroEstado = document.getElementById("repuestosFiltroEstado");
const repuestosTableBody = document.getElementById("repuestosTableBody");
const repuestosListSummary = document.getElementById("repuestosListSummary");
const repuestosPrevPage = document.getElementById("repuestosPrevPage");
const repuestosNextPage = document.getElementById("repuestosNextPage");

const loader = document.getElementById("loader");
const mensaje = document.getElementById("mensaje");

let currentPage = 1;
let totalPages = 1;
let searchDebounce = null;

const CATEGORIA_LABEL = {
    aceite_motor: "Aceite Motor",
    filtro_aceite: "Filtro Aceite",
    filtro_aire: "Filtro Aire",
    filtro_combustible: "Filtro Combustible",
    llantas: "Llantas",
    baterias: "Baterias",
    lubricantes: "Lubricantes",
    refrigerantes: "Refrigerantes",
    correas: "Correas",
    bombillos: "Bombillos",
    otros: "Otros"
};

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatMoney(value) {
    return Number(value || 0).toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
}

function formatNumber(value) {
    return Number(value || 0).toLocaleString("es-CO", { maximumFractionDigits: 3 });
}

function resetForm() {
    repuestoForm.reset();
    repuestoId.value = "";
    repuestoUnidadMedida.value = "UND";
    repuestoCategoria.value = "otros";
    repuestoEstado.value = "activo";
    repuestoFormTitle.textContent = "Registrar repuesto";
    repuestoSubmitButton.textContent = "Guardar repuesto";
    repuestoCancelEditButton.classList.add("hidden");
    equivalenciasSection.classList.add("hidden");
}

function renderEquivalencias(equivalencias) {
    equivalenciasList.innerHTML = equivalencias.map((eq) => `
        <li class="simple-checklist-item">
            <div class="simple-checklist-content">
                <span class="simple-checklist-label">${eq.prioridad}. ${eq.nombre}</span>
                <span class="simple-checklist-detail">${eq.codigo_interno} · Stock: ${formatNumber(eq.stock_disponible)}</span>
            </div>
            <button type="button" class="simple-checklist-remove" data-id="${eq.id}">Quitar</button>
        </li>
    `).join("");

    equivalenciasEmpty.classList.toggle("hidden", equivalencias.length > 0);
}

async function cargarEquivalencias() {
    if (!repuestoId.value) return;

    try {
        const equivalencias = await window.VehiAmb.api.getRepuestoEquivalencias(repuestoId.value);
        renderEquivalencias(equivalencias);
    } catch (error) {
        window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudieron cargar las equivalencias", "error");
    }
}

let equivalenciaSeleccionada = null;

window.VehiAmb.crearRepuestoAutocomplete(equivalenciaInput, {
    onSelect(repuesto) {
        equivalenciaSeleccionada = repuesto;
        equivalenciaSeleccionadaInfo.textContent = `${repuesto.codigo_interno} · Categoria: ${CATEGORIA_LABEL[repuesto.categoria] || repuesto.categoria}`;
        equivalenciaSeleccionadaInfo.classList.remove("hidden");
        addEquivalenciaButton.disabled = false;
    }
});

addEquivalenciaButton.addEventListener("click", async () => {
    if (!equivalenciaSeleccionada || !repuestoId.value) return;

    addEquivalenciaButton.disabled = true;
    try {
        await window.VehiAmb.api.createRepuestoEquivalencia(repuestoId.value, { repuesto_equivalente_id: equivalenciaSeleccionada.id });
        equivalenciaInput.value = "";
        equivalenciaSeleccionadaInfo.classList.add("hidden");
        equivalenciaSeleccionada = null;
        await cargarEquivalencias();
    } catch (error) {
        window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudo agregar la equivalencia", "error");
    } finally {
        addEquivalenciaButton.disabled = false;
    }
});

equivalenciasList.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-id]");
    if (!button || !repuestoId.value) return;

    button.disabled = true;
    try {
        await window.VehiAmb.api.deleteRepuestoEquivalencia(repuestoId.value, button.dataset.id);
        await cargarEquivalencias();
    } catch (error) {
        window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudo quitar la equivalencia", "error");
        button.disabled = false;
    }
});

function renderRow(item) {
    const stockBajo = Number(item.stock_fisico) <= Number(item.stock_minimo) && Number(item.stock_minimo) > 0;

    return `
        <tr>
            <td>${escapeHtml(item.codigo_interno)}</td>
            <td>${escapeHtml(item.nombre)}</td>
            <td>${CATEGORIA_LABEL[item.categoria] || item.categoria}</td>
            <td>${escapeHtml(item.marca || "--")}</td>
            <td>${formatMoney(item.valor_promedio)}</td>
            <td class="${stockBajo ? "import-error-count" : ""}">${formatNumber(item.stock_fisico)}</td>
            <td>${formatNumber(item.stock_minimo)}</td>
            <td><span class="badge ${item.estado === "activo" ? "badge-verde" : "badge-rojo"}">${item.estado === "activo" ? "Activo" : "Inactivo"}</span></td>
            <td><button type="button" class="btn-secondary" data-editar-repuesto="${item.id}">Editar</button></td>
        </tr>
    `;
}

async function cargarRepuestos() {
    try {
        repuestosTableBody.innerHTML = '<tr><td colspan="9" class="dash-empty">Cargando...</td></tr>';
        const resultado = await window.VehiAmb.api.getRepuestos({
            search: repuestosSearch.value || undefined,
            categoria: repuestosFiltroCategoria.value || undefined,
            estado: repuestosFiltroEstado.value || undefined,
            page: currentPage,
            limit: 20
        });

        totalPages = resultado.totalPages;

        repuestosTableBody.innerHTML = resultado.items.length
            ? resultado.items.map(renderRow).join("")
            : '<tr><td colspan="9" class="dash-empty">No hay repuestos registrados con esos filtros</td></tr>';

        repuestosListSummary.textContent = `Pagina ${resultado.page} de ${resultado.totalPages} · ${resultado.total} repuestos`;
        repuestosPrevPage.disabled = currentPage <= 1;
        repuestosNextPage.disabled = currentPage >= totalPages;
    } catch (error) {
        repuestosTableBody.innerHTML = '<tr><td colspan="9" class="dash-empty">No fue posible cargar el catalogo</td></tr>';
    }
}

repuestosFilterForm.addEventListener("submit", (event) => event.preventDefault());

repuestosSearch.addEventListener("input", () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
        currentPage = 1;
        cargarRepuestos();
    }, 300);
});

[repuestosFiltroCategoria, repuestosFiltroEstado].forEach((select) => {
    select.addEventListener("change", () => {
        currentPage = 1;
        cargarRepuestos();
    });
});

repuestosPrevPage.addEventListener("click", () => {
    if (currentPage <= 1) return;
    currentPage -= 1;
    cargarRepuestos();
});

repuestosNextPage.addEventListener("click", () => {
    if (currentPage >= totalPages) return;
    currentPage += 1;
    cargarRepuestos();
});

repuestosTableBody.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-editar-repuesto]");
    if (!button) return;

    try {
        const repuesto = await window.VehiAmb.api.getRepuesto(button.dataset.editarRepuesto);

        repuestoId.value = repuesto.id;
        repuestoCodigoInterno.value = repuesto.codigo_interno;
        repuestoNombre.value = repuesto.nombre;
        repuestoCategoria.value = repuesto.categoria;
        repuestoMarca.value = repuesto.marca || "";
        repuestoReferencia.value = repuesto.referencia || "";
        repuestoUnidadMedida.value = repuesto.unidad_medida;
        repuestoValorPromedio.value = repuesto.valor_promedio;
        repuestoEstado.value = repuesto.estado;
        repuestoObservaciones.value = repuesto.observaciones || "";

        repuestoFormTitle.textContent = `Editar repuesto: ${repuesto.codigo_interno}`;
        repuestoSubmitButton.textContent = "Guardar cambios";
        repuestoCancelEditButton.classList.remove("hidden");
        equivalenciasSection.classList.remove("hidden");
        await cargarEquivalencias();
        repuestoForm.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
        window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudo cargar el repuesto", "error");
    }
});

repuestoCancelEditButton.addEventListener("click", resetForm);

repuestoForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const payload = {
        codigo_interno: repuestoCodigoInterno.value.trim(),
        nombre: repuestoNombre.value.trim(),
        categoria: repuestoCategoria.value,
        marca: repuestoMarca.value.trim(),
        referencia: repuestoReferencia.value.trim(),
        unidad_medida: repuestoUnidadMedida.value.trim() || "UND",
        valor_promedio: repuestoValorPromedio.value || 0,
        estado: repuestoEstado.value,
        observaciones: repuestoObservaciones.value.trim()
    };

    repuestoSubmitButton.disabled = true;

    try {
        window.VehiAmb.ui.show(loader);

        if (repuestoId.value) {
            await window.VehiAmb.api.updateRepuesto(repuestoId.value, payload);
            window.VehiAmb.ui.showMessage(mensaje, "Repuesto actualizado correctamente");
        } else {
            await window.VehiAmb.api.createRepuesto(payload);
            window.VehiAmb.ui.showMessage(mensaje, "Repuesto registrado correctamente");
        }

        resetForm();
        currentPage = 1;
        await cargarRepuestos();
    } catch (error) {
        window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudo guardar el repuesto", "error");
    } finally {
        window.VehiAmb.ui.hide(loader);
        repuestoSubmitButton.disabled = false;
    }
});

document.addEventListener("DOMContentLoaded", () => {
    resetForm();
    cargarRepuestos();
});
