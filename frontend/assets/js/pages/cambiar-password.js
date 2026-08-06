const cambiarPasswordForm = document.getElementById("cambiarPasswordForm");
const cambiarPasswordMessage = document.getElementById("cambiarPasswordMessage");
const passwordNueva = document.getElementById("passwordNueva");
const passwordConfirmar = document.getElementById("passwordConfirmar");

cambiarPasswordForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (passwordNueva.value !== passwordConfirmar.value) {
        window.VehiAmb.ui.showMessage(cambiarPasswordMessage, "Las contraseñas no coinciden", "error");
        return;
    }

    const formData = new FormData(cambiarPasswordForm);

    try {
        const { user } = await window.VehiAmb.api.cambiarPassword({
            password_actual: formData.get("password_actual"),
            password_nueva: formData.get("password_nueva")
        });

        // Mantiene el mismo token de sesion, solo refresca los datos del
        // usuario (debe_cambiar_password ya viene en false) para que el
        // guard de auth.js deje de redirigir aqui.
        const session = window.VehiAmb.auth.getSession();
        window.VehiAmb.auth.setSession({ ...session, user });

        window.location.href = "index.html";
    } catch (error) {
        window.VehiAmb.ui.showMessage(cambiarPasswordMessage, error.message || "No fue posible cambiar la contraseña", "error");
    }
});
