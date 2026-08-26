window.VehiAmb = window.VehiAmb || {};

window.VehiAmb.API_URL = window.VehiAmb.API_URL || "/api";

window.VehiAmb.ASSET_BASE_URL = window.VehiAmb.ASSET_BASE_URL || "";

async function requestJson(url, options, errorMessage) {
    const sessionToken = window.VehiAmb.auth?.getToken?.() || "";
    const headers = new Headers(options?.headers || {});

    if (sessionToken) {
        headers.set("Authorization", `Bearer ${sessionToken}`);
    }

    const empresaActivaId = window.VehiAmb.auth?.getEmpresaActivaId?.() || "";
    if (empresaActivaId) {
        headers.set("X-Empresa-Id", empresaActivaId);
    }

    const response = await fetch(url, {
        ...options,
        headers
    });

    if (response.status === 401) {
        window.VehiAmb.auth?.logout?.();
        throw new Error("Sesion expirada");
    }

    if (response.status === 403) {
        throw new Error("No tienes permiso para realizar esta accion");
    }

    if (!response.ok) {
        let serverMessage = "";
        try {
            const data = await response.json();
            serverMessage = data?.message || "";
        } catch (error) {
            serverMessage = "";
        }

        throw new Error(serverMessage || errorMessage);
    }

    // Un 204 ("No Content") no trae cuerpo, y response.json() sobre un cuerpo
    // vacio lanza SyntaxError -- lo que hacia que los DELETE exitosos
    // (documentos, asignaciones, etc.) mostraran un toast de error igual.
    if (response.status === 204) return null;

    return response.json();
}

