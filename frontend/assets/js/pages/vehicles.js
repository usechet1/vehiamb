const container = document.getElementById("vehiculosContainer");
const loader = document.getElementById("loader");

async function cargarVehiculos() {
    try {
        window.VehiAmb.ui.show(loader);

        const data = await window.VehiAmb.api.getVehiculos();

        container.innerHTML = "";

        if (!data.length) {
            container.innerHTML = '<p class="dash-empty">Sin vehículos registrados</p>';
            return;
        }

        data.forEach(vehiculo => {
            const card = document.createElement("div");
            card.className = "vehicle-card";

            card.innerHTML = `
                <h3>${vehiculo.marca} ${vehiculo.modelo}</h3>
                <p><strong>Placa:</strong> ${vehiculo.placa}</p>
                <p><strong>Kilometraje:</strong> ${vehiculo.kilometraje_actual} km</p>
            `;

            container.appendChild(card);
        });
    } catch (error) {
        console.error("Error cargando vehículos:", error);
        container.innerHTML = '<p class="dash-empty">No fue posible cargar los vehículos</p>';
    } finally {
        window.VehiAmb.ui.hide(loader);
    }
}

document.addEventListener("DOMContentLoaded", cargarVehiculos);
