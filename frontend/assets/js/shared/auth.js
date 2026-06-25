window.VehiAmb = window.VehiAmb || {};
window.VehiAmb.API_URL = window.VehiAmb.API_URL || (
    window.location.port === "8080"
        ? "/api"
        : "http://localhost:3000/api"
);

const LOGIN_PAGE = "login.html";
const AUTH_STORAGE_KEY = "vehiamb.auth";

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
            headers: {
                Authorization: `Bearer ${session.token}`
            }
        });

        if (response.status === 401) {
            this.logout();
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
            throw new Error("Correo o contrasena invalidos");
        }

        const data = await response.json();
        this.setSession(data);
        return data;
    },

    logout() {
        this.clearSession();
        redirectToLogin();
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
    }
})();
