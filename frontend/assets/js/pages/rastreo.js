const mapaEl = document.getElementById("gpsMapa");
const flotaList = document.getElementById("gpsFlotaList");
const ultimaActualizacion = document.getElementById("gpsUltimaActualizacion");
const gestionSection = document.getElementById("gpsGestionSection");
const dispositivoForm = document.getElementById("gpsDispositivoForm");
const imeiInput = document.getElementById("gpsImei");
const nombreDispositivoInput = document.getElementById("gpsNombreDispositivo");
const dispositivosList = document.getElementById("gpsDispositivosList");
const loader = document.getElementById("loader");
const mensaje = document.getElementById("mensaje");

const POLL_MS = 15000;

// Bogota como centro por defecto -- la flota es colombiana, y sin esto el
// mapa arrancaria centrado en el (0,0) del Atlantico hasta la primera
// posicion real.
const CENTRO_DEFECTO = [4.6097, -74.0817];
const ZOOM_DEFECTO = 6;

let mapa = null;
let marcadores = new Map(); // vehiculo_id -> L.Marker
let vehiculosCatalogo = [];

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatFechaHora(value) {
    if (!value) return "Sin dato";
    return new Date(value).toLocaleString("es-CO", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit"
    });
}

// Traccar reporta velocidad en nudos (herencia del protocolo AIS/GPS
// maritimo que usa como formato interno) -- se convierte a km/h, la unidad
// que de verdad significa algo para quien mira el tablero.
function nudosAKmh(nudos) {
    if (nudos === null || nudos === undefined) return null;
    return Math.round(Number(nudos) * 1.852);
}

function inicializarMapa() {
    mapa = L.map(mapaEl).setView(CENTRO_DEFECTO, ZOOM_DEFECTO);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
        maxZoom: 19
    }).addTo(mapa);
}

function centrarEn(posicion) {
    if (!mapa || posicion.latitud == null || posicion.longitud == null) return;
    mapa.setView([posicion.latitud, posicion.longitud], Math.max(mapa.getZoom(), 14));
}

function actualizarMarcadores(posiciones) {
    const idsConPosicion = new Set();

    posiciones.forEach((posicion) => {
        if (posicion.latitud == null || posicion.longitud == null) return;
        idsConPosicion.add(posicion.vehiculo_id);

        const kmh = nudosAKmh(posicion.velocidad_nudos);
        const popup = `
            <strong>${escapeHtml(posicion.vehiculo_placa) || "Sin placa"}</strong><br>
            ${escapeHtml(posicion.vehiculo_marca)} ${escapeHtml(posicion.vehiculo_modelo)}<br>
            ${kmh !== null ? `${kmh} km/h` : "Velocidad desconocida"}<br>
            <span style="color:#6b7280">${formatFechaHora(posicion.fecha_posicion)}</span>
        `;

        let marcador = marcadores.get(posicion.vehiculo_id);
        if (marcador) {
            marcador.setLatLng([posicion.latitud, posicion.longitud]);
            marcador.setPopupContent(popup);
        } else {
            marcador = L.marker([posicion.latitud, posicion.longitud]).addTo(mapa).bindPopup(popup);
            marcadores.set(posicion.vehiculo_id, marcador);
        }
    });

    // Un vehiculo que dejo de tener posicion (dispositivo desvinculado,
    // desactivado) pierde su marcador -- no queda un pin fantasma en el mapa.
    for (const [vehiculoId, marcador] of marcadores.entries()) {
        if (!idsConPosicion.has(vehiculoId)) {
            mapa.removeLayer(marcador);
            marcadores.delete(vehiculoId);
        }
    }
}

function renderFlotaList(posiciones) {
    if (!posiciones.length) {
        flotaList.innerHTML = '<p class="dash-empty">Todavía no hay vehículos con un dispositivo GPS vinculado.</p>';
        return;
    }

    flotaList.innerHTML = posiciones.map((posicion) => {
        const kmh = nudosAKmh(posicion.velocidad_nudos);
        return `
            <article class="record-item ${posicion.tiene_posicion ? "" : "is-muted"}" data-vehiculo-id="${posicion.vehiculo_id}" tabindex="0" role="button">
                <div class="record-top">
                    <span class="plate">${escapeHtml(posicion.vehiculo_placa) || "—"}</span>
                    <span class="pill ${posicion.tiene_posicion ? "pill-success" : ""}">${posicion.tiene_posicion ? `${kmh ?? 0} km/h` : "Sin señal"}</span>
                </div>
                <span class="record-sub">${escapeHtml(posicion.vehiculo_marca)} ${escapeHtml(posicion.vehiculo_modelo)}</span>
                <span class="record-sub">${formatFechaHora(posicion.fecha_posicion)}</span>
            </article>
        `;
    }).join("");
}

async function cargarFlota() {
    try {
        const posiciones = await window.VehiAmb.api.getGpsFlota();
        actualizarMarcadores(posiciones);
        renderFlotaList(posiciones);
        ultimaActualizacion.textContent = `Actualizado ${formatFechaHora(new Date().toISOString())}`;
    } catch (error) {
        console.error(error);
        flotaList.innerHTML = `<p class="dash-empty">${escapeHtml(error.message || "No se pudo cargar la flota")}</p>`;
    }
}

