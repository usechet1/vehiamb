window.VehiAmb = window.VehiAmb || {};

window.VehiAmb.API_URL = window.location.port === "8080"
    ? "/api"
    : "http://localhost:3000/api";

window.VehiAmb.api = {
    async getVehiculos() {
        const response = await fetch(`${window.VehiAmb.API_URL}/vehiculos`);

        if (!response.ok) {
            throw new Error("No se pudieron cargar los vehículos");
        }

        return response.json();
    },

    async createVehiculo(payload) {
        const response = await fetch(`${window.VehiAmb.API_URL}/vehiculos`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error("No se pudo guardar el vehículo");
        }

        return response.json();
    }
};