window.VehiAmb.api = {
    getAssetUrl(path) {
        if (!path) return "";
        if (path.startsWith("http://") || path.startsWith("https://")) return path;
        return `${window.VehiAmb.ASSET_BASE_URL}${path}`;
    },

    cambiarPassword(payload) {
        return requestJson(
            `${window.VehiAmb.API_URL}/auth/cambiar-password`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            },
            "No se pudo cambiar la contraseña"
        );
    },

    solicitarRecuperacionPassword(email) {
        return requestJson(
            `${window.VehiAmb.API_URL}/auth/olvide-password`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email })
            },
            "No se pudo procesar la solicitud"
        );
    },

    restablecerPassword(token, passwordNueva) {
        return requestJson(
            `${window.VehiAmb.API_URL}/auth/reset-password`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, password_nueva: passwordNueva })
            },
            "No se pudo restablecer la contraseña"
        );
    },

    getEmpresas() {
        return requestJson(`${window.VehiAmb.API_URL}/empresas`, undefined, "No se pudieron cargar las empresas");
    },

    getMiEmpresa() {
        return requestJson(`${window.VehiAmb.API_URL}/empresas/me`, undefined, "No se pudo cargar la empresa");
    },

    updateMiEmpresa(formData) {
        return requestJson(
            `${window.VehiAmb.API_URL}/empresas/me`,
            {
                method: "PUT",
                body: formData
            },
            "No se pudo actualizar la empresa"
        );
    },

    getVehiculos(filters = {}) {
        const params = new URLSearchParams();

        if (filters.search) params.set("search", filters.search);
        if (filters.estado) params.set("estado", filters.estado);
        if (filters.tipo) params.set("tipo", filters.tipo);
        if (filters.marca) params.set("marca", filters.marca);
        if (filters.sort) params.set("sort", filters.sort);
        if (filters.page) params.set("page", filters.page);
        if (filters.limit) params.set("limit", filters.limit);

        const query = params.toString();

        return requestJson(
            `${window.VehiAmb.API_URL}/vehiculos${query ? `?${query}` : ""}`,
            undefined,
            "No se pudieron cargar los vehiculos"
        );
    },

    getMarcasVehiculos() {
        return requestJson(`${window.VehiAmb.API_URL}/vehiculos/catalogos/marcas`, undefined, "No se pudieron cargar las marcas");
    },

    getVehiculosCatalogo() {
        return requestJson(`${window.VehiAmb.API_URL}/vehiculos/catalogos/lista`, undefined, "No se pudieron cargar los vehiculos");
    },

    getVehiculo(id) {
        return requestJson(`${window.VehiAmb.API_URL}/vehiculos/${id}`, undefined, "No se pudo cargar el vehiculo");
    },

    createVehiculo(formData) {
        return requestJson(
            `${window.VehiAmb.API_URL}/vehiculos`,
            {
                method: "POST",
                body: formData
            },
            "No se pudo guardar el vehiculo"
        );
    },

    updateVehiculo(id, formData) {
        return requestJson(
            `${window.VehiAmb.API_URL}/vehiculos/${id}`,
            {
                method: "PUT",
                body: formData
            },
            "No se pudo actualizar el vehiculo"
        );
    },

    updateEstadoVehiculo(id, estado) {
        return requestJson(
            `${window.VehiAmb.API_URL}/vehiculos/${id}/estado`,
            {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ estado })
            },
            "No se pudo actualizar el estado del vehiculo"
        );
    },

    getMantenimientos(filters = {}) {
        const params = new URLSearchParams();

        if (filters.tipo) params.set("tipo", filters.tipo);
        if (filters.placa) params.set("placa", filters.placa);
        if (filters.fecha_desde) params.set("fecha_desde", filters.fecha_desde);
        if (filters.fecha_hasta) params.set("fecha_hasta", filters.fecha_hasta);

        const query = params.toString();

        return requestJson(
            `${window.VehiAmb.API_URL}/mantenimientos${query ? `?${query}` : ""}`,
            undefined,
            "No se pudieron cargar los mantenimientos"
        );
    },

    getMantenimientosByVehicle(vehiculoId) {
        return requestJson(
            `${window.VehiAmb.API_URL}/mantenimientos/vehiculo/${vehiculoId}`,
            undefined,
            "No se pudieron cargar los mantenimientos del vehiculo"
        );
    },

    getMantenimientosUsuariosDisponibles() {
        return requestJson(
            `${window.VehiAmb.API_URL}/mantenimientos/usuarios-disponibles`,
            undefined,
            "No se pudieron cargar los usuarios"
        );
    },

    getMantenimiento(id) {
        return requestJson(`${window.VehiAmb.API_URL}/mantenimientos/${id}`, undefined, "No se pudo cargar el mantenimiento");
    },

    subirSalidaInventarioMantenimiento(id, formData) {
        return requestJson(
            `${window.VehiAmb.API_URL}/mantenimientos/${id}/salida-inventario`,
            {
                method: "POST",
                body: formData
            },
            "No se pudo subir el documento de salida de inventario"
        );
    },

    confirmarCambioAceite(id) {
        return requestJson(
            `${window.VehiAmb.API_URL}/mantenimientos/${id}/confirmar`,
            {
                method: "POST"
            },
            "No se pudo confirmar el cambio de aceite"
        );
    },

    deleteMantenimiento(id) {
        return requestJson(
            `${window.VehiAmb.API_URL}/mantenimientos/${id}`,
            { method: "DELETE" },
            "No se pudo eliminar el mantenimiento"
        );
    },

    createMantenimiento(payload) {
        return requestJson(
            `${window.VehiAmb.API_URL}/mantenimientos`,
            {
                method: "POST",
                body: payload
            },
            "No se pudo guardar el mantenimiento"
        );
    },

    getDocumentos() {
        return requestJson(`${window.VehiAmb.API_URL}/documentos`, undefined, "No se pudieron cargar los documentos");
    },

    getDocumentosByVehicle(vehiculoId) {
        return requestJson(
            `${window.VehiAmb.API_URL}/documentos/vehiculo/${vehiculoId}`,
            undefined,
            "No se pudieron cargar los documentos del vehiculo"
        );
    },

    createDocumento(payload) {
        return requestJson(
            `${window.VehiAmb.API_URL}/documentos`,
            {
                method: "POST",
                body: payload
            },
            "No se pudo guardar el documento"
        );
    },

    updateDocumento(id, payload) {
        return requestJson(
            `${window.VehiAmb.API_URL}/documentos/${id}`,
            {
                method: "PUT",
                body: payload
            },
            "No se pudo actualizar el documento"
        );
    },

    // Solo extrae numero/fechas/placa de un SOAT o RTM -- no guarda nada,
    // eso lo hace createDocumento/updateDocumento con el resultado.
    extraerDatosDocumento(formData) {
        return requestJson(
            `${window.VehiAmb.API_URL}/documentos/extraer`,
            {
                method: "POST",
                body: formData
            },
            "No se pudo leer el archivo"
        );
    },

    deleteDocumento(id) {
        return requestJson(
            `${window.VehiAmb.API_URL}/documentos/${id}`,
            { method: "DELETE" },
            "No se pudo eliminar el documento"
        );
    },

    getUsuarios() {
        return requestJson(`${window.VehiAmb.API_URL}/usuarios`, undefined, "No se pudieron cargar los usuarios");
    },

    getUsuariosCatalogo() {
        return requestJson(`${window.VehiAmb.API_URL}/usuarios/catalogo`, undefined, "No se pudieron cargar los usuarios");
    },

    createUsuario(formData) {
        return requestJson(
            `${window.VehiAmb.API_URL}/usuarios`,
            {
                method: "POST",
                body: formData
            },
            "No se pudo crear el usuario"
        );
    },

    updateUsuario(id, formData) {
        return requestJson(
            `${window.VehiAmb.API_URL}/usuarios/${id}`,
            {
                method: "PUT",
                body: formData
            },
            "No se pudo actualizar el usuario"
        );
    },

    setUsuarioActivo(id, activo) {
        return requestJson(
            `${window.VehiAmb.API_URL}/usuarios/${id}/activo`,
            {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ activo })
            },
            "No se pudo cambiar el estado del usuario"
        );
    },

    getRoles() {
        return requestJson(`${window.VehiAmb.API_URL}/usuarios/catalogos/roles`, undefined, "No se pudieron cargar los roles");
    },

    getPermisos() {
        return requestJson(`${window.VehiAmb.API_URL}/usuarios/catalogos/permisos`, undefined, "No se pudieron cargar los permisos");
    },

    updateRolePermissions(roleId, permissionIds) {
        return requestJson(
            `${window.VehiAmb.API_URL}/usuarios/catalogos/roles/${roleId}/permisos`,
            {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ permission_ids: permissionIds })
            },
            "No se pudieron actualizar los permisos"
        );
    },

    getNotificaciones(filters = {}) {
        const params = new URLSearchParams();

        if (filters.estado) params.set("estado", filters.estado);
        if (filters.prioridad) params.set("prioridad", filters.prioridad);
        if (filters.categoria) params.set("categoria", filters.categoria);
        if (filters.vehiculo_id) params.set("vehiculo_id", filters.vehiculo_id);
        if (filters.fecha_desde) params.set("fecha_desde", filters.fecha_desde);
        if (filters.fecha_hasta) params.set("fecha_hasta", filters.fecha_hasta);
        if (filters.search) params.set("search", filters.search);
        if (filters.agrupar === false) params.set("agrupar", "false");

        const query = params.toString();

        return requestJson(
            `${window.VehiAmb.API_URL}/notificaciones${query ? `?${query}` : ""}`,
            undefined,
            "No se pudieron cargar las notificaciones"
        );
    },

    getContadorNotificaciones() {
        return requestJson(`${window.VehiAmb.API_URL}/notificaciones/contador`, undefined, "No se pudo cargar el contador de notificaciones");
    },

    marcarNotificacionLeida(id) {
        return requestJson(
            `${window.VehiAmb.API_URL}/notificaciones/${id}/leido`,
            { method: "PATCH" },
            "No se pudo marcar la notificacion como leida"
        );
    },

    marcarTodasNotificacionesLeidas() {
        return requestJson(
            `${window.VehiAmb.API_URL}/notificaciones/leidas`,
            { method: "PATCH" },
            "No se pudieron marcar las notificaciones como leidas"
        );
    },

    archivarNotificacion(id) {
        return requestJson(
            `${window.VehiAmb.API_URL}/notificaciones/${id}/archivar`,
            { method: "PATCH" },
            "No se pudo archivar la notificacion"
        );
    },

    eliminarNotificacion(id) {
        return requestJson(
            `${window.VehiAmb.API_URL}/notificaciones/${id}`,
            { method: "DELETE" },
            "No se pudo eliminar la notificacion"
        );
    },

    reenviarNotificacionWhatsapp(id) {
        return requestJson(
            `${window.VehiAmb.API_URL}/notificaciones/${id}/reenviar-whatsapp`,
            { method: "POST" },
            "No se pudo reenviar la notificacion por WhatsApp"
        );
    },

    getComentariosNotificacion(referenciaTipo, referenciaId) {
        return requestJson(
            `${window.VehiAmb.API_URL}/notificaciones/referencia/${referenciaTipo}/${referenciaId}/comentarios`,
            undefined,
            "No se pudieron cargar los comentarios"
        );
    },

    // formData ya viene armado por quien llama (comentario + foto opcional) --
    // no se le pone Content-Type a mano: el navegador arma el
    // "multipart/form-data; boundary=..." solo cuando el body es un
    // FormData, y si lo pisamos manualmente rompe el boundary. Mismo
    // criterio que createDocumento en este mismo archivo.
    comentarNotificacion(referenciaTipo, referenciaId, formData) {
        return requestJson(
            `${window.VehiAmb.API_URL}/notificaciones/referencia/${referenciaTipo}/${referenciaId}/comentarios`,
            {
                method: "POST",
                body: formData
            },
            "No se pudo guardar el comentario"
        );
    },

    eliminarNotificacionesLeidas() {
        return requestJson(
            `${window.VehiAmb.API_URL}/notificaciones/leidas`,
            { method: "DELETE" },
            "No se pudieron eliminar las notificaciones leidas"
        );
    },

    eliminarTodasNotificaciones() {
        return requestJson(
            `${window.VehiAmb.API_URL}/notificaciones/todas`,
            { method: "DELETE" },
            "No se pudieron eliminar las notificaciones"
        );
    },

    aprobarNotificacion(id) {
        return requestJson(
            `${window.VehiAmb.API_URL}/notificaciones/${id}/aprobar`,
            { method: "POST" },
            "No se pudo aprobar el mantenimiento"
        );
    },

    rechazarNotificacion(id) {
        return requestJson(
            `${window.VehiAmb.API_URL}/notificaciones/${id}/rechazar`,
            { method: "POST" },
            "No se pudo rechazar el mantenimiento"
        );
    },

    getImportaciones(filters = {}) {
        const params = new URLSearchParams();

        if (filters.estado) params.set("estado", filters.estado);
        if (filters.periodo) params.set("periodo", filters.periodo);
        if (filters.page) params.set("page", filters.page);
        if (filters.limit) params.set("limit", filters.limit);

        const query = params.toString();

        return requestJson(
            `${window.VehiAmb.API_URL}/importaciones${query ? `?${query}` : ""}`,
            undefined,
            "No se pudieron cargar las importaciones"
        );
    },

    getImportacion(id) {
        return requestJson(`${window.VehiAmb.API_URL}/importaciones/${id}`, undefined, "No se pudo cargar la importacion");
    },

    getImportacionDetalle(id, filters = {}) {
        const params = new URLSearchParams();
        if (filters.accion) params.set("accion", filters.accion);
        if (filters.page) params.set("page", filters.page);
        if (filters.limit) params.set("limit", filters.limit);
        const query = params.toString();

        return requestJson(
            `${window.VehiAmb.API_URL}/importaciones/${id}/detalle${query ? `?${query}` : ""}`,
            undefined,
            "No se pudo cargar el detalle de la importacion"
        );
    },

    getImportacionIncidencias(id, filters = {}) {
        const params = new URLSearchParams();
        if (filters.resuelta !== undefined) params.set("resuelta", filters.resuelta);
        if (filters.page) params.set("page", filters.page);
        if (filters.limit) params.set("limit", filters.limit);
        const query = params.toString();

        return requestJson(
            `${window.VehiAmb.API_URL}/importaciones/${id}/incidencias${query ? `?${query}` : ""}`,
            undefined,
            "No se pudieron cargar las incidencias"
        );
    },

    resolverIncidenciaImportacion(id) {
        return requestJson(
            `${window.VehiAmb.API_URL}/importaciones/incidencias/${id}/resolver`,
            { method: "PATCH" },
            "No se pudo marcar la incidencia como resuelta"
        );
    },

    ejecutarImportacion({ periodo, desde, hasta, forzar } = {}) {
        return requestJson(
            `${window.VehiAmb.API_URL}/importaciones/ejecutar`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...(desde && hasta ? { desde, hasta } : { periodo }), forzar: Boolean(forzar) })
            },
            "No se pudo ejecutar la importacion"
        );
    },

    getImportacionesStatus() {
        return requestJson(`${window.VehiAmb.API_URL}/importaciones/status`, undefined, "No se pudo cargar el estado de importaciones");
    },

    getLogsAcceso(filters = {}) {
        const params = new URLSearchParams();
        if (filters.resultado) params.set("resultado", filters.resultado);
        if (filters.desde) params.set("desde", filters.desde);
        if (filters.hasta) params.set("hasta", filters.hasta);
        if (filters.search) params.set("search", filters.search);
        if (filters.page) params.set("page", filters.page);
        if (filters.limit) params.set("limit", filters.limit);
        const query = params.toString();

        return requestJson(
            `${window.VehiAmb.API_URL}/admin-logs/accesos${query ? `?${query}` : ""}`,
            undefined,
            "No se pudieron cargar los logs de acceso"
        );
    },

    getLogsRegistro(filters = {}) {
        const params = new URLSearchParams();
        if (filters.evento) params.set("evento", filters.evento);
        if (filters.desde) params.set("desde", filters.desde);
        if (filters.hasta) params.set("hasta", filters.hasta);
        if (filters.search) params.set("search", filters.search);
        if (filters.page) params.set("page", filters.page);
        if (filters.limit) params.set("limit", filters.limit);
        const query = params.toString();

        return requestJson(
            `${window.VehiAmb.API_URL}/admin-logs/registro${query ? `?${query}` : ""}`,
            undefined,
            "No se pudieron cargar los logs de registro"
        );
    },

    getLogsErrores(filters = {}) {
        const params = new URLSearchParams();
        if (filters.status_code) params.set("status_code", filters.status_code);
        if (filters.desde) params.set("desde", filters.desde);
        if (filters.hasta) params.set("hasta", filters.hasta);
        if (filters.search) params.set("search", filters.search);
        if (filters.page) params.set("page", filters.page);
        if (filters.limit) params.set("limit", filters.limit);
        const query = params.toString();

        return requestJson(
            `${window.VehiAmb.API_URL}/admin-logs/errores${query ? `?${query}` : ""}`,
            undefined,
            "No se pudieron cargar los logs de errores"
        );
    },

    getLogsNotificaciones(filters = {}) {
        const params = new URLSearchParams();
        if (filters.categoria) params.set("categoria", filters.categoria);
        if (filters.prioridad) params.set("prioridad", filters.prioridad);
        if (filters.estado) params.set("estado", filters.estado);
        if (filters.desde) params.set("desde", filters.desde);
        if (filters.hasta) params.set("hasta", filters.hasta);
        if (filters.search) params.set("search", filters.search);
        if (filters.page) params.set("page", filters.page);
        if (filters.limit) params.set("limit", filters.limit);
        const query = params.toString();

        return requestJson(
            `${window.VehiAmb.API_URL}/admin-logs/notificaciones${query ? `?${query}` : ""}`,
            undefined,
            "No se pudieron cargar las notificaciones"
        );
    },

    getMetricasAdmin(filters = {}) {
        const params = new URLSearchParams();
        if (filters.desde) params.set("desde", filters.desde);
        if (filters.hasta) params.set("hasta", filters.hasta);
        const query = params.toString();

        return requestJson(
            `${window.VehiAmb.API_URL}/admin-logs/metricas${query ? `?${query}` : ""}`,
            undefined,
            "No se pudieron cargar las métricas"
        );
    },

    getCostosVehiculos({ desde, hasta } = {}) {
        const params = new URLSearchParams();
        if (desde) params.set("desde", desde);
        if (hasta) params.set("hasta", hasta);
        const query = params.toString();

        return requestJson(
            `${window.VehiAmb.API_URL}/costos/vehiculos${query ? `?${query}` : ""}`,
            undefined,
            "No se pudieron cargar los costos por vehiculo"
        );
    },

    getCostosVehiculoKpis(placa, { desde, hasta } = {}) {
        const params = new URLSearchParams();
        if (desde) params.set("desde", desde);
        if (hasta) params.set("hasta", hasta);
        const query = params.toString();

        return requestJson(
            `${window.VehiAmb.API_URL}/costos/vehiculos/${encodeURIComponent(placa)}${query ? `?${query}` : ""}`,
            undefined,
            "No se pudieron cargar los indicadores del vehiculo"
        );
    },

    getCostosVehiculoGraficas(placa, { desde, hasta } = {}) {
        const params = new URLSearchParams();
        if (desde) params.set("desde", desde);
        if (hasta) params.set("hasta", hasta);
        const query = params.toString();

        return requestJson(
            `${window.VehiAmb.API_URL}/costos/vehiculos/${encodeURIComponent(placa)}/graficas${query ? `?${query}` : ""}`,
            undefined,
            "No se pudieron cargar las graficas del vehiculo"
        );
    },

    getCostosVehiculoFacturas(placa, filters = {}) {
        const params = new URLSearchParams();
        if (filters.desde) params.set("desde", filters.desde);
        if (filters.hasta) params.set("hasta", filters.hasta);
        if (filters.page) params.set("page", filters.page);
        if (filters.limit) params.set("limit", filters.limit);
        if (filters.search) params.set("search", filters.search);
        if (filters.orderBy) params.set("orderBy", filters.orderBy);
        if (filters.dir) params.set("dir", filters.dir);
        const query = params.toString();

        return requestJson(
            `${window.VehiAmb.API_URL}/costos/vehiculos/${encodeURIComponent(placa)}/facturas${query ? `?${query}` : ""}`,
            undefined,
            "No se pudieron cargar las facturas del vehiculo"
        );
    },

    getCostosConductores({ desde, hasta } = {}) {
        const params = new URLSearchParams();
        if (desde) params.set("desde", desde);
        if (hasta) params.set("hasta", hasta);
        const query = params.toString();

        return requestJson(
            `${window.VehiAmb.API_URL}/costos/conductores${query ? `?${query}` : ""}`,
            undefined,
            "No se pudieron cargar los costos por conductor"
        );
    },

    getCostosConductorKpis(conductorKey, { desde, hasta } = {}) {
        const params = new URLSearchParams();
        if (desde) params.set("desde", desde);
        if (hasta) params.set("hasta", hasta);
        const query = params.toString();

        return requestJson(
            `${window.VehiAmb.API_URL}/costos/conductores/${encodeURIComponent(conductorKey)}${query ? `?${query}` : ""}`,
            undefined,
            "No se pudieron cargar los indicadores del conductor"
        );
    },

    getCostosConductorGraficas(conductorKey, { desde, hasta } = {}) {
        const params = new URLSearchParams();
        if (desde) params.set("desde", desde);
        if (hasta) params.set("hasta", hasta);
        const query = params.toString();

        return requestJson(
            `${window.VehiAmb.API_URL}/costos/conductores/${encodeURIComponent(conductorKey)}/graficas${query ? `?${query}` : ""}`,
            undefined,
            "No se pudieron cargar las graficas del conductor"
        );
    },

    getCostosConductorFacturas(conductorKey, filters = {}) {
        const params = new URLSearchParams();
        if (filters.desde) params.set("desde", filters.desde);
        if (filters.hasta) params.set("hasta", filters.hasta);
        if (filters.page) params.set("page", filters.page);
        if (filters.limit) params.set("limit", filters.limit);
        if (filters.search) params.set("search", filters.search);
        if (filters.orderBy) params.set("orderBy", filters.orderBy);
        if (filters.dir) params.set("dir", filters.dir);
        const query = params.toString();

        return requestJson(
            `${window.VehiAmb.API_URL}/costos/conductores/${encodeURIComponent(conductorKey)}/facturas${query ? `?${query}` : ""}`,
            undefined,
            "No se pudieron cargar las facturas del conductor"
        );
    },

    getRepuestos(filters = {}) {
        const params = new URLSearchParams();
        if (filters.categoria) params.set("categoria", filters.categoria);
        if (filters.estado) params.set("estado", filters.estado);
        if (filters.search) params.set("search", filters.search);
        if (filters.sort) params.set("sort", filters.sort);
        if (filters.order) params.set("order", filters.order);
        if (filters.page) params.set("page", filters.page);
        if (filters.limit) params.set("limit", filters.limit);
        const query = params.toString();

        return requestJson(
            `${window.VehiAmb.API_URL}/repuestos${query ? `?${query}` : ""}`,
            undefined,
            "No se pudieron cargar los repuestos"
        );
    },

    getSiguienteCodigoRepuesto() {
        return requestJson(`${window.VehiAmb.API_URL}/repuestos/siguiente-codigo`, undefined, "No se pudo obtener el siguiente código");
    },

    buscarRepuestos(term) {
        const params = new URLSearchParams({ q: term });

        return requestJson(
            `${window.VehiAmb.API_URL}/repuestos/buscar?${params.toString()}`,
            undefined,
            "No se pudieron buscar repuestos"
        );
    },

    getRepuesto(id) {
        return requestJson(`${window.VehiAmb.API_URL}/repuestos/${id}`, undefined, "No se pudo cargar el repuesto");
    },

    createRepuesto(formData) {
        return requestJson(
            `${window.VehiAmb.API_URL}/repuestos`,
            { method: "POST", body: formData },
            "No se pudo guardar el repuesto"
        );
    },

    updateRepuesto(id, formData) {
        return requestJson(
            `${window.VehiAmb.API_URL}/repuestos/${id}`,
            { method: "PUT", body: formData },
            "No se pudo actualizar el repuesto"
        );
    },

    getStockImportaciones(filters = {}) {
        const params = new URLSearchParams();
        if (filters.estado) params.set("estado", filters.estado);
        if (filters.page) params.set("page", filters.page);
        if (filters.limit) params.set("limit", filters.limit);
        const query = params.toString();

        return requestJson(
            `${window.VehiAmb.API_URL}/stock-importaciones${query ? `?${query}` : ""}`,
            undefined,
            "No se pudieron cargar las importaciones de stock"
        );
    },

    ejecutarStockImportacion() {
        return requestJson(
            `${window.VehiAmb.API_URL}/stock-importaciones/ejecutar`,
            { method: "POST" },
            "No se pudo ejecutar la importacion de stock"
        );
    },

    getStockImportacionesStatus() {
        return requestJson(
            `${window.VehiAmb.API_URL}/stock-importaciones/status`,
            undefined,
            "No se pudo cargar el estado de importaciones de stock"
        );
    },

    getStockImportacion(id) {
        return requestJson(`${window.VehiAmb.API_URL}/stock-importaciones/${id}`, undefined, "No se pudo cargar la importacion de stock");
    },

    getStockImportacionDetalle(id, filters = {}) {
        const params = new URLSearchParams();
        if (filters.accion) params.set("accion", filters.accion);
        if (filters.codigo) params.set("codigo", filters.codigo);
        if (filters.page) params.set("page", filters.page);
        if (filters.limit) params.set("limit", filters.limit);
        const query = params.toString();

        return requestJson(
            `${window.VehiAmb.API_URL}/stock-importaciones/${id}/detalle${query ? `?${query}` : ""}`,
            undefined,
            "No se pudo cargar el detalle de la importacion de stock"
        );
    },

    getStockImportacionIncidencias(id, filters = {}) {
        const params = new URLSearchParams();
        if (filters.resuelta !== undefined) params.set("resuelta", filters.resuelta);
        if (filters.page) params.set("page", filters.page);
        if (filters.limit) params.set("limit", filters.limit);
        const query = params.toString();

        return requestJson(
            `${window.VehiAmb.API_URL}/stock-importaciones/${id}/incidencias${query ? `?${query}` : ""}`,
            undefined,
            "No se pudieron cargar las incidencias de stock"
        );
    },

    resolverIncidenciaStock(id) {
        return requestJson(
            `${window.VehiAmb.API_URL}/stock-importaciones/incidencias/${id}/resolver`,
            { method: "PATCH" },
            "No se pudo marcar la incidencia como resuelta"
        );
    },

    getRepuestoDisponibilidad(id) {
        return requestJson(
            `${window.VehiAmb.API_URL}/repuestos/${id}/disponibilidad`,
            undefined,
            "No se pudo consultar la disponibilidad del repuesto"
        );
    },

    getRepuestoEquivalencias(id) {
        return requestJson(
            `${window.VehiAmb.API_URL}/repuestos/${id}/equivalencias`,
            undefined,
            "No se pudieron cargar las equivalencias"
        );
    },

    createRepuestoEquivalencia(id, payload) {
        return requestJson(
            `${window.VehiAmb.API_URL}/repuestos/${id}/equivalencias`,
            { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
            "No se pudo agregar la equivalencia"
        );
    },

    deleteRepuestoEquivalencia(id, equivalenciaId) {
        return requestJson(
            `${window.VehiAmb.API_URL}/repuestos/${id}/equivalencias/${equivalenciaId}`,
            { method: "DELETE" },
            "No se pudo quitar la equivalencia"
        );
    },

    getVehiculoRepuestosSugeridos(vehiculoId, tipo = "cambio_aceite") {
        const params = new URLSearchParams({ tipo });
        return requestJson(
            `${window.VehiAmb.API_URL}/vehiculos/${vehiculoId}/repuestos-sugeridos?${params.toString()}`,
            undefined,
            "No se pudieron cargar los repuestos sugeridos"
        );
    },

    updateVehiculoRepuestosSugeridos(vehiculoId, payload) {
        return requestJson(
            `${window.VehiAmb.API_URL}/vehiculos/${vehiculoId}/repuestos-sugeridos`,
            { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
            "No se pudieron guardar los repuestos sugeridos"
        );
    },

    getMantenimientoRepuestos(mantenimientoId) {
        return requestJson(
            `${window.VehiAmb.API_URL}/mantenimientos/${mantenimientoId}/repuestos`,
            undefined,
            "No se pudo cargar el detalle de repuestos del mantenimiento"
        );
    },

    ejecutarConfigImport() {
        return requestJson(
            `${window.VehiAmb.API_URL}/config-import/vehiculos-repuestos`,
            { method: "POST" },
            "No se pudo ejecutar la importacion de configuracion"
        );
    },

    getConfigImportStatus() {
        return requestJson(
            `${window.VehiAmb.API_URL}/config-import/vehiculos-repuestos/status`,
            undefined,
            "No se pudo cargar el estado de la importacion de configuracion"
        );
    },

    getSimitEstadoFlota(filters = {}) {
        const params = new URLSearchParams();
        if (filters.estado_cartera) params.set("estado_cartera", filters.estado_cartera);
        if (filters.placa) params.set("placa", filters.placa);
        const query = params.toString();

        return requestJson(
            `${window.VehiAmb.API_URL}/simit/flota${query ? `?${query}` : ""}`,
            undefined,
            "No se pudo cargar el estado SIMIT de la flota"
        );
    },

    getSimitHistorialVehiculo(vehiculoId) {
        return requestJson(
            `${window.VehiAmb.API_URL}/simit/vehiculo/${vehiculoId}/historial`,
            undefined,
            "No se pudo cargar el historial de consultas SIMIT"
        );
    },

    getSimitConsultaDetalle(consultaId) {
        return requestJson(
            `${window.VehiAmb.API_URL}/simit/consultas/${consultaId}`,
            undefined,
            "No se pudo cargar el detalle de la consulta SIMIT"
        );
    },

    consultarSimitVehiculo(vehiculoId) {
        return requestJson(
            `${window.VehiAmb.API_URL}/simit/vehiculo/${vehiculoId}/consultar`,
            { method: "POST" },
            "No se pudo consultar el estado SIMIT del vehiculo"
        );
    },

    actualizarSimitFlota() {
        return requestJson(
            `${window.VehiAmb.API_URL}/simit/actualizar-flota`,
            { method: "POST" },
            "No se pudo actualizar el estado SIMIT de la flota"
        );
    },

    getSimitValorHistorico(dias = 30) {
        return requestJson(
            `${window.VehiAmb.API_URL}/simit/valor-historico?dias=${dias}`,
            undefined,
            "No se pudo cargar el valor histórico SIMIT"
        );
    },

    getSimitInfractorTop(limite = 5) {
        return requestJson(
            `${window.VehiAmb.API_URL}/simit/infractor-top?limite=${limite}`,
            undefined,
            "No se pudo cargar el infractor con más comparendos"
        );
    },

    getChecklistCatalogo() {
        return requestJson(
            `${window.VehiAmb.API_URL}/inspecciones/catalogo`,
            undefined,
            "No se pudo cargar el catálogo del checklist"
        );
    },

    getInspeccionesByVehicle(vehiculoId) {
        return requestJson(
            `${window.VehiAmb.API_URL}/inspecciones/vehiculo/${vehiculoId}`,
            undefined,
            "No se pudo cargar el historial de inspecciones"
        );
    },

    getInspeccionDetalle(inspeccionId) {
        return requestJson(
            `${window.VehiAmb.API_URL}/inspecciones/${inspeccionId}`,
            undefined,
            "No se pudo cargar el detalle de la inspección"
        );
    },

    crearInspeccion(vehiculoId, formData) {
        return requestJson(
            `${window.VehiAmb.API_URL}/inspecciones/vehiculo/${vehiculoId}`,
            { method: "POST", body: formData },
            "No se pudo guardar la inspección"
        );
    },

    getPreoperacionalCatalogo() {
        return requestJson(
            `${window.VehiAmb.API_URL}/preoperacionales/catalogo`,
            undefined,
            "No se pudo cargar el catálogo del preoperacional"
        );
    },

    getPreoperacionalesByVehicle(vehiculoId) {
        return requestJson(
            `${window.VehiAmb.API_URL}/preoperacionales/vehiculo/${vehiculoId}`,
            undefined,
            "No se pudo cargar el historial de preoperacionales"
        );
    },

    getPreoperacionalDetalle(preoperacionalId) {
        return requestJson(
            `${window.VehiAmb.API_URL}/preoperacionales/${preoperacionalId}`,
            undefined,
            "No se pudo cargar el detalle del preoperacional"
        );
    },

    crearPreoperacional(vehiculoId, formData) {
        return requestJson(
            `${window.VehiAmb.API_URL}/preoperacionales/vehiculo/${vehiculoId}`,
            { method: "POST", body: formData },
            "No se pudo guardar el preoperacional"
        );
    },

    getConductores(filters = {}) {
        const params = new URLSearchParams();
        if (filters.estado) params.set("estado", filters.estado);
        if (filters.search) params.set("search", filters.search);
        if (filters.page) params.set("page", filters.page);
        if (filters.limit) params.set("limit", filters.limit);
        const query = params.toString();

        return requestJson(
            `${window.VehiAmb.API_URL}/conductores${query ? `?${query}` : ""}`,
            undefined,
            "No se pudieron cargar los conductores"
        );
    },

    getConductoresCatalogo() {
        return requestJson(`${window.VehiAmb.API_URL}/conductores/catalogo`, undefined, "No se pudieron cargar los conductores");
    },

    getConductor(id) {
        return requestJson(`${window.VehiAmb.API_URL}/conductores/${id}`, undefined, "No se pudo cargar el conductor");
    },

    createConductor(payload) {
        return requestJson(
            `${window.VehiAmb.API_URL}/conductores`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            },
            "No se pudo guardar el conductor"
        );
    },

    updateConductor(id, payload) {
        return requestJson(
            `${window.VehiAmb.API_URL}/conductores/${id}`,
            {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            },
            "No se pudo actualizar el conductor"
        );
    },

    getConductorLicencias(conductorId) {
        return requestJson(
            `${window.VehiAmb.API_URL}/conductores/${conductorId}/licencias`,
            undefined,
            "No se pudieron cargar las licencias del conductor"
        );
    },

    createConductorLicencia(conductorId, formData) {
        return requestJson(
            `${window.VehiAmb.API_URL}/conductores/${conductorId}/licencias`,
            { method: "POST", body: formData },
            "No se pudo agregar la licencia"
        );
    },

    updateConductorLicencia(id, formData) {
        return requestJson(
            `${window.VehiAmb.API_URL}/conductores/licencias/${id}`,
            { method: "PUT", body: formData },
            "No se pudo actualizar la licencia"
        );
    },

    deleteConductorLicencia(id) {
        return requestJson(
            `${window.VehiAmb.API_URL}/conductores/licencias/${id}`,
            { method: "DELETE" },
            "No se pudo eliminar la licencia"
        );
    },

    getEntregaChecklistCatalogo() {
        return requestJson(
            `${window.VehiAmb.API_URL}/entregas-recibidas/catalogo`,
            undefined,
            "No se pudo cargar el catálogo del checklist"
        );
    },

    getEntregaUsuariosDisponibles() {
        return requestJson(
            `${window.VehiAmb.API_URL}/entregas-recibidas/usuarios-disponibles`,
            undefined,
            "No se pudieron cargar los usuarios disponibles"
        );
    },

    getEntregasByVehicle(vehiculoId) {
        return requestJson(
            `${window.VehiAmb.API_URL}/entregas-recibidas/vehiculo/${vehiculoId}`,
            undefined,
            "No se pudo cargar el historial de entregas y recibidas"
        );
    },

    getEntregaDetalle(entregaId) {
        return requestJson(
            `${window.VehiAmb.API_URL}/entregas-recibidas/${entregaId}`,
            undefined,
            "No se pudo cargar el detalle del acta"
        );
    },

    crearEntregaRecibida(vehiculoId, formData) {
        return requestJson(
            `${window.VehiAmb.API_URL}/entregas-recibidas/vehiculo/${vehiculoId}`,
            { method: "POST", body: formData },
            "No se pudo guardar el acta de vehículo"
        );
    },

    getViajesByVehicle(vehiculoId) {
        return requestJson(
            `${window.VehiAmb.API_URL}/viajes/vehiculo/${vehiculoId}`,
            undefined,
            "No se pudo cargar el historial de viajes"
        );
    },

    getUltimoViajeControl() {
        return requestJson(
            `${window.VehiAmb.API_URL}/viajes/ultimo-control`,
            undefined,
            "No se pudo cargar tu último viaje"
        );
    },

    getAsignacionHoy() {
        return requestJson(
            `${window.VehiAmb.API_URL}/viajes/asignacion-hoy`,
            undefined,
            "No se pudo cargar tu asignación de hoy"
        );
    },

    getAsignacionManana() {
        return requestJson(
            `${window.VehiAmb.API_URL}/viajes/asignacion-manana`,
            undefined,
            "No se pudo cargar tu asignación de mañana"
        );
    },

    getViajesRecientesEmpresa(filters = {}) {
        const params = new URLSearchParams();
        if (filters.fecha_desde) params.set("fecha_desde", filters.fecha_desde);
        if (filters.fecha_hasta) params.set("fecha_hasta", filters.fecha_hasta);
        const query = params.toString();

        return requestJson(
            `${window.VehiAmb.API_URL}/viajes/recientes-empresa${query ? `?${query}` : ""}`,
            undefined,
            "No se pudo cargar el historial de viajes"
        );
    },

    getResumenViaje(viajeId) {
        return requestJson(
            `${window.VehiAmb.API_URL}/viajes/${viajeId}/resumen`,
            undefined,
            "No se pudo cargar el resumen del viaje"
        );
    },

    crearViaje(payload) {
        return requestJson(
            `${window.VehiAmb.API_URL}/viajes`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            },
            "No se pudo registrar el viaje"
        );
    },

    getMisViajesRecientes() {
        return requestJson(`${window.VehiAmb.API_URL}/viajes`, undefined, "No se pudo cargar el historial de viajes");
    },

    getRutasCatalogo() {
        return requestJson(`${window.VehiAmb.API_URL}/asignaciones/rutas`, undefined, "No se pudo cargar el catálogo de rutas");
    },

    getAsignacionesPorFecha(fecha) {
        return requestJson(
            `${window.VehiAmb.API_URL}/asignaciones?fecha=${encodeURIComponent(fecha)}`,
            undefined,
            "No se pudieron cargar las asignaciones"
        );
    },

    getVehiculosBloqueadosEnFecha(fecha) {
        return requestJson(
            `${window.VehiAmb.API_URL}/asignaciones/vehiculos-bloqueados?fecha=${encodeURIComponent(fecha)}`,
            undefined,
            "No se pudo revisar la disponibilidad de vehículos"
        );
    },

    crearAsignacion(payload) {
        return requestJson(
            `${window.VehiAmb.API_URL}/asignaciones`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            },
            "No se pudo guardar la asignación"
        );
    },

    actualizarAsignacion(id, payload) {
        return requestJson(
            `${window.VehiAmb.API_URL}/asignaciones/${id}`,
            {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            },
            "No se pudo actualizar la asignación"
        );
    },

    eliminarAsignacion(id) {
        return requestJson(
            `${window.VehiAmb.API_URL}/asignaciones/${id}`,
            { method: "DELETE" },
            "No se pudo eliminar la asignación"
        );
    },

    getCatalogoBotiquin() {
        return requestJson(
            `${window.VehiAmb.API_URL}/seguridad/botiquin/catalogo`,
            undefined,
            "No se pudo cargar el listado de insumos del botiquín"
        );
    },

    getExtintores() {
        return requestJson(
            `${window.VehiAmb.API_URL}/seguridad/extintores`,
            undefined,
            "No se pudieron cargar los extintores"
        );
    },

    crearExtintor(payload) {
        return requestJson(
            `${window.VehiAmb.API_URL}/seguridad/extintores`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            },
            "No se pudo guardar el extintor"
        );
    },

    actualizarExtintor(id, payload) {
        return requestJson(
            `${window.VehiAmb.API_URL}/seguridad/extintores/${id}`,
            {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            },
            "No se pudo actualizar el extintor"
        );
    },

    eliminarExtintor(id) {
        return requestJson(
            `${window.VehiAmb.API_URL}/seguridad/extintores/${id}`,
            { method: "DELETE" },
            "No se pudo eliminar el extintor"
        );
    },

    getInspeccionesBotiquin(filtros = {}) {
        const params = new URLSearchParams();
        if (filtros.vehiculo_id) params.set("vehiculo_id", filtros.vehiculo_id);
        if (filtros.fecha_desde) params.set("fecha_desde", filtros.fecha_desde);
        if (filtros.fecha_hasta) params.set("fecha_hasta", filtros.fecha_hasta);

        const query = params.toString();
        return requestJson(
            `${window.VehiAmb.API_URL}/seguridad/botiquin${query ? `?${query}` : ""}`,
            undefined,
            "No se pudieron cargar las inspecciones de botiquín"
        );
    },

    getInspeccionBotiquin(id) {
        return requestJson(
            `${window.VehiAmb.API_URL}/seguridad/botiquin/${id}`,
            undefined,
            "No se pudo cargar la inspección de botiquín"
        );
    },

    crearInspeccionBotiquin(payload) {
        return requestJson(
            `${window.VehiAmb.API_URL}/seguridad/botiquin`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            },
            "No se pudo guardar la inspección de botiquín"
        );
    },

    eliminarInspeccionBotiquin(id) {
        return requestJson(
            `${window.VehiAmb.API_URL}/seguridad/botiquin/${id}`,
            { method: "DELETE" },
            "No se pudo eliminar la inspección de botiquín"
        );
    },

    getCatalogoHerramientas() {
        return requestJson(
            `${window.VehiAmb.API_URL}/seguridad/herramientas/catalogo`,
            undefined,
            "No se pudo cargar el listado de herramientas"
        );
    },

    getInspeccionesHerramientas(filtros = {}) {
        const params = new URLSearchParams();
        if (filtros.vehiculo_id) params.set("vehiculo_id", filtros.vehiculo_id);
        if (filtros.fecha_desde) params.set("fecha_desde", filtros.fecha_desde);
        if (filtros.fecha_hasta) params.set("fecha_hasta", filtros.fecha_hasta);

        const query = params.toString();
        return requestJson(
            `${window.VehiAmb.API_URL}/seguridad/herramientas${query ? `?${query}` : ""}`,
            undefined,
            "No se pudieron cargar las inspecciones de kit de herramientas"
        );
    },

    getInspeccionHerramientas(id) {
        return requestJson(
            `${window.VehiAmb.API_URL}/seguridad/herramientas/${id}`,
            undefined,
            "No se pudo cargar la inspección de kit de herramientas"
        );
    },

    crearInspeccionHerramientas(payload) {
        return requestJson(
            `${window.VehiAmb.API_URL}/seguridad/herramientas`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            },
            "No se pudo guardar la inspección de kit de herramientas"
        );
    },

    eliminarInspeccionHerramientas(id) {
        return requestJson(
            `${window.VehiAmb.API_URL}/seguridad/herramientas/${id}`,
            { method: "DELETE" },
            "No se pudo eliminar la inspección de kit de herramientas"
        );
    }
};
