function getInitials(name) {
    return String(name || "VA")
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() || "")
        .join("");
}

function findNextButton(element) {
    let next = element.nextElementSibling;

    while (next) {
        if (next.matches("button[data-page]")) return next;
        if (next.matches(".nav-divider, .nav-label")) return null;
        next = next.nextElementSibling;
    }

    return null;
}

function removeEmptyMenuGroups(aside) {
    aside.querySelectorAll(".sidebar-menu").forEach((menu) => {
        menu.querySelectorAll(".nav-divider, .nav-label").forEach((marker) => {
            if (!findNextButton(marker)) {
                marker.remove();
            }
        });
    });
}

async function cargarSidebar() {
    const aside = document.getElementById("sidebar");
    if (!aside) return;

    try {
        const res = await fetch(`components/sidebar.html?v=${Date.now()}`, {
            cache: "no-store"
        });
        if (!res.ok) {
            throw new Error("No se pudo cargar el sidebar");
        }

        aside.innerHTML = await res.text();
    } catch (error) {
        console.error(error);
        aside.innerHTML = `
            <nav class="sidebar-menu">
                <button data-page="index.html" data-permission="dashboard.view">Inicio</button>
                <button data-page="add.html" data-permission="vehicles.create">Anadir vehiculo</button>
                <button data-page="dashboard.html" data-permission="vehicles.view">Ver vehiculos</button>
                <button data-page="mantenimientos.html" data-permission="maintenance.view">Mantenimientos</button>
                <button data-page="documentos.html" data-permission="documents.view">Documentos</button>
                <button data-page="simit.html" data-permission="simit.view">Consulta SIMIT</button>
                <button data-page="admin-usuarios.html" data-permission="users.manage">Usuarios</button>
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

    try {
        const user = await window.VehiAmb.auth.fetchCurrentUser();
        if (!user) return;

        if (nameEl) nameEl.textContent = user.nombre;
        if (roleEl) roleEl.textContent = user.rol || "Usuario";
        if (avatarEl) avatarEl.textContent = getInitials(user.nombre);

        aside.querySelectorAll("button[data-permission]").forEach((btn) => {
            if (!window.VehiAmb.auth.hasPermission(btn.dataset.permission)) {
                btn.remove();
            }
        });

        removeEmptyMenuGroups(aside);
    } catch (error) {
        console.error("No fue posible cargar el usuario del sidebar:", error);
    }

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
