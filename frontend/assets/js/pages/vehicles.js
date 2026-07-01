const container = document.getElementById("vehiculosContainer");
const loader = document.getElementById("loader");

function formatKm(value) {
    const number = Number(value || 0);
    return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 }).format(number);
}

async function cargarVehiculos() {
    try {
        window.VehiAmb.ui.show(loader);

        const data = await window.VehiAmb.api.getVehiculos();

        container.innerHTML = "";

        if (!data.length) {
            container.innerHTML = '<p class="dash-empty">Sin vehículos registrados</p>';
            return;
        }

        data.forEach((vehiculo) => {
            const card = document.createElement("a");
            card.className = "vehicle-card vehicle-card-link";
            card.href = `vehiculo.html?id=${vehiculo.id}`;

            card.innerHTML = `
                <div class="vehicle-card-top">
                    <span class="plate">${vehiculo.placa || "SIN PLACA"}</span>
                    <span class="badge badge-verde">Activo</span>
                </div>
                <h3>${vehiculo.marca || "Marca"} ${vehiculo.modelo || "Modelo"}</h3>
                <dl class="vehicle-meta">
                    <div>
                        <dt>Código</dt>
                        <dd>${vehiculo.codigo_interno || "--"}</dd>
                    </div>
                    <div>
                        <dt>Kilometraje</dt>
                        <dd>${formatKm(vehiculo.kilometraje_actual)} km</dd>
                    </div>
                </dl>
                <span class="vehicle-card-action">Ver ficha operativa</span>
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
