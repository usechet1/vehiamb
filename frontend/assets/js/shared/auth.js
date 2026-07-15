window.VehiAmb = window.VehiAmb || {};
window.VehiAmb.API_URL = window.VehiAmb.API_URL || "/api";

const LOGIN_PAGE = "login.html";
const AUTH_STORAGE_KEY = "vehiamb.auth";
const PAGE_PERMISSIONS = {
    "index.html": "dashboard.view",
    "dashboard.html": "vehicles.view",
    "vehiculo.html": "vehicles.view",
    "add.html": "vehicles.create",
    "mantenimientos.html": "maintenance.view",
    "documentos.html": "documents.view",
    "simit.html": "simit.view",
    "notificaciones.html": "dashboard.view",
    "importaciones.html": "imports.view",
    "costos.html": "costs.view",
    "admin-usuarios.html": "users.manage",
    "stock-importaciones.html": "inventory.import",
    "empresa.html": "empresa.manage"
};

function getStoredSession() {
    try {
        const raw = localStorage.getItem(AUTH_STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        return null;
    }
}

function setStoredSession(session) {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

function clearStoredSession() {
    localStorage.removeItem(AUTH_STORAGE_KEY);
}

function redirectToLogin() {
    const currentPath = window.location.pathname.split("/").pop() || "index.html";
    if (currentPath === LOGIN_PAGE) return;
    window.location.href = LOGIN_PAGE;
}

function hasPermission(user, permission) {
    if (!permission) return true;
    return Array.isArray(user?.permisos) && user.permisos.includes(permission);
}

// Paginas que un rol no debe poder abrir aunque tenga el permiso de la
// pagina (ej. Conductor tiene "vehicles.view" para el desplegable de
// vehiculos en Inicio y para abrir la ficha de un vehiculo, pero no debe
// poder entrar al listado completo de la flota en dashboard.html). Mismo
// concepto que "paginasOcultasPorRol" en sidebar.js, pero aqui bloquea el
// acceso directo por URL, no solo el boton del menu.
const PAGINAS_BLOQUEADAS_POR_ROL = {
    Conductor: ["dashboard.html"]
};

window.VehiAmb.auth = {
    getSession() {
        return getStoredSession();
    },

    getToken() {
        return getStoredSession()?.token || "";
    },

    getUser() {
        return getStoredSession()?.user || null;
    },

    hasPermission(permission) {
        return hasPermission(this.getUser(), permission);
    },

    getPagePermission(page) {
        return PAGE_PERMISSIONS[page];
    },

    setSession(session) {
        setStoredSession(session);
    },

    clearSession() {
        clearStoredSession();
    },

    async requireSession() {
        const session = getStoredSession();
        if (!session?.token) {
            redirectToLogin();
            return null;
        }

        return session;
    },

    async fetchCurrentUser() {
        const session = await this.requireSession();
        if (!session) return null;

        const response = await fetch(`${window.VehiAmb.API_URL}/auth/me`, {
            cache: "no-store",
            headers: {
                Authorization: `Bearer ${session.token}`
            }
        });

        if (response.status === 401) {
            this.logout();
            return null;
        }

        if (response.status === 403) {
            window.location.href = "index.html";
            return null;
        }

        if (!response.ok) {
            throw new Error("No se pudo validar la sesion");
        }

        const data = await response.json();
        const nextSession = {
            ...session,
            user: data.user
        };
        setStoredSession(nextSession);
        return data.user;
    },

    async login(email, password) {
        const response = await fetch(`${window.VehiAmb.API_URL}/auth/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ email, password })
        });

        if (!response.ok) {
            throw new Error("Correo o contraseña invalidos");
        }

        const data = await response.json();
        this.setSession(data);
        return data;
    },

    logout() {
        this.clearSession();
        redirectToLogin();
    },

    async requirePageAccess() {
        const currentPage = window.location.pathname.split("/").pop() || "index.html";
        const permission = PAGE_PERMISSIONS[currentPage];
        const user = await this.fetchCurrentUser();

        if (!user) return null;

        if (!hasPermission(user, permission)) {
            window.location.href = "index.html";
            return null;
        }

        if (PAGINAS_BLOQUEADAS_POR_ROL[user.rol]?.includes(currentPage)) {
            window.location.href = "index.html";
            return null;
        }

        return user;
    }
};

(function bootstrapAuthGuard() {
    const currentPage = window.location.pathname.split("/").pop() || "index.html";

    if (currentPage === LOGIN_PAGE) {
        const existingSession = getStoredSession();
        if (existingSession?.token) {
            window.location.href = "index.html";
        }
        return;
    }

    if (!getStoredSession()?.token) {
        redirectToLogin();
        return;
    }

    window.VehiAmb.auth.requirePageAccess().catch((error) => {
        console.error("No fue posible validar permisos:", error);
        redirectToLogin();
    });
})();
