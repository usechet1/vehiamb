const EMAIL_DOMAIN = "@vehiamb.com";

function buildEmail(rawValue) {
    const value = String(rawValue || "").trim().toLowerCase();
    if (!value) return "";
    return value.includes("@") ? value : `${value}${EMAIL_DOMAIN}`;
}

const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");
const loginPassword = document.getElementById("loginPassword");
const togglePasswordButton = document.getElementById("togglePasswordButton");
const iconEye = togglePasswordButton.querySelector(".icon-eye");
const iconEyeOff = togglePasswordButton.querySelector(".icon-eye-off");

togglePasswordButton.addEventListener("click", () => {
    const isVisible = loginPassword.type === "text";

    loginPassword.type = isVisible ? "password" : "text";
    togglePasswordButton.setAttribute("aria-label", isVisible ? "Mostrar contraseña" : "Ocultar contraseña");
    togglePasswordButton.setAttribute("aria-pressed", String(!isVisible));
    iconEye.classList.toggle("hidden", !isVisible);
    iconEyeOff.classList.toggle("hidden", isVisible);
});

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(loginForm);
    const email = buildEmail(formData.get("email"));
    const password = String(formData.get("password") || "");

    try {
        await window.VehiAmb.auth.login(email, password);
        sessionStorage.setItem("vehiamb.showWelcome", "1");
        window.location.href = "index.html";
    } catch (error) {
        window.VehiAmb.ui.showMessage(loginMessage, error.message || "No fue posible iniciar sesión", "error");
    }
});
