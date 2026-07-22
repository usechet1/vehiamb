window.VehiAmb = window.VehiAmb || {};

async function loadAsDataUrl(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`No se pudo cargar el recurso: ${url}`);
    }

    const blob = await response.blob();

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
    });
}

function detectImageFormat(mime) {
    if (mime === "image/png") return "PNG";
    if (mime === "image/jpeg" || mime === "image/jpg") return "JPEG";
    return null;
}

/**
 * Normaliza cualquier imagen soportada por el navegador (png/jpeg/webp) a un
 * JPEG dibujandola en un canvas. jsPDF no soporta WEBP directamente, asi que
 * este es el unico camino confiable para incrustar el adjunto sin importar
 * el formato original con el que se subio.
 */
async function loadImageAsJpegDataUrl(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`No se pudo cargar el recurso: ${url}`);
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);

    try {
        const image = await new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error("No se pudo decodificar la imagen"));
            img.src = objectUrl;
        });

        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;

        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0);

        return {
            dataUrl: canvas.toDataURL("image/jpeg", 0.92),
            width: canvas.width,
            height: canvas.height
        };
    } finally {
        URL.revokeObjectURL(objectUrl);
    }
}

function createDocument(options) {
    const { jsPDF } = window.jspdf;
    return new jsPDF({ unit: "pt", format: "a4", ...options });
}

/**
 * Formato de fecha exclusivo para los documentos PDF (dd/mm/aaaa),
 * independiente del formato usado en el resto de la aplicacion.
 */
function formatDateForPdf(value) {
    if (!value) return "No registrado";

    const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
    if (Number.isNaN(date.getTime())) return "No registrado";

    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();

    return `${day}/${month}/${year}`;
}

// Cada empresa tiene su propio logo (configurado en Empresa > Configuración,
// sidebar) y ese es el unico membrete que deben llevar los PDF exportados --
// no hay membrete generico de la plataforma. Si la empresa aun no subio un
// logo, el encabezado simplemente se exporta sin imagen (nunca con un logo
// ajeno). loadImageAsJpegDataUrl normaliza cualquier formato subido
// (png/jpg/webp) a jpeg, que es lo unico que jsPDF puede incrustar de forma
// confiable.
async function getEmpresaBranding() {
    const user = window.VehiAmb.auth?.getUser?.();
    const nombreEmpresa = user?.empresa_nombre || "";

    if (!user?.empresa_logo_url) {
        return { nombreEmpresa, logo: null };
    }

    try {
        const url = window.VehiAmb.api.getAssetUrl(user.empresa_logo_url);
        const logo = await loadImageAsJpegDataUrl(url);
        return { nombreEmpresa, logo };
    } catch (error) {
        console.error("No se pudo cargar el logo de la empresa para el PDF:", error);
        return { nombreEmpresa, logo: null };
    }
}

// Membrete fijo de pie de pagina (frontend/img/membrete_footer.png): a
// diferencia del logo de getEmpresaBranding (que varia por empresa), este es
// el mismo banner de contacto para todos los PDF exportables de la
// plataforma. Se cachea en un modulo-level promise porque es un archivo
// estatico que no cambia entre exportaciones dentro de la misma sesion.
let membreteFooterPromise = null;

function getMembreteFooterImage() {
    if (!membreteFooterPromise) {
        membreteFooterPromise = loadImageAsJpegDataUrl("img/membrete_footer.png").catch((error) => {
            console.error("No se pudo cargar el membrete del pie de pagina:", error);
            return null;
        });
    }
    return membreteFooterPromise;
}

window.VehiAmb.pdfExport = {
    createDocument,
    loadAsDataUrl,
    detectImageFormat,
    loadImageAsJpegDataUrl,
    getEmpresaBranding,
    getMembreteFooterImage,
    formatDateForPdf
};
