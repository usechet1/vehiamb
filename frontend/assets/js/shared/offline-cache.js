window.VehiAmb = window.VehiAmb || {};

const OFFLINE_DB_NOMBRE = "vehiamb_offline";
const OFFLINE_DB_VERSION = 1;
const OFFLINE_STORE_CONTROL_VIAJE = "control_viaje";
const OFFLINE_STORE_ARCHIVOS = "archivos";

function abrirOfflineDb() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(OFFLINE_DB_NOMBRE, OFFLINE_DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(OFFLINE_STORE_CONTROL_VIAJE)) {
                db.createObjectStore(OFFLINE_STORE_CONTROL_VIAJE, { keyPath: "usuarioId" });
            }
            if (!db.objectStoreNames.contains(OFFLINE_STORE_ARCHIVOS)) {
                db.createObjectStore(OFFLINE_STORE_ARCHIVOS, { keyPath: "url" });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function offlinePut(storeName, value) {
    return abrirOfflineDb().then((db) => new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        tx.objectStore(storeName).put(value);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    }));
}

function offlineGet(storeName, key) {
    return abrirOfflineDb().then((db) => new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readonly");
        const request = tx.objectStore(storeName).get(key);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    }));
}

// Guarda archivos (fotos/PDFs de documentos) en IndexedDB para poder
// mostrarlos sin conexion -- pensado para paginas como "Mi ultimo viaje"
// que un conductor puede necesitar abrir en un control de transito sin
// senal. Solo cachea GETs publicos del propio backend (URLs ya resueltas
// con getAssetUrl), nunca respuestas con datos de otros usuarios.
window.VehiAmb.offline = {
    async guardarControlViaje(usuarioId, resultado) {
        if (!usuarioId) return;
        await offlinePut(OFFLINE_STORE_CONTROL_VIAJE, {
            usuarioId,
            resultado,
            guardadoEn: new Date().toISOString()
        });
    },

    async obtenerControlViaje(usuarioId) {
        if (!usuarioId) return null;
        try {
            return await offlineGet(OFFLINE_STORE_CONTROL_VIAJE, usuarioId);
        } catch (error) {
            console.error("No se pudo leer el cache offline:", error);
            return null;
        }
    },

    async guardarArchivo(url) {
        if (!url) return;
        try {
            const existente = await offlineGet(OFFLINE_STORE_ARCHIVOS, url);
            if (existente) return;
            const response = await fetch(url);
            if (!response.ok) return;
            const blob = await response.blob();
            await offlinePut(OFFLINE_STORE_ARCHIVOS, { url, blob });
        } catch (error) {
            console.error("No se pudo guardar el archivo para uso offline:", url, error);
        }
    },

    async obtenerArchivoUrl(url) {
        if (!url) return "";
        try {
            const registro = await offlineGet(OFFLINE_STORE_ARCHIVOS, url);
            return registro ? URL.createObjectURL(registro.blob) : "";
        } catch (error) {
            return "";
        }
    }
};
