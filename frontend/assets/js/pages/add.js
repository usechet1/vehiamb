const form = document.getElementById("vehiculoForm");
const loader = document.getElementById("loader");
const mensaje = document.getElementById("mensaje");
const preview = document.getElementById("preview");
const imageInput = document.getElementById("imagen");
const imageDropzone = document.getElementById("imageDropzone");
const dropzonePlaceholder = document.getElementById("dropzonePlaceholder");
const inputAnio = document.getElementById("input-anio");
const inputPlaca = document.getElementById("input-placa");

if (inputAnio) {
    inputAnio.max = String(new Date().getFullYear() + 1);
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

    const formData = new FormData(form);

    const nuevoVehiculo = {
        codigo_interno: formData.get("codigo_interno"),
        marca: formData.get("marca"),
        modelo: formData.get("modelo"),
        anio: formData.get("anio"),
        color: formData.get("color"),
        combustible: formData.get("combustible"),
        cilindraje: formData.get("cilindraje"),
        capacidad_carga: formData.get("capacidad_carga"),
        placa: formData.get("placa"),
        kilometraje_actual: formData.get("kilometraje_actual"),
        tipo_vehiculo: formData.get("tipo_vehiculo"),
        tipo_carroceria: formData.get("tipo_carroceria"),
        numero_chasis: formData.get("numero_chasis"),
        numero_motor: formData.get("numero_motor")
    };

    try {
        window.VehiAmb.ui.show(loader);
        await window.VehiAmb.api.createVehiculo(nuevoVehiculo);
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
