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
        kilometraje_actual: formData.get("kilometraje_actual")
    };

    try {
        window.VehiAmb.ui.show(loader);
        await window.VehiAmb.api.createVehiculo(nuevoVehiculo);
        window.VehiAmb.ui.showMessage(mensaje, "Vehiculo guardado correctamente");
        form.reset();
        preview.removeAttribute("src");
        window.VehiAmb.ui.hide(preview);
    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(mensaje, error.message || "Error al guardar el vehiculo", "error");
    } finally {
        window.VehiAmb.ui.hide(loader);
    }
});
