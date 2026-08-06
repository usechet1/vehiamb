const olvidePasswordForm = document.getElementById("olvidePasswordForm");
const olvidePasswordMessage = document.getElementById("olvidePasswordMessage");

olvidePasswordForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(olvidePasswordForm);
    const submitButton = olvidePasswordForm.querySelector("button[type=submit]");

    submitButton.disabled = true;

    try {
        const { message } = await window.VehiAmb.api.solicitarRecuperacionPassword(formData.get("email"));
        window.VehiAmb.ui.showMessage(olvidePasswordMessage, message || "Si el correo existe, te enviamos un enlace.", "success");
        olvidePasswordForm.reset();
    } catch (error) {
        window.VehiAmb.ui.showMessage(olvidePasswordMessage, error.message || "No fue posible procesar la solicitud", "error");
    } finally {
        submitButton.disabled = false;
    }
});
