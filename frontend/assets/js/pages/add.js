const form = document.getElementById("vehiculoForm");
const loader = document.getElementById("loader");
const mensaje = document.getElementById("mensaje");
const preview = document.getElementById("preview");
const imageInput = document.getElementById("imagen");

imageInput?.addEventListener("change", () => {
    const file = imageInput.files?.[0];

    if (!file) {
        preview.removeAttribute("src");
        window.VehiAmb.ui.hide(preview);
        return;
    }

    preview.src = URL.createObjectURL(file);
    window.VehiAmb.ui.show(preview);
});

form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const formData = new FormData(form);

    const nuevoVehiculo = {
        codigo_interno: formData.get("codigo_interno"),
        marca: formData.get("marca"),
        modelo: formData.get("modelo"),
        placa: formData.get("placa"),
        kilometraje_actual: formData.get("kilometraje_actual"),
        anio: null,
        color: null,
        combustible: null,
        cilindraje: null,
        capacidad_carga: null
    };

    try {
        window.VehiAmb.ui.show(loader);
        await window.VehiAmb.api.createVehiculo(nuevoVehiculo);
        window.VehiAmb.ui.showMessage(mensaje, "Vehículo guardado correctamente");
        form.reset();
        window.VehiAmb.ui.hide(preview);

    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(mensaje, "Error al guardar el vehículo", "error");
    } finally {
        window.VehiAmb.ui.hide(loader);
    }
});
