// Autocomplete generico de repuestos: se usa en el formulario de
// mantenimiento y en el picker de "repuestos sugeridos" de la ficha del
// vehiculo. Envuelve el input recibido en un contenedor relativo (si no lo
// esta ya) y le agrega una lista desplegable de sugerencias.
window.VehiAmb = window.VehiAmb || {};

function crearRepuestoAutocomplete(inputEl, { onSelect } = {}) {
    if (!inputEl.parentElement.classList.contains("repuesto-autocomplete-wrap")) {
        const wrap = document.createElement("div");
        wrap.className = "repuesto-autocomplete-wrap";
        inputEl.parentElement.insertBefore(wrap, inputEl);
        wrap.appendChild(inputEl);
    }

    const wrap = inputEl.parentElement;
    const lista = document.createElement("ul");
    lista.className = "repuesto-autocomplete-list hidden";
    wrap.appendChild(lista);

    let resultados = [];
    let indiceActivo = -1;
    let debounceTimer = null;

    function ocultar() {
        lista.classList.add("hidden");
        lista.innerHTML = "";
        resultados = [];
        indiceActivo = -1;
    }

    function marcarActivo() {
        [...lista.children].forEach((li, index) => li.classList.toggle("is-active", index === indiceActivo));
    }

    function renderizar() {
        if (!resultados.length) {
            ocultar();
            return;
        }

        lista.innerHTML = resultados.map((repuesto) => `
            <li data-id="${repuesto.id}">
                <span class="repuesto-autocomplete-nombre">${repuesto.nombre}</span>
                <span class="repuesto-autocomplete-meta">${repuesto.codigo_interno} · Stock: ${Number(repuesto.stock_disponible || 0)}</span>
            </li>
        `).join("");

        lista.classList.remove("hidden");
        indiceActivo = -1;
    }

    function seleccionar(repuesto) {
        inputEl.value = repuesto.nombre;
        ocultar();
        onSelect?.(repuesto);
    }

    inputEl.addEventListener("input", () => {
        clearTimeout(debounceTimer);
        const term = inputEl.value.trim();

        if (term.length < 2) {
            ocultar();
            return;
        }

        debounceTimer = setTimeout(async () => {
            try {
                resultados = await window.VehiAmb.api.buscarRepuestos(term);
                renderizar();
            } catch (error) {
                ocultar();
            }
        }, 300);
    });

    inputEl.addEventListener("keydown", (event) => {
        if (lista.classList.contains("hidden")) return;

        if (event.key === "ArrowDown") {
            event.preventDefault();
            indiceActivo = Math.min(indiceActivo + 1, resultados.length - 1);
            marcarActivo();
        } else if (event.key === "ArrowUp") {
            event.preventDefault();
            indiceActivo = Math.max(indiceActivo - 1, 0);
            marcarActivo();
        } else if (event.key === "Enter") {
            if (indiceActivo >= 0) {
                event.preventDefault();
                seleccionar(resultados[indiceActivo]);
            }
        } else if (event.key === "Escape") {
            ocultar();
        }
    });

    lista.addEventListener("mousedown", (event) => {
        const li = event.target.closest("li[data-id]");
        if (!li) return;

        const repuesto = resultados.find((item) => String(item.id) === li.dataset.id);
        if (repuesto) seleccionar(repuesto);
    });

    document.addEventListener("click", (event) => {
        if (!wrap.contains(event.target)) ocultar();
    });

    return {
        clear() {
            inputEl.value = "";
            ocultar();
        }
    };
}

window.VehiAmb.crearRepuestoAutocomplete = crearRepuestoAutocomplete;
