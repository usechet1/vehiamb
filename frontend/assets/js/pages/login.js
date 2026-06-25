const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(loginForm);
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");

    try {
        await window.VehiAmb.auth.login(email, password);
        window.location.href = "index.html";
    } catch (error) {
        window.VehiAmb.ui.showMessage(loginMessage, error.message || "No fue posible iniciar sesion", "error");
    }
});
