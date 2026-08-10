window.VehiAmb = window.VehiAmb || {};
window.VehiAmb.API_URL = window.VehiAmb.API_URL || "/api";

const LOGIN_PAGE = "login.html";
// Paginas sin sesion (link "olvide mi contrasena" y el enlace del correo de
// recuperacion) -- no exigen token, a diferencia de cualquier otra pagina.
const PUBLIC_PAGES = ["olvide-password.html", "restablecer-password.html"];
// Pantalla de cambio de contrasena obligatorio (primera vez que entra con
// una contrasena que puso un Administrador). Si exige sesion, pero es la
// unica pagina a la que puede llegar mientras debe_cambiar_password sea true.
const FORCE_CHANGE_PASSWORD_PAGE = "cambiar-password.html";
const AUTH_STORAGE_KEY = "vehiamb.auth";
const PAGE_PERMISSIONS = {
    "index.html": "dashboard.view",
    "dashboard.html": "vehicles.view",
    "vehiculo.html": "vehicles.view",
    // add.html sirve dos casos con permisos distintos (crear un vehiculo
    // nuevo vs. editar uno existente, segun traiga o no "?id=" en la URL) --
    // el backend ya los distingue (POST pide vehicles.create, PUT pide
    // vehicles.edit, ver vehiculos.routes.js), asi que el guardia de la
    // pagina tiene que hacer lo mismo o un rol con permiso de editar pero no
    // de crear (ej. Operador) quedaria bloqueado de entrar a editar.
    "add.html": () => (
        new URLSearchParams(window.location.search).get("id") ? "vehicles.edit" : "vehicles.create"
    ),
    "mantenimientos.html": "maintenance.view",
    "documentos.html": "documents.view",
    "simit.html": "simit.view",
    "notificaciones.html": "dashboard.view",
    "importaciones.html": "imports.view",
    "costos.html": "costs.view",
    "admin-usuarios.html": "users.manage",
    "stock-importaciones.html": "inventory.import",
    "empresa.html": "empresa.manage",
    "conductores.html": "conductores.view",
    "entrega-recibida.html": "delivery.view",
    "mi-viaje.html": "trips.view",
    "asignaciones.html": "asignaciones.view",
    "seguridad.html": "seguridad.view"
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

    // Solo tiene efecto si el usuario logueado tiene el permiso
    // "empresas.switch" (rol SuperAdministrador) -- el backend valida esto
    // de nuevo en cada request, aqui solo se guarda la seleccion para
    // mandarla como header en las llamadas a la API.
    getEmpresaActivaId() {
        return getStoredSession()?.empresaActivaId || "";
    },

    setEmpresaActivaId(empresaId) {
        const session = getStoredSession();
        if (!session) return;
        setStoredSession({ ...session, empresaActivaId: empresaId });
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

        const headers = { Authorization: `Bearer ${session.token}` };
        if (session.empresaActivaId) {
            headers["X-Empresa-Id"] = session.empresaActivaId;
        }

        let response;
        try {
            response = await fetch(`${window.VehiAmb.API_URL}/auth/me`, {
                cache: "no-store",
                headers
            });
        } catch (error) {
            // Sin conexion: no es que la sesion sea invalida, asi que no se
            // debe forzar logout. Si ya tenemos un usuario guardado de una
            // carga anterior, seguimos con esos datos (pueden estar
            // desactualizados) en vez de tumbar toda la pagina.
            if (session.user) return session.user;
            throw error;
        }

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
        const permissionEntry = PAGE_PERMISSIONS[currentPage];
        const permission = typeof permissionEntry === "function" ? permissionEntry() : permissionEntry;
        const user = await this.fetchCurrentUser();

        if (!user) return null;

        // Contrasena temporal (la puso un Administrador al crear/editar la
        // cuenta): no puede usar el resto de la app hasta que la cambie.
        if (user.debe_cambiar_password && currentPage !== FORCE_CHANGE_PASSWORD_PAGE) {
            window.location.href = FORCE_CHANGE_PASSWORD_PAGE;
            return null;
        }
        if (!user.debe_cambiar_password && currentPage === FORCE_CHANGE_PASSWORD_PAGE) {
            window.location.href = "index.html";
            return null;
        }

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

    if (PUBLIC_PAGES.includes(currentPage)) return;

    if (!getStoredSession()?.token) {
        redirectToLogin();
        return;
    }

    window.VehiAmb.auth.requirePageAccess().catch((error) => {
        console.error("No fue posible validar permisos:", error);
        redirectToLogin();
    });
})();
