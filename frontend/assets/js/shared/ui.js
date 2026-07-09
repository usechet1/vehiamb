window.VehiAmb = window.VehiAmb || {};

window.VehiAmb.ui = {
    show(element) {
        element?.classList.remove("hidden");
    },

    hide(element) {
        element?.classList.add("hidden");
    },

    showMessage(element, text, type = "success") {
        if (!element) return;

        element.textContent = text;
        element.classList.toggle("error", type === "error");
        element.classList.remove("hidden");

        window.setTimeout(() => {
            element.classList.add("hidden");
            element.classList.remove("error");
        }, 3000);
    },

    // Formatea un input de texto con separador de miles ("." estilo es-CO)
    // mientras el usuario digita, preservando la posicion del cursor. El
    // valor real (sin puntos, con "," como decimal) se restituye antes de
    // enviar el formulario con parseFormattedNumber().
    formatearNumeroEnVivo(input) {
        const posicionDesdeElFinal = input.value.length - input.selectionStart;

        let raw = input.value.replace(/[^\d,]/g, "");
        const primeraComa = raw.indexOf(",");
        if (primeraComa !== -1) {
            raw = raw.slice(0, primeraComa + 1) + raw.slice(primeraComa + 1).replaceAll(",", "");
        }

        let [parteEntera, parteDecimal] = raw.split(",");
        parteEntera = parteEntera.replace(/^0+(?=\d)/, "");
        const parteEnteraFormateada = parteEntera.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

        input.value = parteDecimal !== undefined ? `${parteEnteraFormateada},${parteDecimal}` : parteEnteraFormateada;

        const nuevaPosicion = Math.max(0, input.value.length - posicionDesdeElFinal);
        input.setSelectionRange(nuevaPosicion, nuevaPosicion);
    },

    formatearNumeroParaMostrar(value) {
        if (value === null || value === undefined || value === "") return "";

        const numero = Number(value);
        if (!Number.isFinite(numero)) return String(value);

        const [parteEntera, parteDecimal] = String(numero).split(".");
        const parteEnteraFormateada = parteEntera.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
        return parteDecimal ? `${parteEnteraFormateada},${parteDecimal}` : parteEnteraFormateada;
    },

    parseFormattedNumber(value) {
        if (value === null || value === undefined) return "";
        return String(value).replaceAll(".", "").replace(",", ".");
    },

    // Variante con signo "$" para campos de dinero (sin decimales, pesos
    // colombianos enteros). El signo se antepone solo visualmente; el valor
    // real se obtiene con parseFormattedMoneda().
    formatearMonedaEnVivo(input) {
        const posicionDesdeElFinal = input.value.length - input.selectionStart;

        let raw = input.value.replace(/[^\d]/g, "");
        raw = raw.replace(/^0+(?=\d)/, "");
        const formateado = raw.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

        input.value = formateado ? `$ ${formateado}` : "$ 0";

        const nuevaPosicion = Math.max(0, input.value.length - posicionDesdeElFinal);
        input.setSelectionRange(nuevaPosicion, nuevaPosicion);
    },

    parseFormattedMoneda(value) {
        if (value === null || value === undefined) return "0";
        const digitos = String(value).replace(/[^\d]/g, "");
        return digitos || "0";
    },

    // Reemplaza window.confirm() nativo (dialogo del sistema operativo, sin
    // estilo posible) por un modal propio con la misma identidad visual del
    // resto de la app. Devuelve una Promise<boolean>, igual que el patron de
    // uso de confirm() pero awaited.
    confirm({ title = "Confirmar", message = "", confirmText = "Confirmar", cancelText = "Cancelar" } = {}) {
        return new Promise((resolve) => {
            const backdrop = document.createElement("div");
            backdrop.className = "confirm-backdrop";

            const modal = document.createElement("div");
            modal.className = "confirm-modal";
            modal.setAttribute("role", "alertdialog");
            modal.setAttribute("aria-modal", "true");

            const titleEl = document.createElement("h3");
            titleEl.textContent = title;

            const messageEl = document.createElement("p");
            messageEl.textContent = message;

            const actions = document.createElement("div");
            actions.className = "confirm-modal-actions";

            const cancelButton = document.createElement("button");
            cancelButton.type = "button";
            cancelButton.className = "btn-secondary";
            cancelButton.textContent = cancelText;

            const okButton = document.createElement("button");
            okButton.type = "button";
            okButton.className = "btn-primary";
            okButton.textContent = confirmText;

            actions.append(cancelButton, okButton);
            modal.append(titleEl, messageEl, actions);
            backdrop.append(modal);
            document.body.appendChild(backdrop);

            function cleanup(result) {
                backdrop.remove();
                document.removeEventListener("keydown", onKeydown);
                resolve(result);
            }

            function onKeydown(event) {
                if (event.key === "Escape") cleanup(false);
            }

            backdrop.addEventListener("click", (event) => {
                if (event.target === backdrop) cleanup(false);
            });
            cancelButton.addEventListener("click", () => cleanup(false));
            okButton.addEventListener("click", () => cleanup(true));
            document.addEventListener("keydown", onKeydown);
            okButton.focus();
        });
    }
};
