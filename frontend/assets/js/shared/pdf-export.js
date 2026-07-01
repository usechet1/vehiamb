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

window.VehiAmb.pdfExport = {
    createDocument,
    loadAsDataUrl,
    detectImageFormat,
    loadImageAsJpegDataUrl,
    formatDateForPdf
};
