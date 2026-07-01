window.VehiAmb = window.VehiAmb || {};

window.VehiAmb.API_URL = window.VehiAmb.API_URL || (
    window.location.port === "8080"
        ? "/api"
        : "http://localhost:3001/api"
);

window.VehiAmb.ASSET_BASE_URL = window.VehiAmb.ASSET_BASE_URL || (
    window.location.port === "8080"
        ? ""
        : "http://localhost:3001"
);

async function requestJson(url, options, errorMessage) {
    const sessionToken = window.VehiAmb.auth?.getToken?.() || "";
    const headers = new Headers(options?.headers || {});

    if (sessionToken) {
        headers.set("Authorization", `Bearer ${sessionToken}`);
    }

    const response = await fetch(url, {
        ...options,
        headers
    });

    if (response.status === 401) {
        window.VehiAmb.auth?.logout?.();
        throw new Error("Sesion expirada");
    }

    if (response.status === 403) {
        throw new Error("No tienes permiso para realizar esta accion");
    }

    if (!response.ok) {
        let serverMessage = "";
        try {
            const data = await response.json();
            serverMessage = data?.message || "";
        } catch (error) {
            serverMessage = "";
        }

        throw new Error(serverMessage || errorMessage);
    }

    return response.json();
}

window.VehiAmb.api = {
    getAssetUrl(path) {
        if (!path) return "";
        if (path.startsWith("http://") || path.startsWith("https://")) return path;
        return `${window.VehiAmb.ASSET_BASE_URL}${path}`;
    },

    getVehiculos(filters = {}) {
        const params = new URLSearchParams();

        if (filters.search) params.set("search", filters.search);
        if (filters.estado) params.set("estado", filters.estado);
        if (filters.tipo) params.set("tipo", filters.tipo);
        if (filters.marca) params.set("marca", filters.marca);
        if (filters.sort) params.set("sort", filters.sort);
        if (filters.page) params.set("page", filters.page);
        if (filters.limit) params.set("limit", filters.limit);

        const query = params.toString();

        return requestJson(
            `${window.VehiAmb.API_URL}/vehiculos${query ? `?${query}` : ""}`,
            undefined,
            "No se pudieron cargar los vehiculos"
        );
    },

    getMarcasVehiculos() {
        return requestJson(`${window.VehiAmb.API_URL}/vehiculos/catalogos/marcas`, undefined, "No se pudieron cargar las marcas");
    },

    getVehiculosCatalogo() {
        return requestJson(`${window.VehiAmb.API_URL}/vehiculos/catalogos/lista`, undefined, "No se pudieron cargar los vehiculos");
    },

    getVehiculo(id) {
        return requestJson(`${window.VehiAmb.API_URL}/vehiculos/${id}`, undefined, "No se pudo cargar el vehiculo");
    },

    createVehiculo(formData) {
        return requestJson(
            `${window.VehiAmb.API_URL}/vehiculos`,
            {
                method: "POST",
                body: formData
            },
            "No se pudo guardar el vehiculo"
        );
    },

    updateVehiculo(id, formData) {
        return requestJson(
            `${window.VehiAmb.API_URL}/vehiculos/${id}`,
            {
                method: "PUT",
                body: formData
            },
            "No se pudo actualizar el vehiculo"
        );
    },

    updateEstadoVehiculo(id, estado) {
        return requestJson(
            `${window.VehiAmb.API_URL}/vehiculos/${id}/estado`,
            {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ estado })
            },
            "No se pudo actualizar el estado del vehiculo"
        );
    },

    getMantenimientos(filters = {}) {
        const params = new URLSearchParams();

        if (filters.tipo) params.set("tipo", filters.tipo);
        if (filters.placa) params.set("placa", filters.placa);
        if (filters.fecha_desde) params.set("fecha_desde", filters.fecha_desde);
        if (filters.fecha_hasta) params.set("fecha_hasta", filters.fecha_hasta);

        const query = params.toString();

        return requestJson(
            `${window.VehiAmb.API_URL}/mantenimientos${query ? `?${query}` : ""}`,
            undefined,
            "No se pudieron cargar los mantenimientos"
        );
    },

    getMantenimientosByVehicle(vehiculoId) {
        return requestJson(
            `${window.VehiAmb.API_URL}/mantenimientos/vehiculo/${vehiculoId}`,
            undefined,
            "No se pudieron cargar los mantenimientos del vehiculo"
        );
    },

    createMantenimiento(payload) {
        return requestJson(
            `${window.VehiAmb.API_URL}/mantenimientos`,
            {
                method: "POST",
                body: payload
            },
            "No se pudo guardar el mantenimiento"
        );
    },

    getDocumentos() {
        return requestJson(`${window.VehiAmb.API_URL}/documentos`, undefined, "No se pudieron cargar los documentos");
    },

    getDocumentosByVehicle(vehiculoId) {
        return requestJson(
            `${window.VehiAmb.API_URL}/documentos/vehiculo/${vehiculoId}`,
            undefined,
            "No se pudieron cargar los documentos del vehiculo"
        );
    },

    createDocumento(payload) {
        return requestJson(
            `${window.VehiAmb.API_URL}/documentos`,
            {
                method: "POST",
                body: payload
            },
            "No se pudo guardar el documento"
        );
    },

    getUsuarios() {
        return requestJson(`${window.VehiAmb.API_URL}/usuarios`, undefined, "No se pudieron cargar los usuarios");
    },

    createUsuario(payload) {
        return requestJson(
            `${window.VehiAmb.API_URL}/usuarios`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            },
            "No se pudo crear el usuario"
        );
    },

    updateUsuario(id, payload) {
        return requestJson(
            `${window.VehiAmb.API_URL}/usuarios/${id}`,
            {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            },
            "No se pudo actualizar el usuario"
        );
    },

    setUsuarioActivo(id, activo) {
        return requestJson(
            `${window.VehiAmb.API_URL}/usuarios/${id}/activo`,
            {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ activo })
            },
            "No se pudo cambiar el estado del usuario"
        );
    },

    getRoles() {
        return requestJson(`${window.VehiAmb.API_URL}/usuarios/catalogos/roles`, undefined, "No se pudieron cargar los roles");
    },

    getPermisos() {
        return requestJson(`${window.VehiAmb.API_URL}/usuarios/catalogos/permisos`, undefined, "No se pudieron cargar los permisos");
    },

    updateRolePermissions(roleId, permissionIds) {
        return requestJson(
            `${window.VehiAmb.API_URL}/usuarios/catalogos/roles/${roleId}/permisos`,
            {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ permission_ids: permissionIds })
            },
            "No se pudieron actualizar los permisos"
        );
    },

    getNotificaciones() {
        return requestJson(`${window.VehiAmb.API_URL}/notificaciones`, undefined, "No se pudieron cargar las notificaciones");
    },

    marcarNotificacionLeida(id) {
        return requestJson(
            `${window.VehiAmb.API_URL}/notificaciones/${id}/leido`,
            { method: "PATCH" },
            "No se pudo marcar la notificacion como leida"
        );
    },

    aprobarNotificacion(id) {
        return requestJson(
            `${window.VehiAmb.API_URL}/notificaciones/${id}/aprobar`,
            { method: "POST" },
            "No se pudo aprobar el mantenimiento"
        );
    },

    rechazarNotificacion(id) {
        return requestJson(
            `${window.VehiAmb.API_URL}/notificaciones/${id}/rechazar`,
            { method: "POST" },
            "No se pudo rechazar el mantenimiento"
        );
    }
};
