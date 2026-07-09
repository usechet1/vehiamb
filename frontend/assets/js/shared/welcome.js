(function () {
    if (sessionStorage.getItem("vehiamb.showWelcome") !== "1") return;
    sessionStorage.removeItem("vehiamb.showWelcome");

    document.addEventListener("DOMContentLoaded", () => {
        const overlay = document.getElementById("welcomeCurtain");
        if (!overlay) return;

        const user = window.VehiAmb?.auth?.getUser?.();
        const nameEl = document.getElementById("welcomeCurtainName");
        if (nameEl && user?.nombre) {
            nameEl.textContent = user.nombre;
        }

        overlay.classList.remove("hidden");

        setTimeout(() => {
            overlay.classList.add("curtain-out");
            overlay.addEventListener("animationend", () => overlay.remove(), { once: true });
        }, 1500);
    });
})();
