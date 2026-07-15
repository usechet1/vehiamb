const loader = document.getElementById("loader");
const mensaje = document.getElementById("mensaje");
const empresaForm = document.getElementById("empresaForm");
const empresaNombre = document.getElementById("empresaNombre");
const empresaLogo = document.getElementById("empresaLogo");
const empresaLogoPreview = document.getElementById("empresaLogoPreview");
const empresaLogoPlaceholder = document.getElementById("empresaLogoPlaceholder");

function mostrarLogo(logoUrl) {
    if (logoUrl) {
        empresaLogoPreview.src = window.VehiAmb.api.getAssetUrl(logoUrl);
        window.VehiAmb.ui.show(empresaLogoPreview);
        window.VehiAmb.ui.hide(empresaLogoPlaceholder);
    } else {
        window.VehiAmb.ui.hide(empresaLogoPreview);
        window.VehiAmb.ui.show(empresaLogoPlaceholder);
    }
}

async function cargarEmpresa() {
    window.VehiAmb.ui.show(loader);
    try {
        const empresa = await window.VehiAmb.api.getMiEmpresa();
        empresaNombre.value = empresa.nombre || "";
        mostrarLogo(empresa.logo_url);
    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudo cargar la empresa", "error");
    } finally {
        window.VehiAmb.ui.hide(loader);
    }
}

empresaLogo.addEventListener("change", () => {
    const file = empresaLogo.files?.[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    empresaLogoPreview.src = previewUrl;
    window.VehiAmb.ui.show(empresaLogoPreview);
    window.VehiAmb.ui.hide(empresaLogoPlaceholder);
});

empresaForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    window.VehiAmb.ui.show(loader);

    try {
        const formData = new FormData();
        formData.append("nombre", empresaNombre.value.trim());
        if (empresaLogo.files?.[0]) {
            formData.append("logo", empresaLogo.files[0]);
        }

        const empresa = await window.VehiAmb.api.updateMiEmpresa(formData);
        empresaNombre.value = empresa.nombre || "";
        mostrarLogo(empresa.logo_url);
        empresaLogo.value = "";
        window.VehiAmb.ui.showMessage(mensaje, "Empresa actualizada correctamente");
    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudo actualizar la empresa", "error");
    } finally {
        window.VehiAmb.ui.hide(loader);
    }
});

cargarEmpresa();
