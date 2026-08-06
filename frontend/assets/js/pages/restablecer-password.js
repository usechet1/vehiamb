const restablecerPasswordForm = document.getElementById("restablecerPasswordForm");
const restablecerPasswordMessage = document.getElementById("restablecerPasswordMessage");
const restablecerPasswordNueva = document.getElementById("restablecerPasswordNueva");
const restablecerPasswordConfirmar = document.getElementById("restablecerPasswordConfirmar");

const token = new URLSearchParams(window.location.search).get("token");

if (!token) {
    restablecerPasswordForm.classList.add("hidden");
    window.VehiAmb.ui.showMessage(restablecerPasswordMessage, "Este enlace no es válido. Solicita uno nuevo desde \"¿Olvidaste tu contraseña?\".", "error");
}

restablecerPasswordForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (restablecerPasswordNueva.value !== restablecerPasswordConfirmar.value) {
        window.VehiAmb.ui.showMessage(restablecerPasswordMessage, "Las contraseñas no coinciden", "error");
        return;
    }

    try {
        await window.VehiAmb.api.restablecerPassword(token, restablecerPasswordNueva.value);
        restablecerPasswordForm.classList.add("hidden");
        window.VehiAmb.ui.showMessage(restablecerPasswordMessage, "Contraseña actualizada. Ya puedes iniciar sesión con tu nueva contraseña.", "success");
        setTimeout(() => window.location.href = "login.html", 2500);
    } catch (error) {
        window.VehiAmb.ui.showMessage(restablecerPasswordMessage, error.message || "No fue posible restablecer la contraseña", "error");
    }
});
