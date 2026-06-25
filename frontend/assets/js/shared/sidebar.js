function getInitials(name) {
    return String(name || "VA")
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() || "")
        .join("");
}

async function cargarSidebar() {
    const user = await window.VehiAmb.auth.fetchCurrentUser();
    if (!user) return;

    const res = await fetch("components/sidebar.html");
    const html = await res.text();

    const aside = document.getElementById("sidebar");
    if (!aside) return;

    aside.innerHTML = html;

    const nameEl = aside.querySelector("#sidebarUserName");
    const roleEl = aside.querySelector("#sidebarUserRole");
    const avatarEl = aside.querySelector("#sidebarAvatar");
    const logoutButton = aside.querySelector("#logoutButton");

    if (nameEl) nameEl.textContent = user.nombre;
    if (roleEl) roleEl.textContent = user.rol || "Usuario";
    if (avatarEl) avatarEl.textContent = getInitials(user.nombre);

    logoutButton?.addEventListener("click", () => {
        window.VehiAmb.auth.logout();
    });

    const paginaActual = window.location.pathname.split("/").pop() || "index.html";
    aside.querySelectorAll("button[data-page]").forEach((btn) => {
        if (btn.dataset.page === paginaActual) {
            btn.classList.add("active");
        }

        btn.addEventListener("click", () => {
            if (btn.disabled) return;
            window.location.href = btn.dataset.page;
        });
    });
}

cargarSidebar();
