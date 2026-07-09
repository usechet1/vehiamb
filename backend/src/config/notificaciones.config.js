// Catálogo central del Centro de Notificaciones. Única fuente de verdad para
// categorías, prioridades y tipos: agregar un tipo nuevo solo requiere una
// entrada en TIPOS (categoría + prioridad + título por defecto), sin tocar
// el resto del sistema (repository, service, jobs, frontend).

const CATEGORIAS = {
  mantenimiento: { label: "Mantenimientos", icono: "🔧" },
  documentacion: { label: "Documentación", icono: "📄" },
  incidente: { label: "Incidentes", icono: "🚨" },
  usuario: { label: "Usuarios", icono: "👤" },
  sistema: { label: "Sistema", icono: "⚙️" },
  inventario: { label: "Inventario", icono: "📦" }
};

// orden: menor = mayor urgencia. Las críticas siempre se muestran primero.
const PRIORIDADES = {
  critica: { label: "Crítica", icono: "🔴", orden: 0 },
  alta: { label: "Alta", icono: "🟠", orden: 1 },
  media: { label: "Media", icono: "🟡", orden: 2 },
  informativa: { label: "Informativa", icono: "🔵", orden: 3 }
};

// Compatibilidad con notificaciones creadas antes del rediseño (prioridad "baja").
const PRIORIDAD_LEGACY_ALIAS = { baja: "informativa" };

const TIPOS = {
  mantenimiento_proximo: { categoria: "mantenimiento", prioridad: "media", titulo: "Mantenimiento próximo" },
  mantenimiento_vencido: { categoria: "mantenimiento", prioridad: "critica", titulo: "Mantenimiento vencido" },
  cambio_aceite_proximo: { categoria: "mantenimiento", prioridad: "media", titulo: "Cambio de aceite próximo" },
  soat_proximo: { categoria: "documentacion", prioridad: "alta", titulo: "SOAT próximo a vencer" },
  soat_vencido: { categoria: "documentacion", prioridad: "critica", titulo: "SOAT vencido" },
  tecnomecanica_proxima: { categoria: "documentacion", prioridad: "alta", titulo: "Técnico-Mecánica próxima a vencer" },
  tecnomecanica_vencida: { categoria: "documentacion", prioridad: "critica", titulo: "Técnico-Mecánica vencida" },
  vehiculo_fuera_servicio: { categoria: "incidente", prioridad: "alta", titulo: "Vehículo fuera de servicio" },
  vehiculo_en_mantenimiento: { categoria: "incidente", prioridad: "media", titulo: "Vehículo ingresó a mantenimiento" },
  vehiculo_disponible: { categoria: "incidente", prioridad: "informativa", titulo: "Vehículo disponible nuevamente" },
  usuario_creado: { categoria: "usuario", prioridad: "informativa", titulo: "Nuevo usuario creado" },
  permisos_actualizados: { categoria: "usuario", prioridad: "media", titulo: "Cambio de permisos" },
  aprobacion_requerida: { categoria: "mantenimiento", prioridad: "alta", titulo: "Aprobación requerida" },
  mantenimiento_aprobado: { categoria: "mantenimiento", prioridad: "informativa", titulo: "Mantenimiento aprobado" },
  mantenimiento_rechazado: { categoria: "mantenimiento", prioridad: "media", titulo: "Mantenimiento rechazado" },
  kilometraje_incoherente: { categoria: "incidente", prioridad: "alta", titulo: "Kilometraje incoherente" },
  error_sistema: { categoria: "sistema", prioridad: "critica", titulo: "Error del sistema" },
  stock_minimo_alcanzado: { categoria: "inventario", prioridad: "media", titulo: "Stock mínimo alcanzado" },
  stock_agotado: { categoria: "inventario", prioridad: "alta", titulo: "Repuesto agotado" },
  repuesto_inactivo_configurado: { categoria: "inventario", prioridad: "media", titulo: "Repuesto inactivo configurado" },
  simit_multa_detectada: { categoria: "incidente", prioridad: "alta", titulo: "Nuevo comparendo detectado en SIMIT" },
  simit_estado_cambiado: { categoria: "incidente", prioridad: "media", titulo: "Cambio de estado en SIMIT" },
  simit_consulta_fallo: { categoria: "sistema", prioridad: "media", titulo: "Consulta SIMIT fallida" }
};

// Umbrales (en días) para generar recordatorios automáticos de vencimiento.
// Configurable: agregar/quitar un umbral aquí cambia el comportamiento de los
// jobs sin tocar su lógica.
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
