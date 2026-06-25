window.VehiAmb = window.VehiAmb || {};

window.VehiAmb.API_URL = window.VehiAmb.API_URL || (
    window.location.port === "8080"
        ? "/api"
        : "http://localhost:3000/api"
);

window.VehiAmb.ASSET_BASE_URL = window.VehiAmb.ASSET_BASE_URL || (
    window.location.port === "8080"
        ? ""
        : "http://localhost:3000"
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

    if (!response.ok) {
        throw new Error(errorMessage);
    }

    return response.json();
}

window.VehiAmb.api = {
    getAssetUrl(path) {
        if (!path) return "";
        if (path.startsWith("http://") || path.startsWith("https://")) return path;
        return `${window.VehiAmb.ASSET_BASE_URL}${path}`;
    },

    getVehiculos() {
        return requestJson(`${window.VehiAmb.API_URL}/vehiculos`, undefined, "No se pudieron cargar los vehiculos");
    },

    getVehiculo(id) {
        return requestJson(`${window.VehiAmb.API_URL}/vehiculos/${id}`, undefined, "No se pudo cargar el vehiculo");
    },

    createVehiculo(payload) {
        return requestJson(
            `${window.VehiAmb.API_URL}/vehiculos`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            },
            "No se pudo guardar el vehiculo"
        );
    },

    getMantenimientos() {
        return requestJson(`${window.VehiAmb.API_URL}/mantenimientos`, undefined, "No se pudieron cargar los mantenimientos");
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
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            },
            "No se pudo guardar el documento"
        );
    }
};
