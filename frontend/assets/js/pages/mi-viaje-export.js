(function () {
    const APP_NAME = "Vehiamb";
    const MARGIN_X = 40;
    const ROW_HEIGHT = 18;
    const ROW_LINE_HEIGHT = 12;
    const ROJO_MAL = [178, 31, 45];
    const ROJO_MAL_FONDO = [252, 233, 235];
    const FOOTER_TEXT = (nombreEmpresa) => (nombreEmpresa ? `Generado por ${APP_NAME} para ${nombreEmpresa}` : `Generado por ${APP_NAME}`);

    function safe(value, fallback = "No registrado") {
        if (value === null || value === undefined || value === "") return fallback;
        return String(value);
    }

    // Fecha y hora cortas para las celdas de la tabla (el formatDateForPdf/
    // formatDateForExcel compartidos solo dan la fecha, aqui interesa tambien
    // la hora del viaje).
    function formatFechaHoraCorta(value) {
        if (!value) return "No registrado";
        const fecha = new Date(value);
        if (Number.isNaN(fecha.getTime())) return "No registrado";
        const dia = String(fecha.getDate()).padStart(2, "0");
        const mes = String(fecha.getMonth() + 1).padStart(2, "0");
        const hora = String(fecha.getHours()).padStart(2, "0");
        const minutos = String(fecha.getMinutes()).padStart(2, "0");
        return `${dia}/${mes}/${fecha.getFullYear()} ${hora}:${minutos}`;
    }

    // Solo la hora (para las columnas "Hora inspección"/"Hora preoperacional"
    // del PDF) -- a diferencia de formatFechaHoraCorta, que trae fecha y hora
    // completas para la columna "Fecha y hora" del viaje en si.
    function formatHora(value) {
        if (!value) return "No registrado";
        const fecha = new Date(value);
        if (Number.isNaN(fecha.getTime())) return "No registrado";
        return fecha.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
    }

    function preoperacionalTexto(item) {
        if (!item.preoperacional_realizado) return "No se registró";
        return item.preoperacional_items_mal > 0
            ? `${item.preoperacional_items_mal} ítem(s) en "No"`
            : "Sin novedades";
    }

    function inspeccionTexto(item) {
        if (!item.inspeccion_realizada) return "No se registró";
        return item.inspeccion_items_mal > 0
            ? `${item.inspeccion_items_mal} ítem(s) en mal estado`
            : "Sin novedades";
    }

    function buildFileName(extension) {
        const fecha = new Date().toISOString().slice(0, 10);
        return `Viajes_${fecha}.${extension}`;
    }

    function describeFiltros(filtros) {
        const partes = [];
        if (filtros.fecha_desde) partes.push(`Desde: ${window.VehiAmb.pdfExport.formatDateForPdf(filtros.fecha_desde)}`);
        if (filtros.fecha_hasta) partes.push(`Hasta: ${window.VehiAmb.pdfExport.formatDateForPdf(filtros.fecha_hasta)}`);
        return partes.length ? partes.join("   |   ") : "Sin filtros aplicados (viajes más recientes)";
    }

    // Columnas del Excel (resumen con texto tipo "Sin novedades"/"No se
    // registró") -- sin cambios, siguen siendo las de siempre.
    const COLUMN_WIDTHS = [
        { key: "fecha", label: "Fecha y hora", width: 85 },
        { key: "placa", label: "Placa", width: 50 },
        { key: "vehiculo", label: "Vehículo", width: 95 },
        { key: "conductor", label: "Conductor", width: 105 },
        { key: "destino", label: "Destino", width: 175 },
        { key: "preoperacional", label: "Preoperacional", width: 126 },
        { key: "inspeccion", label: "Inspección", width: 126 }
    ];

    // Columnas del PDF: mismas 5 primeras que el Excel, pero las ultimas dos
    // muestran la HORA exacta de cada registro en vez de un resumen en texto
    // -- por eso van en un arreglo aparte (el Excel no cambia).
    const PDF_COLUMN_WIDTHS = [
        { key: "fecha", label: "Fecha y hora", width: 85 },
        { key: "placa", label: "Placa", width: 50 },
        { key: "vehiculo", label: "Vehículo", width: 95 },
        { key: "conductor", label: "Conductor", width: 105 },
        { key: "destino", label: "Destino", width: 175 },
        { key: "inspeccion", label: "Hora inspección preventiva", width: 126 },
        { key: "preoperacional", label: "Hora preoperacional", width: 126 }
    ];

    function buildColumns(columnDefs) {
        let x = MARGIN_X;
        return columnDefs.map((column) => {
            const positioned = { ...column, x };
            x += column.width;
            return positioned;
        });
    }

    async function addHeader(doc, layout, filtros, totalRegistros, branding, titulo) {
        if (branding?.logo) {
            const maxWidth = 90;
            const maxHeight = 47;
            const scale = Math.min(maxWidth / branding.logo.width, maxHeight / branding.logo.height);
            doc.addImage(branding.logo.dataUrl, "JPEG", MARGIN_X, layout.y, branding.logo.width * scale, branding.logo.height * scale);
        }

        doc.setFontSize(16);
        doc.setFont(undefined, "bold");
        doc.setTextColor(24, 32, 43);
        doc.text(titulo, layout.pageWidth - MARGIN_X, layout.y + 18, { align: "right" });
        doc.setFontSize(10);
        doc.setFont(undefined, "normal");
        doc.setTextColor(105, 115, 134);
        doc.text(APP_NAME, layout.pageWidth - MARGIN_X, layout.y + 34, { align: "right" });
        doc.setTextColor(24, 32, 43);

        layout.y += 64;
        doc.setDrawColor(220, 226, 234);
        doc.line(MARGIN_X, layout.y, layout.pageWidth - MARGIN_X, layout.y);
        layout.y += 20;

        doc.setFontSize(9);
        doc.setFont(undefined, "bold");
        doc.text("Filtros aplicados:", MARGIN_X, layout.y);
        doc.setFont(undefined, "normal");
        const filtrosMaxWidth = layout.pageWidth - MARGIN_X * 2 - 90;
        const filtrosLines = doc.splitTextToSize(describeFiltros(filtros), filtrosMaxWidth);
        doc.text(filtrosLines, MARGIN_X + 90, layout.y);
        layout.y += Math.max(16, filtrosLines.length * ROW_LINE_HEIGHT + 4);

        doc.setFont(undefined, "bold");
        doc.text("Total de registros:", MARGIN_X, layout.y);
        doc.setFont(undefined, "normal");
        doc.text(String(totalRegistros), MARGIN_X + 90, layout.y);
        layout.y += 20;
    }

    function addTableHeader(doc, layout, columns) {
        doc.setFontSize(9);
        doc.setFont(undefined, "bold");
        doc.setFillColor(248, 250, 252);
        doc.rect(MARGIN_X, layout.y - 12, layout.pageWidth - MARGIN_X * 2, ROW_HEIGHT, "F");

        columns.forEach((column) => {
            doc.text(column.label, column.x, layout.y);
        });

        layout.y += 6;
        doc.setDrawColor(220, 226, 234);
        doc.line(MARGIN_X, layout.y, layout.pageWidth - MARGIN_X, layout.y);
        layout.y += 14;
        doc.setFont(undefined, "normal");
    }

    // Pagina 1 del PDF: consolidado uno a uno de viajes/conductores, con la
    // HORA (no un resumen en texto) de su inspeccion preventiva y su
    // preoperacional -- el detalle item por item va en la hoja propia de
    // cada viaje (ver addDetallePorViaje).
    function addResumenTabla(doc, layout, bottomLimit, items) {
        const columns = buildColumns(PDF_COLUMN_WIDTHS);
        addTableHeader(doc, layout, columns);

        items.forEach((item) => {
            if (layout.y > bottomLimit) {
                doc.addPage();
                layout.y = 40;
                addTableHeader(doc, layout, columns);
            }

            const vehiculo = `${item.vehiculo_marca || ""} ${item.vehiculo_modelo || ""}`.trim();
            const fila = {
                fecha: formatFechaHoraCorta(item.creado_en),
                placa: safe(item.vehiculo_placa, "Sin vehículo"),
                vehiculo: safe(vehiculo),
                conductor: safe(item.usuario_nombre, "Sin conductor"),
                destino: safe(item.destino),
                inspeccion: formatHora(item.inspeccion_fecha),
                preoperacional: formatHora(item.preoperacional_fecha)
            };

            const columnLines = columns.map((column) => doc.splitTextToSize(String(fila[column.key]), column.width - 6));
            const maxLines = Math.max(1, ...columnLines.map((lines) => lines.length));
            const rowHeight = Math.max(ROW_HEIGHT, maxLines * ROW_LINE_HEIGHT + 6);

            columns.forEach((column, index) => {
                doc.text(columnLines[index], column.x, layout.y);
            });

            layout.y += rowHeight;
        });
    }

    // Encabezado de seccion en banda de color (una para inspeccion, otra para
    // preoperacional) -- la "division clara" entre las dos: cada una con su
    // propio color e identidad visual, nunca mezcladas en el mismo bloque.
    function addSeccionTitulo(doc, layout, bottomLimit, { titulo, color, subtitulo }) {
        if (layout.y + ROW_HEIGHT > bottomLimit) {
            doc.addPage();
            layout.y = 40;
        }

        doc.setFillColor(...color);
        doc.rect(MARGIN_X, layout.y - 12, layout.pageWidth - MARGIN_X * 2, ROW_HEIGHT, "F");
        doc.setFontSize(10.5);
        doc.setFont(undefined, "bold");
        doc.setTextColor(24, 32, 43);
        doc.text(titulo, MARGIN_X + 10, layout.y);
        doc.setFontSize(8.5);
        doc.setFont(undefined, "normal");
        doc.setTextColor(105, 115, 134);
        doc.text(subtitulo, layout.pageWidth - MARGIN_X - 10, layout.y, { align: "right" });
        doc.setTextColor(24, 32, 43);
        layout.y += 20;
    }

    // Mini-tabla de 3 columnas (Ítem | Resultado | Observación) reutilizada
    // tanto para preoperacional (respuesta si/no) como para inspección
    // (estado bien/mal) -- el resultado en mal estado se resalta en rojo
    // para que salte a la vista sin tener que leer cada fila.
    function addMiniTabla(doc, layout, bottomLimit, filas) {
        const columnas = [
            { x: MARGIN_X + 10, width: 300 },
            { x: MARGIN_X + 320, width: 70 },
            { x: MARGIN_X + 400, width: layout.pageWidth - MARGIN_X - (MARGIN_X + 400) }
        ];

        filas.forEach((fila) => {
            const columnLines = [
                doc.splitTextToSize(fila.item, columnas[0].width - 6),
                doc.splitTextToSize(fila.resultado, columnas[1].width - 6),
                doc.splitTextToSize(fila.observacion || "--", columnas[2].width - 6)
            ];
            const maxLines = Math.max(1, ...columnLines.map((lines) => lines.length));
            const rowHeight = Math.max(14, maxLines * ROW_LINE_HEIGHT + 4);

            if (layout.y + rowHeight > bottomLimit) {
                doc.addPage();
                layout.y = 40;
            }

            if (fila.mal) {
                doc.setFillColor(...ROJO_MAL_FONDO);
                doc.rect(MARGIN_X + 8, layout.y - 10, layout.pageWidth - MARGIN_X * 2 - 16, rowHeight, "F");
            }

            doc.setFontSize(8.5);
            doc.setFont(undefined, "normal");
            doc.setTextColor(24, 32, 43);
            doc.text(columnLines[0], columnas[0].x, layout.y);
            doc.setTextColor(...(fila.mal ? ROJO_MAL : [24, 32, 43]));
            doc.setFont(undefined, fila.mal ? "bold" : "normal");
            doc.text(columnLines[1], columnas[1].x, layout.y);
            doc.setFont(undefined, "normal");
            doc.setTextColor(24, 32, 43);
            doc.text(columnLines[2], columnas[2].x, layout.y);

            layout.y += rowHeight;
        });

        layout.y += 10;
    }

    // Combina el titulo de seccion con su mini-tabla (o el aviso de "no
    // registrado" cuando no aplica) -- una llamada por seccion en
    // addDetallePorViaje, una para inspeccion y otra para preoperacional.
    function addSeccion(doc, layout, bottomLimit, { titulo, color, fechaRegistro, filas }) {
        addSeccionTitulo(doc, layout, bottomLimit, {
            titulo,
            color,
            subtitulo: fechaRegistro ? `Registrado a las ${formatHora(fechaRegistro)}` : "No registrado"
        });

        if (!filas.length) {
            doc.setFontSize(9);
            doc.setFont(undefined, "italic");
            doc.setTextColor(105, 115, 134);
            doc.text(`El conductor no registró ${titulo.toLowerCase()} en este viaje.`, MARGIN_X + 10, layout.y);
            doc.setFont(undefined, "normal");
            doc.setTextColor(24, 32, 43);
            layout.y += 20;
            return;
        }

        addMiniTabla(doc, layout, bottomLimit, filas);
    }

    const AZUL_SECCION = [219, 234, 248];
    const VERDE_SECCION = [216, 240, 223];

    // Pagina 2 en adelante: una hoja POR VIAJE (doc.addPage() SIEMPRE antes
    // de cada uno, a diferencia del comportamiento anterior que solo saltaba
    // de pagina si no cabia) -- se pidio explicitamente que cada uno tenga su
    // propia hoja, con la inspeccion preventiva y el preoperacional en
    // secciones bien separadas. A diferencia del filtro "conDetalle" de
    // antes, ahora se incluyen TODOS los viajes (no solo los que registraron
    // algo): cada fila de la pagina 1 tiene su hoja de detalle correspondiente,
    // mostrando "No registrado" cuando aplique en vez de omitir el viaje.
    function addDetallePorViaje(doc, layout, bottomLimit, items) {
        items.forEach((item) => {
            doc.addPage();
            layout.y = 40;

            const vehiculo = `${item.vehiculo_marca || ""} ${item.vehiculo_modelo || ""}`.trim();
            doc.setFontSize(14);
            doc.setFont(undefined, "bold");
            doc.setTextColor(24, 32, 43);
            doc.text(safe(item.usuario_nombre, "Sin conductor"), MARGIN_X, layout.y);
            doc.setFontSize(9.5);
            doc.setFont(undefined, "normal");
            doc.setTextColor(105, 115, 134);
            doc.text(
                `${safe(item.vehiculo_placa, "Sin vehículo")} · ${safe(vehiculo)} · ${safe(item.destino)} · ${formatFechaHoraCorta(item.creado_en)}`,
                MARGIN_X,
                layout.y + 16
            );
            doc.setTextColor(24, 32, 43);
            layout.y += 34;
            doc.setDrawColor(220, 226, 234);
            doc.line(MARGIN_X, layout.y, layout.pageWidth - MARGIN_X, layout.y);
            layout.y += 20;

            addSeccion(doc, layout, bottomLimit, {
                titulo: "Inspección preventiva",
                color: AZUL_SECCION,
                fechaRegistro: item.inspeccion_fecha,
                filas: (item.inspeccion_items || []).map((detalleItem) => ({
                    item: detalleItem.item_label,
                    resultado: detalleItem.estado === "mal" ? "Mal estado" : "Bien",
                    observacion: detalleItem.comentario,
                    mal: detalleItem.estado === "mal"
                }))
            });

            layout.y += 14;

            addSeccion(doc, layout, bottomLimit, {
                titulo: "Preoperacional",
                color: VERDE_SECCION,
                fechaRegistro: item.preoperacional_fecha,
                filas: (item.preoperacional_items || []).map((detalleItem) => ({
                    item: detalleItem.item_label,
                    resultado: detalleItem.respuesta === "no" ? "No" : "Sí",
                    observacion: detalleItem.observacion,
                    mal: detalleItem.respuesta === "no"
                }))
            });
        });
    }

    async function addFooter(doc, branding) {
        const pageCount = doc.internal.getNumberOfPages();
        const generado = FOOTER_TEXT(branding?.nombreEmpresa);
        const pageWidth = doc.internal.pageSize.getWidth();
        const membrete = await window.VehiAmb.pdfExport.getMembreteFooterImage();

        for (let page = 1; page <= pageCount; page += 1) {
            doc.setPage(page);
            const pageHeight = doc.internal.pageSize.getHeight();
            doc.setFontSize(8);
            doc.setTextColor(120, 128, 140);

            if (membrete) {
                const imgWidth = pageWidth - MARGIN_X * 2;
                const imgHeight = imgWidth / (membrete.width / membrete.height);
                doc.text(generado, MARGIN_X, pageHeight - imgHeight - 10);
                doc.text(`Página ${page} de ${pageCount}`, pageWidth - MARGIN_X, pageHeight - imgHeight - 10, { align: "right" });
                doc.addImage(membrete.dataUrl, "JPEG", MARGIN_X, pageHeight - imgHeight, imgWidth, imgHeight);
            } else {
                doc.text(generado, MARGIN_X, pageHeight - 20);
                doc.text(`Página ${page} de ${pageCount}`, pageWidth - MARGIN_X, pageHeight - 20, { align: "right" });
            }
        }
    }

    async function exportViajesPdf(items, filtros = {}) {
        if (!items || !items.length) {
            throw new Error("No hay viajes para exportar con los filtros actuales");
        }

        const doc = await window.VehiAmb.pdfExport.createDocument({ orientation: "landscape" });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const bottomLimit = pageHeight - 130;
        const branding = await window.VehiAmb.pdfExport.getEmpresaBranding();

        let y = 40;
        const layout = {
            get y() { return y; },
            set y(value) { y = value; },
            pageWidth
        };

        await addHeader(doc, layout, filtros, items.length, branding, "Reporte de viajes");
        addResumenTabla(doc, layout, bottomLimit, items);
        addDetallePorViaje(doc, layout, bottomLimit, items);

        await addFooter(doc, branding);

        doc.save(buildFileName("pdf"));
    }

    async function exportViajesExcel(items, filtros = {}) {
        if (!items || !items.length) {
            throw new Error("No hay viajes para exportar con los filtros actuales");
        }

        const excel = window.VehiAmb.excelExport;
        const branding = await window.VehiAmb.pdfExport.getEmpresaBranding();
        const columnCount = COLUMN_WIDTHS.length;

        const workbook = await excel.createWorkbook();
        const sheet = workbook.addWorksheet("Viajes");
        excel.setColumnWidths(sheet, COLUMN_WIDTHS.map((column) => Math.round(column.width / 6)));

        excel.addTitleBar(sheet, {
            title: "Reporte de viajes",
            subtitle: APP_NAME,
            columnCount,
            logo: branding?.logo
        });

        excel.addLabelValueRow(sheet, "Filtros aplicados:", describeFiltros(filtros));
        excel.addLabelValueRow(sheet, "Total de registros:", items.length);
        sheet.addRow([]);

        excel.addTableHeaderRow(sheet, COLUMN_WIDTHS.map((column) => column.label));

        items.forEach((item, index) => {
            const vehiculo = `${item.vehiculo_marca || ""} ${item.vehiculo_modelo || ""}`.trim();

            excel.addTableDataRow(
                sheet,
                [
                    formatFechaHoraCorta(item.creado_en),
                    safe(item.vehiculo_placa, "Sin vehículo"),
                    safe(vehiculo),
                    safe(item.usuario_nombre, "Sin conductor"),
                    safe(item.destino),
                    preoperacionalTexto(item),
                    inspeccionTexto(item)
                ],
                { band: index % 2 === 1 }
            );
        });

        excel.addFooterRow(sheet, FOOTER_TEXT(branding?.nombreEmpresa), columnCount);

        // Segunda hoja, una fila por cada item de preoperacional/inspeccion
        // de todos los viajes -- mas util en Excel para filtrar/ordenar que
        // repetir el bloque por viaje del PDF.
        const detalleColumnas = [
            { label: "Fecha y hora", width: 18 },
            { label: "Placa", width: 10 },
            { label: "Conductor", width: 22 },
            { label: "Tipo", width: 16 },
            { label: "Ítem", width: 40 },
            { label: "Resultado", width: 14 },
            { label: "Observación", width: 40 }
        ];

        const detalleSheet = workbook.addWorksheet("Detalle");
        excel.setColumnWidths(detalleSheet, detalleColumnas.map((column) => column.width));
        excel.addTitleBar(detalleSheet, {
            title: "Detalle de respuestas",
            subtitle: "Preoperacional e inspección preventiva por viaje",
            columnCount: detalleColumnas.length
        });
        excel.addTableHeaderRow(detalleSheet, detalleColumnas.map((column) => column.label));

        let bandaDetalle = false;
        items.forEach((item) => {
            const fecha = formatFechaHoraCorta(item.creado_en);
            const placa = safe(item.vehiculo_placa, "Sin vehículo");
            const conductor = safe(item.usuario_nombre, "Sin conductor");

            (item.preoperacional_items || []).forEach((detalleItem) => {
                excel.addTableDataRow(
                    detalleSheet,
                    [fecha, placa, conductor, "Preoperacional", detalleItem.item_label, detalleItem.respuesta === "no" ? "No" : "Sí", safe(detalleItem.observacion, "")],
                    { band: bandaDetalle }
                );
                bandaDetalle = !bandaDetalle;
            });

            (item.inspeccion_items || []).forEach((detalleItem) => {
                excel.addTableDataRow(
                    detalleSheet,
                    [fecha, placa, conductor, "Inspección", detalleItem.item_label, detalleItem.estado === "mal" ? "Mal estado" : "Bien", safe(detalleItem.comentario, "")],
                    { band: bandaDetalle }
                );
                bandaDetalle = !bandaDetalle;
            });
        });

        excel.addFooterRow(detalleSheet, FOOTER_TEXT(branding?.nombreEmpresa), detalleColumnas.length);

        await excel.downloadWorkbook(workbook, buildFileName("xlsx"));
    }

    window.VehiAmb = window.VehiAmb || {};
    window.VehiAmb.miViajeExport = { exportViajesPdf, exportViajesExcel };
})();
