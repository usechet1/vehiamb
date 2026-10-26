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

        // Un mensaje nuevo cancela el auto-ocultado del anterior -- sin esto,
        // dos avisos seguidos (comun en moviles con conexion lenta, donde el
        // usuario reintenta) podian terminar con el timeout del primero
        // ocultando el segundo antes de que se alcance a leer.
        if (element._hideTimeout) {
            window.clearTimeout(element._hideTimeout);
        }

        element.textContent = text;
        element.classList.toggle("error", type === "error");
        element.classList.remove("hidden");

        if (!element._dismissOnTap) {
            element._dismissOnTap = true;
            element.addEventListener("click", () => {
                window.clearTimeout(element._hideTimeout);
                element.classList.add("hidden");
                element.classList.remove("error");
            });
        }

        // Duracion proporcional al largo del texto (los mensajes de error
        // del backend suelen ser una frase completa) -- minimo 3.5s, maximo
        // 9s, para que en pantallas chicas alcance a leerse sin quedar
        // pegado en camino demasiado tiempo si es corto.
        const duracion = Math.min(9000, Math.max(3500, text.length * 65));

        element._hideTimeout = window.setTimeout(() => {
            element.classList.add("hidden");
            element.classList.remove("error");
        }, duracion);
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

    // Igual que formatearMonedaEnVivo, pero admite decimales (","), para
    // valores unitarios de repuestos que si necesitan centavos (ej. insumos
    // importados con precio fraccionario). El valor real se obtiene con
    // parseFormattedMonedaDecimal().
    formatearMonedaDecimalEnVivo(input) {
        const posicionDesdeElFinal = input.value.length - input.selectionStart;

        let raw = input.value.replace(/[^\d,]/g, "");
        const primeraComa = raw.indexOf(",");
        if (primeraComa !== -1) {
            raw = raw.slice(0, primeraComa + 1) + raw.slice(primeraComa + 1).replaceAll(",", "");
        }

        let [parteEntera, parteDecimal] = raw.split(",");
        parteEntera = parteEntera.replace(/^0+(?=\d)/, "");
        const parteEnteraFormateada = parteEntera.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
        const cuerpo = parteDecimal !== undefined ? `${parteEnteraFormateada},${parteDecimal}` : parteEnteraFormateada;

        input.value = `$ ${cuerpo}`;

        const nuevaPosicion = Math.max(0, input.value.length - posicionDesdeElFinal);
        input.setSelectionRange(nuevaPosicion, nuevaPosicion);
    },

    formatearMonedaDecimalParaMostrar(value) {
        if (value === null || value === undefined || value === "") return "$ 0";

        const numero = Number(value);
        if (!Number.isFinite(numero)) return `$ ${value}`;

        const [parteEntera, parteDecimal] = numero.toFixed(2).split(".");
        const parteEnteraFormateada = parteEntera.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
        return parteDecimal === "00" ? `$ ${parteEnteraFormateada}` : `$ ${parteEnteraFormateada},${parteDecimal}`;
    },

    parseFormattedMonedaDecimal(value) {
        if (value === null || value === undefined) return "0";
        const sinSigno = String(value).replace(/^\$\s*/, "");
        return window.VehiAmb.ui.parseFormattedNumber(sinSigno) || "0";
    },

    // Las fotos de camara de celular pueden pesar varios MB -- si se suben
    // tal cual, en una conexion movil el envio se siente "colgado" durante
    // mucho tiempo. Se reescala/recomprime en el navegador ANTES de armar el
    // FormData, para que lo que viaje por la red ya sea liviano (el backend
    // igual vuelve a comprimir por si acaso, ver compress-image.js).
    async comprimirImagen(file, { maxDimension = 1600, calidad = 0.8 } = {}) {
        if (!file || !file.type.startsWith("image/") || file.type === "image/svg+xml") return file;

        try {
            const bitmap = await createImageBitmap(file);
            const escala = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
            const width = Math.round(bitmap.width * escala);
            const height = Math.round(bitmap.height * escala);

            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            canvas.getContext("2d").drawImage(bitmap, 0, 0, width, height);

            const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", calidad));
            if (!blob || blob.size >= file.size) return file;

            const nombre = file.name.replace(/\.[^.]+$/, "") + ".jpg";
            return new File([blob], nombre, { type: "image/jpeg" });
        } catch (error) {
            console.error("No se pudo comprimir la imagen en el navegador, se sube el original:", error);
            return file;
        }
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
    },

    // Dictado por voz para un <textarea> (Web Speech API) -- si el navegador
    // no la soporta, oculta el boton en vez de fallar. Usado por la
    // descripcion de mantenimientos y por los comentarios de un viaje.
    setupDictadoVoz(button, textarea, helpEl) {
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
    },

    // Agrega un boton "Tomar foto" junto a un <input type="file"> ya
    // existente, sin tocar su name/accept ni el resto del formulario. En
    // algunos telefonos (sobre todo Android con ciertos navegadores), un
    // <input type="file"> sin el atributo "capture" no ofrece la camara en
    // el selector, solo galeria/archivos -- este boton crea un input
    // paralelo con capture="environment" y, al tomar la foto, la copia al
    // input original via DataTransfer (asi FormData/el resto del codigo que
    // ya lee ese input siguen funcionando igual, sin cambios). El input
    // original sigue sirviendo para "elegir archivo" como siempre.
    setupTomarFoto(fotoInput, tomarFotoButton) {
        if (!fotoInput || !tomarFotoButton) return;

        const camaraInput = document.createElement("input");
        camaraInput.type = "file";
        camaraInput.accept = fotoInput.accept || "image/*";
        camaraInput.capture = "environment";
        camaraInput.hidden = true;
        fotoInput.insertAdjacentElement("afterend", camaraInput);

        camaraInput.addEventListener("change", () => {
            const archivo = camaraInput.files?.[0];
            if (!archivo) return;

            // Con un input "multiple" la foto de la camara se SUMA a las ya
            // elegidas (hasta el maximo por campo) en vez de reemplazarlas.
            const dataTransfer = new DataTransfer();
            if (fotoInput.multiple) {
                Array.from(fotoInput.files || [])
                    .slice(0, window.VehiAmb.adjuntos.MAX_POR_CAMPO - 1)
                    .forEach((file) => dataTransfer.items.add(file));
            }
            dataTransfer.items.add(archivo);
            fotoInput.files = dataTransfer.files;
            fotoInput.dispatchEvent(new Event("change", { bubbles: true }));
            camaraInput.value = "";
        });

        tomarFotoButton.addEventListener("click", () => camaraInput.click());
    }
};

