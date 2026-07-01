const form = document.getElementById("vehiculoForm");
const loader = document.getElementById("loader");
const mensaje = document.getElementById("mensaje");
const preview = document.getElementById("preview");
const imageInput = document.getElementById("imagen");
const imageDropzone = document.getElementById("imageDropzone");
const dropzonePlaceholder = document.getElementById("dropzonePlaceholder");
const inputAnio = document.getElementById("input-anio");
const inputPlaca = document.getElementById("input-placa");
const pageTitle = document.getElementById("pageTitle");
const pageSubtitle = document.getElementById("pageSubtitle");
const formStep = document.getElementById("formStep");
const submitButton = document.getElementById("submitButton");

const vehicleId = new URLSearchParams(window.location.search).get("id");
const isEditMode = Boolean(vehicleId);

const ANIO_MIN = 1900;
const ANIO_REGEX = /^\d{4}$/;

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

if (inputAnio) {
    inputAnio.max = String(new Date().getFullYear() + 1);
    inputAnio.addEventListener("input", validarAnioField);
    inputAnio.addEventListener("blur", validarAnioField);
}

async function cargarVehiculoParaEditar() {
    document.title = "Editar Vehiculo - VehiAmb";
    pageTitle.textContent = "Editar vehiculo";
    pageSubtitle.textContent = "Actualiza la ficha tecnica del vehiculo";
    formStep.textContent = "Editar ficha tecnica";
    submitButton.textContent = "Guardar cambios";

    try {
        window.VehiAmb.ui.show(loader);
        const vehiculo = await window.VehiAmb.api.getVehiculo(vehicleId);

        Object.keys(vehiculo).forEach((field) => {
            const input = form.elements.namedItem(field);
            if (!input || vehiculo[field] === null || vehiculo[field] === undefined) return;
            input.value = vehiculo[field];
        });

        if (vehiculo.imagen_url) {
            preview.src = window.VehiAmb.api.getAssetUrl(vehiculo.imagen_url);
            window.VehiAmb.ui.show(preview);
            window.VehiAmb.ui.hide(dropzonePlaceholder);
        }
    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(mensaje, "No fue posible cargar el vehiculo a editar", "error");
    } finally {
        window.VehiAmb.ui.hide(loader);
    }
}

if (isEditMode) {
    cargarVehiculoParaEditar();
}

inputPlaca?.addEventListener("input", () => {
    const { selectionStart, selectionEnd } = inputPlaca;
    inputPlaca.value = inputPlaca.value.toUpperCase();
    inputPlaca.setSelectionRange(selectionStart, selectionEnd);
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

    validarAnioField();
    if (inputAnio && !inputAnio.checkValidity()) {
        inputAnio.reportValidity();
        window.VehiAmb.ui.showMessage(mensaje, inputAnio.validationMessage, "error");
        return;
    }

    const formData = new FormData(form);

    try {
        window.VehiAmb.ui.show(loader);

        if (isEditMode) {
            await window.VehiAmb.api.updateVehiculo(vehicleId, formData);
            window.VehiAmb.ui.showMessage(mensaje, "Vehiculo actualizado correctamente");
            window.setTimeout(() => {
                window.location.href = `vehiculo.html?id=${vehicleId}`;
            }, 900);
            return;
        }

        await window.VehiAmb.api.createVehiculo(formData);
        window.VehiAmb.ui.showMessage(mensaje, "Vehiculo guardado correctamente");
        form.reset();
        updateImagePreview();
    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(mensaje, error.message || "Error al guardar el vehiculo", "error");
    } finally {
        window.VehiAmb.ui.hide(loader);
    }
});