flotaList.addEventListener("click", (event) => {
    const item = event.target.closest("[data-vehiculo-id]");
    if (!item) return;

    const marcador = marcadores.get(item.dataset.vehiculoId);
    if (marcador) centrarEn({ latitud: marcador.getLatLng().lat, longitud: marcador.getLatLng().lng });
});

// ── Gestion de dispositivos (gps.manage) ─────────────────────────────────

function renderDispositivos(dispositivos) {
    if (!dispositivos.length) {
        dispositivosList.innerHTML = '<p class="dash-empty">Aún no hay dispositivos GPS registrados.</p>';
        return;
    }

    const opcionesVehiculo = (actualId) => `
        <option value="">Sin vehículo asignado</option>
        ${vehiculosCatalogo.map((vehiculo) => `
            <option value="${vehiculo.id}" ${String(vehiculo.id) === String(actualId) ? "selected" : ""}>
                ${escapeHtml(vehiculo.placa)} - ${escapeHtml(vehiculo.marca)} ${escapeHtml(vehiculo.modelo)}
            </option>
        `).join("")}
    `;

    dispositivosList.innerHTML = dispositivos.map((dispositivo) => `
        <article class="record-item">
            <div class="record-top">
                <span class="record-title">${escapeHtml(dispositivo.nombre) || dispositivo.imei}</span>
                <span class="badge ${dispositivo.estado === "activo" ? "badge-verde" : "badge-rojo"}">${dispositivo.estado === "activo" ? "Activo" : "Inactivo"}</span>
            </div>
            <span class="record-sub">IMEI ${escapeHtml(dispositivo.imei)}</span>
            <div class="form-group">
                <label>Vehículo vinculado</label>
                <select data-dispositivo-id="${dispositivo.id}" class="gps-vehiculo-select">
                    ${opcionesVehiculo(dispositivo.vehiculo_id)}
                </select>
            </div>
            <div class="admin-user-actions">
                <button type="button" class="btn-secondary" data-toggle-estado="${dispositivo.id}" data-estado-actual="${dispositivo.estado}">
                    ${dispositivo.estado === "activo" ? "Desactivar" : "Activar"}
                </button>
            </div>
        </article>
    `).join("");
}

async function cargarDispositivos() {
    try {
        const [dispositivos, vehiculos] = await Promise.all([
            window.VehiAmb.api.getGpsDispositivos(),
            vehiculosCatalogo.length ? vehiculosCatalogo : window.VehiAmb.api.getVehiculosCatalogo()
        ]);
        vehiculosCatalogo = vehiculos;
        renderDispositivos(dispositivos);
    } catch (error) {
        console.error(error);
        dispositivosList.innerHTML = `<p class="dash-empty">${escapeHtml(error.message || "No se pudieron cargar los dispositivos")}</p>`;
    }
}

dispositivoForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
        window.VehiAmb.ui.show(loader);
        await window.VehiAmb.api.registrarGpsDispositivo({
            imei: imeiInput.value.trim(),
            nombre: nombreDispositivoInput.value.trim()
        });
        window.VehiAmb.ui.showMessage(mensaje, "Dispositivo registrado correctamente");
        dispositivoForm.reset();
        await cargarDispositivos();
    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudo registrar el dispositivo", "error");
    } finally {
        window.VehiAmb.ui.hide(loader);
    }
});

dispositivosList?.addEventListener("change", async (event) => {
    const select = event.target.closest(".gps-vehiculo-select");
    if (!select) return;

    try {
        window.VehiAmb.ui.show(loader);
        await window.VehiAmb.api.asignarGpsVehiculo(select.dataset.dispositivoId, select.value || null);
        window.VehiAmb.ui.showMessage(mensaje, "Vehículo vinculado correctamente");
        await cargarFlota();
    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudo vincular el vehículo", "error");
        await cargarDispositivos();
    } finally {
        window.VehiAmb.ui.hide(loader);
    }
});

dispositivosList?.addEventListener("click", async (event) => {
    const boton = event.target.closest("[data-toggle-estado]");
    if (!boton) return;

    const nuevoEstado = boton.dataset.estadoActual === "activo" ? "inactivo" : "activo";

    try {
        window.VehiAmb.ui.show(loader);
        await window.VehiAmb.api.setGpsDispositivoEstado(boton.dataset.toggleEstado, nuevoEstado);
        await cargarDispositivos();
        await cargarFlota();
    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudo actualizar el dispositivo", "error");
    } finally {
        window.VehiAmb.ui.hide(loader);
    }
});

document.addEventListener("DOMContentLoaded", async () => {
    inicializarMapa();
    await cargarFlota();
    setInterval(cargarFlota, POLL_MS);

    if (window.VehiAmb.auth?.hasPermission?.("gps.manage")) {
        gestionSection.classList.remove("hidden");
        await cargarDispositivos();
    }
});