// Varias fotos/adjuntos por campo en los modulos de evidencia (inspeccion,
// entregas, novedades, mantenimientos, comentarios). Mismo limite que
// backend/src/utils/adjuntos.js (MAX_ADJUNTOS_POR_CAMPO) -- el backend lo
// vuelve a validar, esto es solo para avisar antes de enviar.
window.VehiAmb.adjuntos = {
    MAX_POR_CAMPO: 5,

    escape(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    },

    // Lista de adjuntos de un registro: la lista nueva si viene, o el archivo
    // unico de antes (registros guardados antes de permitir varios). Acepta
    // tambien la lista en texto JSON (alguna respuesta del backend devuelve
    // la fila sin parsear, ej. aprobar/rechazar mantenimiento).
    normalizar(lista, urlLegado, nombreLegado) {
        if (typeof lista === "string") {
            try {
                lista = JSON.parse(lista);
            } catch (error) {
                lista = null;
            }
        }
        if (Array.isArray(lista) && lista.length) return lista;
        return urlLegado ? [{ url: urlLegado, nombre: nombreLegado || null }] : [];
    },

    // Un solo adjunto: "Ver foto" (como siempre). Varios: "Foto 1", "Foto 2"...
    renderEnlaces(adjuntos, { etiqueta = "Ver foto", prefijo = "Foto", clase = "record-link" } = {}) {
        if (!adjuntos || !adjuntos.length) return "";
        const enlace = (adjunto, texto) => `<a class="${clase}" href="${this.escape(window.VehiAmb.api.getAssetUrl(adjunto.url))}" target="_blank" rel="noreferrer">${this.escape(texto)}</a>`;
        if (adjuntos.length === 1) return enlace(adjuntos[0], etiqueta);
        return `<span class="adjuntos-enlaces">${adjuntos.map((adjunto, indice) => enlace(adjunto, `${prefijo} ${indice + 1}`)).join("")}</span>`;
    },

    // Junta archivos nuevos con los ya elegidos sin pasarse del maximo.
    combinar(actuales, nuevos) {
        const todos = [...(actuales || []), ...Array.from(nuevos || [])];
        return { archivos: todos.slice(0, this.MAX_POR_CAMPO), descartados: Math.max(0, todos.length - this.MAX_POR_CAMPO) };
    },

    // Para un <input type="file" multiple>: si se eligen mas del maximo deja
    // solo los primeros y devuelve el aviso a mostrar (o "" si no paso nada).
    limitarInput(input) {
        const archivos = Array.from(input?.files || []);
        if (archivos.length <= this.MAX_POR_CAMPO) return "";

        const dataTransfer = new DataTransfer();
        archivos.slice(0, this.MAX_POR_CAMPO).forEach((file) => dataTransfer.items.add(file));
        input.files = dataTransfer.files;
        return `Solo se permiten hasta ${this.MAX_POR_CAMPO} archivos; se dejaron los primeros ${this.MAX_POR_CAMPO}.`;
    },

    // Selector de fotos de un punto de checklist (inspeccion, entregas): lista
    // de las elegidas con "Quitar", y dos botones -- "Tomar foto" abre la
    // camara directo (capture) y "Elegir de la galería" deja elegir varias.
    // Van separados porque en varios Android un input "multiple" ya no
    // ofrece la camara en el selector. prefijo distingue los ids cuando hay
    // mas de un selector en la pagina.
    renderSelector(archivos, { prefijo, aviso = "" }) {
        const max = this.MAX_POR_CAMPO;
        const lista = archivos || [];
        const accept = "image/png,image/jpeg,image/webp";

        return `
            <div class="form-group adjuntos-selector">
                <label>Fotos (opcional, hasta ${max})</label>
                ${lista.length ? `
                    <ul class="adjuntos-seleccionados">
                        ${lista.map((file, indice) => `
                            <li>
                                <span class="adjuntos-seleccionados-nombre">${this.escape(file.name)}</span>
                                <button type="button" class="record-link" data-quitar-foto="${indice}" aria-label="Quitar foto ${indice + 1}">Quitar</button>
                            </li>
                        `).join("")}
                    </ul>
                ` : ""}
                ${lista.length >= max
                    ? `<p class="field-help">Ya adjuntaste ${max} fotos (el máximo).</p>`
                    : `
                        <div class="adjuntos-botones">
                            <button type="button" class="btn-secondary" id="${prefijo}FotoCamaraButton">📷 Tomar foto</button>
                            <button type="button" class="btn-secondary" id="${prefijo}FotoGaleriaButton">Elegir de la galería</button>
                        </div>
                        <input type="file" id="${prefijo}FotoCamaraInput" accept="${accept}" capture="environment" hidden>
                        <input type="file" id="${prefijo}FotoGaleriaInput" accept="${accept}" multiple hidden>
                    `}
                <p class="field-help field-help-danger ${aviso ? "" : "hidden"}" role="status">${this.escape(aviso)}</p>
            </div>
        `;
    },

    // obtener() devuelve los File actuales; guardar(archivos, aviso) los
    // reemplaza y debe volver a pintar el selector.
    setupSelector(contenedor, { prefijo, obtener, guardar }) {
        const agregar = (nuevos) => {
            if (!nuevos?.length) return;
            const { archivos, descartados } = this.combinar(obtener(), nuevos);
            guardar(archivos, descartados
                ? `Solo se permiten ${this.MAX_POR_CAMPO} fotos; ${descartados === 1 ? "una no se agregó" : `${descartados} no se agregaron`}.`
                : "");
        };

        const camaraInput = document.getElementById(`${prefijo}FotoCamaraInput`);
        const galeriaInput = document.getElementById(`${prefijo}FotoGaleriaInput`);
        document.getElementById(`${prefijo}FotoCamaraButton`)?.addEventListener("click", () => camaraInput?.click());
        document.getElementById(`${prefijo}FotoGaleriaButton`)?.addEventListener("click", () => galeriaInput?.click());
        camaraInput?.addEventListener("change", () => agregar(camaraInput.files));
        galeriaInput?.addEventListener("change", () => agregar(galeriaInput.files));

        contenedor.querySelectorAll("[data-quitar-foto]").forEach((btn) => {
            btn.addEventListener("click", () => {
                const indiceQuitar = Number(btn.dataset.quitarFoto);
                guardar(obtener().filter((_, indice) => indice !== indiceQuitar), "");
            });
        });
    },

    // Engancha limitarInput al "change" de un input y muestra el aviso en
    // avisoEl (un .field-help) cuando corresponde.
    setupInputMultiple(input, avisoEl) {
        if (!input) return;
        input.multiple = true;
        input.addEventListener("change", () => {
            const aviso = this.limitarInput(input);
            if (!avisoEl) return;
            avisoEl.textContent = aviso;
            avisoEl.classList.toggle("hidden", !aviso);
        });
    }
};
