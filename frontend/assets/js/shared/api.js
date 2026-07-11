window.VehiAmb = window.VehiAmb || {};

window.VehiAmb.API_URL = window.VehiAmb.API_URL || "/api";

window.VehiAmb.ASSET_BASE_URL = window.VehiAmb.ASSET_BASE_URL || "";

async function requestJson(url, options, errorMessage) {
    const sessionToken = window.VehiAmb.auth?.getToken?.() || "";
    const headers = new Headers(options?.headers || {});

    if (sessionToken) {
        headers.set("Authorization", `Bearer ${sessionToken}`);
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

    return response.json();
}

window.VehiAmb.api = {
    getAssetUrl(path) {
        if (!path) return "";
        if (path.startsWith("http://") || path.startsWith("https://")) return path;
        return `${window.VehiAmb.ASSET_BASE_URL}${path}`;
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

    getMantenimiento(id) {
        return requestJson(`${window.VehiAmb.API_URL}/mantenimientos/${id}`, undefined, "No se pudo cargar el mantenimiento");
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

    getUsuarios() {
        return requestJson(`${window.VehiAmb.API_URL}/usuarios`, undefined, "No se pudieron cargar los usuarios");
    },

    createUsuario(payload) {
        return requestJson(
            `${window.VehiAmb.API_URL}/usuarios`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            },
            "No se pudo crear el usuario"
        );
    },

    updateUsuario(id, payload) {
        return requestJson(
            `${window.VehiAmb.API_URL}/usuarios/${id}`,
            {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
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

    eliminarNotificacionesLeidas() {
        return requestJson(
            `${window.VehiAmb.API_URL}/notificaciones/leidas`,
            { method: "DELETE" },
            "No se pudieron eliminar las notificaciones leidas"
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

    ejecutarImportacion({ periodo, desde, hasta } = {}) {
        return requestJson(
            `${window.VehiAmb.API_URL}/importaciones/ejecutar`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(desde && hasta ? { desde, hasta } : { periodo })
            },
            "No se pudo ejecutar la importacion"
        );
    },

    getImportacionesStatus() {
        return requestJson(`${window.VehiAmb.API_URL}/importaciones/status`, undefined, "No se pudo cargar el estado de importaciones");
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

    getRepuestos(filters = {}) {
        const params = new URLSearchParams();
        if (filters.categoria) params.set("categoria", filters.categoria);
        if (filters.estado) params.set("estado", filters.estado);
        if (filters.search) params.set("search", filters.search);
        if (filters.page) params.set("page", filters.page);
        if (filters.limit) params.set("limit", filters.limit);
        const query = params.toString();

        return requestJson(
            `${window.VehiAmb.API_URL}/repuestos${query ? `?${query}` : ""}`,
            undefined,
            "No se pudieron cargar los repuestos"
        );
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

    createRepuesto(payload) {
        return requestJson(
            `${window.VehiAmb.API_URL}/repuestos`,
            { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
            "No se pudo guardar el repuesto"
        );
    },

    updateRepuesto(id, payload) {
        return requestJson(
            `${window.VehiAmb.API_URL}/repuestos/${id}`,
            { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
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

    getConfigImportaciones(filters = {}) {
        const params = new URLSearchParams();
        if (filters.page) params.set("page", filters.page);
        if (filters.limit) params.set("limit", filters.limit);
        const query = params.toString();

        return requestJson(
            `${window.VehiAmb.API_URL}/config-import/vehiculos-repuestos${query ? `?${query}` : ""}`,
            undefined,
            "No se pudieron cargar las importaciones de configuracion"
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
    }
};
