// Espejo de presentacion del catalogo del backend (backend/src/config/notificaciones.config.js).
// Solo controla iconos/colores/orden visual; las reglas de negocio (que tipo
// pertenece a que categoria/prioridad) siempre las decide el backend.
window.VehiAmb = window.VehiAmb || {};

const CATEGORIAS = {
    mantenimiento: { label: "Mantenimientos", icono: "🔧" },
    documentacion: { label: "Documentacion", icono: "📄" },
    incidente: { label: "Incidentes", icono: "🚨" },
    usuario: { label: "Usuarios", icono: "👤" },
    sistema: { label: "Sistema", icono: "⚙️" },
    inventario: { label: "Inventario", icono: "📦" }
};

const PRIORIDADES = {
    critica: { label: "Critica", icono: "🔴", orden: 0, className: "notif-prio-critica" },
    alta: { label: "Alta", icono: "🟠", orden: 1, className: "notif-prio-alta" },
    media: { label: "Media", icono: "🟡", orden: 2, className: "notif-prio-media" },
    informativa: { label: "Informativa", icono: "🔵", orden: 3, className: "notif-prio-informativa" }
};

const PRIORIDAD_LEGACY_ALIAS = { baja: "informativa" };

// Acciones rapidas: cada accion_tipo que puede llegar del backend se resuelve
// aqui a una etiqueta de boton + una pagina de destino. Agregar una accion
// nueva es una entrada mas en este objeto.
const ACCIONES = {
    ver_vehiculo: {
        label: "Ver vehiculo",
        url: (payload) => `vehiculo.html?id=${payload?.vehiculo_id}`
    },
    ver_mantenimiento: {
        label: "Ver mantenimiento",
        url: () => "mantenimientos.html"
    },
    renovar_documento: {
        label: "Renovar documento",
        url: () => "documentos.html"
    },
    ver_usuario: {
        label: "Ver usuario",
        url: () => "admin-usuarios.html"
    },
    ver_repuesto: {
        label: "Ver repuesto",
        url: () => "repuestos.html"
    }
};

function normalizarPrioridad(prioridad) {
    return PRIORIDAD_LEGACY_ALIAS[prioridad] || prioridad || "media";
}

function categoriaConfig(categoria) {
    return CATEGORIAS[categoria] || CATEGORIAS.sistema;
}

function prioridadConfig(prioridad) {
    return PRIORIDADES[normalizarPrioridad(prioridad)] || PRIORIDADES.media;
}

function accionConfig(accion) {
    if (!accion?.tipo) return null;
    const config = ACCIONES[accion.tipo];
    if (!config) return null;

    return { label: config.label, url: config.url(accion.payload) };
}

function tiempoTranscurrido(fechaIso) {
    if (!fechaIso) return "";

    const diffMs = Date.now() - new Date(fechaIso).getTime();
    if (diffMs < 0) return "Hace un momento";

    const minutos = Math.floor(diffMs / 60000);
    if (minutos < 1) return "Hace un momento";
    if (minutos < 60) return `Hace ${minutos} minuto${minutos === 1 ? "" : "s"}`;

    const horas = Math.floor(minutos / 60);
    if (horas < 24) return `Hace ${horas} hora${horas === 1 ? "" : "s"}`;

    const dias = Math.floor(horas / 24);
    if (dias < 30) return `Hace ${dias} dia${dias === 1 ? "" : "s"}`;

    const meses = Math.floor(dias / 30);
    if (meses < 12) return `Hace ${meses} mes${meses === 1 ? "" : "es"}`;

    const anios = Math.floor(meses / 12);
    return `Hace ${anios} año${anios === 1 ? "" : "s"}`;
}

window.VehiAmb.notifConfig = {
    CATEGORIAS,
    PRIORIDADES,
    categoriaConfig,
    prioridadConfig,
    accionConfig,
    tiempoTranscurrido
};
