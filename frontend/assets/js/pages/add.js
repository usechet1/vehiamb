const form = document.getElementById("vehiculoForm");
const loader = document.getElementById("loader");
const mensaje = document.getElementById("mensaje");
const preview = document.getElementById("preview");
const imageInput = document.getElementById("imagen");
const imageDropzone = document.getElementById("imageDropzone");
const dropzonePlaceholder = document.getElementById("dropzonePlaceholder");
const inputAnio = document.getElementById("input-anio");
const inputPlaca = document.getElementById("input-placa");
const camposNumericosFormateados = ["input-kilometraje", "input-cilindraje", "input-capacidad-carga"]
    .map((id) => document.getElementById(id))
    .filter(Boolean);
const pageTitle = document.getElementById("pageTitle");
const pageSubtitle = document.getElementById("pageSubtitle");
const formStep = document.getElementById("formStep");
const submitButton = document.getElementById("submitButton");
const cancelButton = document.getElementById("cancelButton");

const vehicleId = new URLSearchParams(window.location.search).get("id");
const isEditMode = Boolean(vehicleId);

const ANIO_MIN = 1950;
const ANIO_REGEX = /^\d{4}$/;

const selectTipoVehiculo = document.getElementById("select-tipo-vehiculo");

// Formato colombiano estandar: 3 letras + 3 numeros (AAA123). Las motos usan
// un formato distinto (3 letras + 2 numeros + 1 letra, ej. AAA12B), asi que
// se valida contra uno u otro segun el tipo de vehiculo elegido.
const PLACA_REGEX_ESTANDAR = /^[A-Z]{3}[0-9]{3}$/;
const PLACA_REGEX_MOTO = /^[A-Z]{3}[0-9]{2}[A-Z]$/;

function validarPlacaField() {
    if (!inputPlaca) return;

    const raw = inputPlaca.value.trim().toUpperCase();
    if (!raw) {
        inputPlaca.setCustomValidity("La placa es obligatoria.");
        return;
    }

    const esMoto = selectTipoVehiculo?.value === "Motocicleta";
    const valida = esMoto ? PLACA_REGEX_MOTO.test(raw) : PLACA_REGEX_ESTANDAR.test(raw);

    inputPlaca.setCustomValidity(
        valida ? "" : esMoto
            ? "La placa de moto debe tener el formato AAA12B (3 letras, 2 números, 1 letra)."
            : "La placa debe tener el formato AAA123 (3 letras y 3 números)."
    );
}

function validarAnioField() {
    if (!inputAnio) return;

    const raw = inputAnio.value.trim();
    const anioMax = new Date().getFullYear() + 1;

    if (!raw) {
        inputAnio.setCustomValidity("El campo Año es obligatorio.");
        return;
    }

    if (!ANIO_REGEX.test(raw)) {
        inputAnio.setCustomValidity("Ingrese un año válido de cuatro dígitos.");
        return;
    }

    const anio = Number(raw);
    if (anio < ANIO_MIN || anio > anioMax) {
        inputAnio.setCustomValidity(`El año debe estar entre ${ANIO_MIN} y ${anioMax}.`);
        return;
    }

    inputAnio.setCustomValidity("");
}

function sanearAnioEnVivo(input) {
    const posicionDesdeElFinal = input.value.length - input.selectionStart;

    let raw = input.value.replace(/\D/g, "").slice(0, 4);
    raw = raw.replace(/^0+/, "");

    input.value = raw;

    const nuevaPosicion = Math.max(0, input.value.length - posicionDesdeElFinal);
    input.setSelectionRange(nuevaPosicion, nuevaPosicion);
}

if (inputAnio) {
    inputAnio.addEventListener("input", () => {
        sanearAnioEnVivo(inputAnio);
        validarAnioField();
    });
    inputAnio.addEventListener("blur", validarAnioField);
}

async function cargarVehiculoParaEditar() {
    document.title = "Editar Vehículo - VehiAmb";
    pageTitle.textContent = "Editar vehículo";
    pageSubtitle.textContent = "Actualiza la ficha técnica del vehículo";
    formStep.textContent = "Editar ficha técnica";
    submitButton.textContent = "Guardar cambios";
    if (cancelButton) cancelButton.href = `vehiculo.html?id=${vehicleId}`;

    try {
        window.VehiAmb.ui.show(loader);
        const vehiculo = await window.VehiAmb.api.getVehiculo(vehicleId);

        Object.keys(vehiculo).forEach((field) => {
            const input = form.elements.namedItem(field);
            if (!input || vehiculo[field] === null || vehiculo[field] === undefined) return;
            input.value = vehiculo[field];
        });

        camposNumericosFormateados.forEach((input) => {
            input.value = formatearNumeroParaMostrar(input.value);
        });

        if (vehiculo.imagen_url) {
            preview.src = window.VehiAmb.api.getAssetUrl(vehiculo.imagen_url);
            window.VehiAmb.ui.show(preview);
            window.VehiAmb.ui.hide(dropzonePlaceholder);
        }
    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(mensaje, "No fue posible cargar el vehículo a editar", "error");
    } finally {
        window.VehiAmb.ui.hide(loader);
    }
}

const CODIGO_INTERNO_PREFIJO = "AC-";
const inputCodigoInterno = document.getElementById("input-codigo-interno");

