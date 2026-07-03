// Catalogo central del Centro de Notificaciones. Unica fuente de verdad para
// categorias, prioridades y tipos: agregar un tipo nuevo solo requiere una
// entrada en TIPOS (categoria + prioridad + titulo por defecto), sin tocar
// el resto del sistema (repository, service, jobs, frontend).

const CATEGORIAS = {
  mantenimiento: { label: "Mantenimientos", icono: "🔧" },
  documentacion: { label: "Documentacion", icono: "📄" },
  incidente: { label: "Incidentes", icono: "🚨" },
  usuario: { label: "Usuarios", icono: "👤" },
  sistema: { label: "Sistema", icono: "⚙️" },
  inventario: { label: "Inventario", icono: "📦" }
};

// orden: menor = mayor urgencia. Las criticas siempre se muestran primero.
const PRIORIDADES = {
  critica: { label: "Critica", icono: "🔴", orden: 0 },
  alta: { label: "Alta", icono: "🟠", orden: 1 },
  media: { label: "Media", icono: "🟡", orden: 2 },
  informativa: { label: "Informativa", icono: "🔵", orden: 3 }
};

// Compatibilidad con notificaciones creadas antes del rediseño (prioridad "baja").
const PRIORIDAD_LEGACY_ALIAS = { baja: "informativa" };

const TIPOS = {
  mantenimiento_proximo: { categoria: "mantenimiento", prioridad: "media", titulo: "Mantenimiento proximo" },
  mantenimiento_vencido: { categoria: "mantenimiento", prioridad: "critica", titulo: "Mantenimiento vencido" },
  cambio_aceite_proximo: { categoria: "mantenimiento", prioridad: "media", titulo: "Cambio de aceite proximo" },
  soat_proximo: { categoria: "documentacion", prioridad: "alta", titulo: "SOAT proximo a vencer" },
  soat_vencido: { categoria: "documentacion", prioridad: "critica", titulo: "SOAT vencido" },
  tecnomecanica_proxima: { categoria: "documentacion", prioridad: "alta", titulo: "Tecnico-Mecanica proxima a vencer" },
  tecnomecanica_vencida: { categoria: "documentacion", prioridad: "critica", titulo: "Tecnico-Mecanica vencida" },
  vehiculo_fuera_servicio: { categoria: "incidente", prioridad: "alta", titulo: "Vehiculo fuera de servicio" },
  vehiculo_en_mantenimiento: { categoria: "incidente", prioridad: "media", titulo: "Vehiculo ingreso a mantenimiento" },
  vehiculo_disponible: { categoria: "incidente", prioridad: "informativa", titulo: "Vehiculo disponible nuevamente" },
  usuario_creado: { categoria: "usuario", prioridad: "informativa", titulo: "Nuevo usuario creado" },
  permisos_actualizados: { categoria: "usuario", prioridad: "media", titulo: "Cambio de permisos" },
  aprobacion_requerida: { categoria: "mantenimiento", prioridad: "alta", titulo: "Aprobacion requerida" },
  mantenimiento_aprobado: { categoria: "mantenimiento", prioridad: "informativa", titulo: "Mantenimiento aprobado" },
  mantenimiento_rechazado: { categoria: "mantenimiento", prioridad: "media", titulo: "Mantenimiento rechazado" },
  kilometraje_incoherente: { categoria: "incidente", prioridad: "alta", titulo: "Kilometraje incoherente" },
  error_sistema: { categoria: "sistema", prioridad: "critica", titulo: "Error del sistema" },
  stock_minimo_alcanzado: { categoria: "inventario", prioridad: "media", titulo: "Stock minimo alcanzado" },
  stock_agotado: { categoria: "inventario", prioridad: "alta", titulo: "Repuesto agotado" },
  repuesto_inactivo_configurado: { categoria: "inventario", prioridad: "media", titulo: "Repuesto inactivo configurado" },
  simit_multa_detectada: { categoria: "incidente", prioridad: "alta", titulo: "Nuevo comparendo detectado en SIMIT" },
  simit_estado_cambiado: { categoria: "incidente", prioridad: "media", titulo: "Cambio de estado en SIMIT" },
  simit_consulta_fallo: { categoria: "sistema", prioridad: "media", titulo: "Consulta SIMIT fallida" }
};

// Umbrales (en dias) para generar recordatorios automaticos de vencimiento.
// Configurable: agregar/quitar un umbral aqui cambia el comportamiento de los
// jobs sin tocar su logica.
const RECORDATORIO_UMBRALES_DIAS = [30, 15, 7, 3, 1];

function normalizarPrioridad(prioridad) {
  return PRIORIDAD_LEGACY_ALIAS[prioridad] || prioridad || "media";
}

function tipoConfig(tipo) {
  return TIPOS[tipo] || { categoria: "sistema", prioridad: "media", titulo: tipo };
}

function ordenPrioridad(prioridad) {
  const normalizada = normalizarPrioridad(prioridad);
  return PRIORIDADES[normalizada]?.orden ?? PRIORIDADES.media.orden;
}

module.exports = {
  CATEGORIAS,
  PRIORIDADES,
  TIPOS,
  RECORDATORIO_UMBRALES_DIAS,
  normalizarPrioridad,
  tipoConfig,
  ordenPrioridad
};
