function getInitials(name) {
    return String(name || "VA")
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() || "")
        .join("");
}

async function cargarSidebar() {
    const aside = document.getElementById("sidebar");
    if (!aside) return;

    try {
        const res = await fetch("components/sidebar.html");
        if (!res.ok) {
            throw new Error("No se pudo cargar el sidebar");
        }

        aside.innerHTML = await res.text();
    } catch (error) {
        console.error(error);
        aside.innerHTML = `
            <nav class="sidebar-menu">
                <button data-page="index.html">Inicio</button>
                <button data-page="add.html">Añadir vehículo</button>
                <button data-page="dashboard.html">Ver vehículos</button>
                <button data-page="mantenimientos.html">Mantenimientos</button>
                <button data-page="documentos.html">Documentos</button>
                <button data-page="simit.html">Consulta SIMIT</button>
            </nav>
        `;
    }

    const nameEl = aside.querySelector("#sidebarUserName");
    const roleEl = aside.querySelector("#sidebarUserRole");
    const avatarEl = aside.querySelector("#userAvatar");
    const logoutButton = aside.querySelector("#logoutButton");

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

    try {
        const user = await window.VehiAmb.auth.fetchCurrentUser();
        if (!user) return;

        if (nameEl) nameEl.textContent = user.nombre;
        if (roleEl) roleEl.textContent = user.rol || "Usuario";
        if (avatarEl) avatarEl.textContent = getInitials(user.nombre);
    } catch (error) {
        console.error("No fue posible cargar el usuario del sidebar:", error);
    }
}

cargarSidebar();
