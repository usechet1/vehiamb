document.getElementById("fecha-hoy").textContent =
    new Date().toLocaleDateString("es-ES", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
    });

function pintarResumen(vehiculos) {
    document.getElementById("total-vehiculos").textContent = vehiculos.length;
    document.getElementById("total-conductores").textContent = "12";
    document.getElementById("total-mantenimientos").textContent = "5";
    document.getElementById("total-rutas").textContent = "8";
}

function pintarVehiculos(vehiculos) {
    const tabla = document.getElementById("tabla-vehiculos");
    const ultimos = vehiculos.slice(-4).reverse();

    if (!ultimos.length) {
        tabla.innerHTML = '<tr><td colspan="4" class="dash-empty">Sin vehículos registrados</td></tr>';
        return;
    }

    tabla.innerHTML = ultimos.map((vehiculo) => `
        <tr>
            <td><code>${vehiculo.placa || "Sin placa"}</code></td>
            <td>${vehiculo.marca || "Sin marca"}</td>
            <td>${vehiculo.modelo || "Sin modelo"}</td>
            <td><span class="badge badge-verde">Activo</span></td>
        </tr>
    `).join("");
}

function pintarMantenimientos() {
    const datos = [
        { placa: "ABC-123", tipo: "Cambio de aceite", fecha: "2026-07-10" },
        { placa: "DEF-789", tipo: "Revisión de frenos", fecha: "2026-07-15" },
        { placa: "GHI-012", tipo: "Alineación", fecha: "2026-07-20" }
    ];

    document.getElementById("lista-mantenimientos").innerHTML = datos.map((mantenimiento) => `
        <li class="dash-list-item">
            <div>
                <strong>${mantenimiento.tipo}</strong>
                <span class="dash-sub">Placa: ${mantenimiento.placa}</span>
            </div>
            <span class="dash-fecha-tag">
                ${new Date(mantenimiento.fecha).toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}
            </span>
        </li>
    `).join("");
}

async function inicializarDashboard() {
    try {
        const vehiculos = await window.VehiAmb.api.getVehiculos();
        pintarResumen(vehiculos);
        pintarVehiculos(vehiculos);
    } catch (error) {
        console.error(error);
        pintarResumen([]);
        document.getElementById("tabla-vehiculos").innerHTML =
            '<tr><td colspan="4" class="dash-empty">No fue posible cargar los vehículos</td></tr>';
    }

    pintarMantenimientos();
}

document.addEventListener("DOMContentLoaded", inicializarDashboard);