async function generarCodigoInternoAutomatico() {
    if (!inputCodigoInterno) return;

    try {
        const vehiculos = await window.VehiAmb.api.getVehiculosCatalogo();
        const regexCodigo = new RegExp(`^${CODIGO_INTERNO_PREFIJO}(\\d+)$`, "i");

        const maxNumero = (vehiculos || []).reduce((max, vehiculo) => {
            const match = regexCodigo.exec(String(vehiculo.codigo_interno || "").trim());
            if (!match) return max;
            return Math.max(max, Number(match[1]));
        }, 0);

        inputCodigoInterno.value = `${CODIGO_INTERNO_PREFIJO}${String(maxNumero + 1).padStart(4, "0")}`;
    } catch (error) {
        console.error(error);
        inputCodigoInterno.readOnly = false;
        inputCodigoInterno.placeholder = `Ej: ${CODIGO_INTERNO_PREFIJO}0001`;
        window.VehiAmb.ui.showMessage(mensaje, "No fue posible generar el código automático, ingrésalo manualmente", "error");
    }
}

if (isEditMode) {
    cargarVehiculoParaEditar();
} else {
    generarCodigoInternoAutomatico();
}

inputPlaca?.addEventListener("input", () => {
    const { selectionStart, selectionEnd } = inputPlaca;
    inputPlaca.value = inputPlaca.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    inputPlaca.setSelectionRange(selectionStart, selectionEnd);
    validarPlacaField();
});
inputPlaca?.addEventListener("blur", validarPlacaField);
selectTipoVehiculo?.addEventListener("change", validarPlacaField);

// Kilometraje, cilindraje y capacidad de carga se escriben como texto para
// poder mostrar el separador de miles ("." estilo es-CO) mientras el usuario
// digita -- el valor real (sin puntos, con "." como decimal) se restituye
// justo antes de enviar el formulario, en parseFormattedNumber(). La logica
// vive en window.VehiAmb.ui para reutilizarla en otras paginas.
const formatearNumeroParaMostrar = window.VehiAmb.ui.formatearNumeroParaMostrar;
const parseFormattedNumber = window.VehiAmb.ui.parseFormattedNumber;

camposNumericosFormateados.forEach((input) => {
    input.addEventListener("input", () => window.VehiAmb.ui.formatearNumeroEnVivo(input));
});

function updateImagePreview() {
    const file = imageInput.files?.[0];

    if (!file) {
        preview.removeAttribute("src");
        window.VehiAmb.ui.hide(preview);
        window.VehiAmb.ui.show(dropzonePlaceholder);
        return;
    }

    preview.src = URL.createObjectURL(file);
    window.VehiAmb.ui.show(preview);
    window.VehiAmb.ui.hide(dropzonePlaceholder);
}

imageInput?.addEventListener("change", updateImagePreview);

if (imageDropzone && imageInput) {
    ["dragenter", "dragover"].forEach((eventName) => {
        imageDropzone.addEventListener(eventName, (event) => {
            event.preventDefault();
            imageDropzone.classList.add("dropzone-active");
        });
    });

    ["dragleave", "drop"].forEach((eventName) => {
        imageDropzone.addEventListener(eventName, (event) => {
            event.preventDefault();
            imageDropzone.classList.remove("dropzone-active");
        });
    });

    imageDropzone.addEventListener("drop", (event) => {
        const file = event.dataTransfer?.files?.[0];
        if (!file || !file.type.startsWith("image/")) return;

        imageInput.files = event.dataTransfer.files;
        imageInput.dispatchEvent(new Event("change"));
    });
}

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    // No se usa reportValidity() (el globo nativo del navegador): en moviles
    // aparece de forma inconsistente -- a veces no se ve, a veces queda
    // tapado por el teclado virtual -- asi que el aviso visible es solo el
    // toast (.mensaje), reforzado con foco + scroll al campo con el error.
    validarAnioField();
    if (inputAnio && !inputAnio.checkValidity()) {
        inputAnio.focus();
        inputAnio.scrollIntoView({ behavior: "smooth", block: "center" });
        window.VehiAmb.ui.showMessage(mensaje, inputAnio.validationMessage, "error");
        return;
    }

    validarPlacaField();
    if (inputPlaca && !inputPlaca.checkValidity()) {
        inputPlaca.focus();
        inputPlaca.scrollIntoView({ behavior: "smooth", block: "center" });
        window.VehiAmb.ui.showMessage(mensaje, inputPlaca.validationMessage, "error");
        return;
    }

    const formData = new FormData(form);
    camposNumericosFormateados.forEach((input) => {
        formData.set(input.name, parseFormattedNumber(input.value));
    });

    try {
        window.VehiAmb.ui.show(loader);

        if (isEditMode) {
            await window.VehiAmb.api.updateVehiculo(vehicleId, formData);
            window.VehiAmb.ui.showMessage(mensaje, "Vehículo actualizado correctamente");
            window.setTimeout(() => {
                window.location.href = `vehiculo.html?id=${vehicleId}`;
            }, 900);
            return;
        }

        await window.VehiAmb.api.createVehiculo(formData);
        window.VehiAmb.ui.showMessage(mensaje, "Vehículo guardado correctamente");
        form.reset();
        updateImagePreview();
        generarCodigoInternoAutomatico();
    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(mensaje, error.message || "Error al guardar el vehículo", "error");
    } finally {
        window.VehiAmb.ui.hide(loader);
    }
});
