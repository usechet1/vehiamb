const SIMIT_URL = "https://www.fcm.org.co/simit/#/estado-cuenta";

const simitForm = document.getElementById("simitForm");
const simitSelect = document.getElementById("vehiculoSimit");
const simitPlate = document.getElementById("simitPlate");
const simitVehicleList = document.getElementById("simitVehicleList");
const copyPlateButton = document.getElementById("copyPlateButton");
const openSimitLink = document.getElementById("openSimitLink");
const loader = document.getElementById("loader");
const mensaje = document.getElementById("mensaje");

let vehiculosState = [];
let currentPlate = "";

function vehicleLabel(vehiculo) {
    return `${vehiculo.placa || "Sin placa"} - ${vehiculo.marca || ""} ${vehiculo.modelo || ""}`.trim();
}

function selectPlate(plate) {
    currentPlate = plate || "";
    simitPlate.textContent = currentPlate || "---";
}

function fillVehicleSelect(vehiculos) {
    simitSelect.innerHTML = '<option value="">Selecciona un vehiculo</option>';

    if (!vehiculos.length) {
        simitSelect.innerHTML = '<option value="">Primero registra un vehiculo</option>';
        return;
    }

    vehiculos.forEach((vehiculo) => {
        const option = document.createElement("option");
        option.value = vehiculo.id;
        option.textContent = vehicleLabel(vehiculo);
        simitSelect.appendChild(option);
    });
}

function renderVehicleList(vehiculos) {
    if (!vehiculos.length) {
        simitVehicleList.innerHTML = '<p class="dash-empty">Aun no hay vehiculos registrados</p>';
        return;
    }

    simitVehicleList.innerHTML = vehiculos.map((vehiculo) => `
        <article class="record-item">
            <div class="record-top">
                <div>
                    <span class="record-title">${vehiculo.placa || "Sin placa"}</span>
                    <span class="record-sub">${vehiculo.marca || ""} ${vehiculo.modelo || ""}</span>
                </div>
                <button type="button" class="btn-secondary" data-vehicle-id="${vehiculo.id}">Usar placa</button>
            </div>
        </article>
    `).join("");

    simitVehicleList.querySelectorAll("button[data-vehicle-id]").forEach((button) => {
        button.addEventListener("click", () => {
            const vehiculo = vehiculosState.find((item) => String(item.id) === button.dataset.vehicleId);
            if (!vehiculo) return;
            simitSelect.value = vehiculo.id;
            selectPlate(vehiculo.placa);
        });
    });
}

async function copyPlateToClipboard() {
    if (!currentPlate) {
        window.VehiAmb.ui.showMessage(mensaje, "Selecciona un vehiculo antes de copiar la placa", "error");
        return;
    }

    try {
        await navigator.clipboard.writeText(currentPlate);
        window.VehiAmb.ui.showMessage(mensaje, "Placa copiada. Ya puedes pegarla en SIMIT.");
    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(mensaje, "No fue posible copiar la placa automaticamente", "error");
    }
}

async function cargarVehiculos() {
    try {
        window.VehiAmb.ui.show(loader);
        vehiculosState = await window.VehiAmb.api.getVehiculosCatalogo();
        fillVehicleSelect(vehiculosState);
        renderVehicleList(vehiculosState);
    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(mensaje, "No fue posible cargar los vehiculos", "error");
    } finally {
        window.VehiAmb.ui.hide(loader);
    }
}

simitSelect.addEventListener("change", () => {
    const vehiculo = vehiculosState.find((item) => String(item.id) === simitSelect.value);
    selectPlate(vehiculo?.placa || "");
});

simitForm.addEventListener("submit", (event) => {
    event.preventDefault();
});

copyPlateButton.addEventListener("click", copyPlateToClipboard);
openSimitLink.addEventListener("click", () => {
    if (currentPlate && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(currentPlate).catch(() => {});
    }
});
openSimitLink.href = SIMIT_URL;

document.addEventListener("DOMContentLoaded", cargarVehiculos);
