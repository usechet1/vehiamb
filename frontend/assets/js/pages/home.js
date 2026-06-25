document.getElementById("fecha-hoy").textContent =
    new Date().toLocaleDateString("es-CO", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
    });

function pintarResumen(vehiculos, mantenimientos = [], documentos = []) {
    document.getElementById("total-vehiculos").textContent = vehiculos.length;
    document.getElementById("total-conductores").textContent = "12";
    document.getElementById("total-mantenimientos").textContent = mantenimientos.length;
    document.getElementById("total-rutas").textContent = documentos.length;
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

function pintarMantenimientos(datos) {
    if (!datos.length) {
        document.getElementById("lista-mantenimientos").innerHTML =
            '<li class="dash-empty">Sin mantenimientos registrados</li>';
        return;
    }

    document.getElementById("lista-mantenimientos").innerHTML = datos.slice(0, 4).map((mantenimiento) => `
        <li class="dash-list-item">
            <div>
                <strong>${mantenimiento.tipo}</strong>
                <span class="dash-sub">Placa: ${mantenimiento.placa}</span>
            </div>
            <span class="dash-fecha-tag">
                ${new Date(mantenimiento.fecha).toLocaleDateString("es-CO", { day: "2-digit", month: "short" })}
            </span>
        </li>
    `).join("");
}

async function inicializarDashboard() {
    try {
        const [vehiculos, mantenimientos, documentos] = await Promise.all([
            window.VehiAmb.api.getVehiculos(),
            window.VehiAmb.api.getMantenimientos(),
            window.VehiAmb.api.getDocumentos()
        ]);

        pintarResumen(vehiculos, mantenimientos, documentos);
        pintarVehiculos(vehiculos);
        pintarMantenimientos(mantenimientos);
    } catch (error) {
        console.error(error);
        pintarResumen([]);
        document.getElementById("tabla-vehiculos").innerHTML =
            '<tr><td colspan="4" class="dash-empty">No fue posible cargar los vehículos</td></tr>';
        pintarMantenimientos([]);
    }
}

document.addEventListener("DOMContentLoaded", inicializarDashboard);
