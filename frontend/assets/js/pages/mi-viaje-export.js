(function () {
    const APP_NAME = "Vehiamb";
    const MARGIN_X = 40;
    const ROW_HEIGHT = 18;
    const ROW_LINE_HEIGHT = 12;
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

    function preoperacionalTexto(item) {
        if (!item.preoperacional_realizado) return "No se registró";
        return item.preoperacional_items_mal > 0
            ? `${item.preoperacional_items_mal} ítem(s) en mal estado`
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

    const COLUMN_WIDTHS = [
        { key: "fecha", label: "Fecha y hora", width: 90 },
        { key: "placa", label: "Placa", width: 55 },
        { key: "vehiculo", label: "Vehículo", width: 110 },
        { key: "conductor", label: "Conductor", width: 120 },
        { key: "destino", label: "Destino", width: 212 },
        { key: "preoperacional", label: "Preoperacional", width: 175 }
    ];

    function buildColumns() {
        let x = MARGIN_X;
        return COLUMN_WIDTHS.map((column) => {
            const positioned = { ...column, x };
            x += column.width;
            return positioned;
        });
    }

    async function addHeader(doc, layout, filtros, totalRegistros, branding) {
        if (branding?.logo) {
            const maxWidth = 90;
            const maxHeight = 47;
            const scale = Math.min(maxWidth / branding.logo.width, maxHeight / branding.logo.height);
            doc.addImage(branding.logo.dataUrl, "JPEG", MARGIN_X, layout.y, branding.logo.width * scale, branding.logo.height * scale);
        }

        doc.setFontSize(16);
        doc.setFont(undefined, "bold");
        doc.setTextColor(24, 32, 43);
        doc.text("Reporte de viajes", layout.pageWidth - MARGIN_X, layout.y + 18, { align: "right" });
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

        const doc = window.VehiAmb.pdfExport.createDocument({ orientation: "landscape" });
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

        const columns = buildColumns();

        await addHeader(doc, layout, filtros, items.length, branding);
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
                preoperacional: preoperacionalTexto(item)
            };

            const columnLines = columns.map((column) => doc.splitTextToSize(String(fila[column.key]), column.width - 6));
            const maxLines = Math.max(1, ...columnLines.map((lines) => lines.length));
            const rowHeight = Math.max(ROW_HEIGHT, maxLines * ROW_LINE_HEIGHT + 6);

            columns.forEach((column, index) => {
                doc.text(columnLines[index], column.x, layout.y);
            });

            layout.y += rowHeight;
        });

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

        const workbook = excel.createWorkbook();
        const sheet = workbook.addWorksheet("Viajes");
        excel.setColumnWidths(sheet, COLUMN_WIDTHS.map((column) => Math.round(column.width / 6)));

        excel.addTitleBar(sheet, {
            title: "Reporte de viajes",
            subtitle: APP_NAME,
            columnCount
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
                    preoperacionalTexto(item)
                ],
                { band: index % 2 === 1 }
            );
        });

        excel.addFooterRow(sheet, FOOTER_TEXT(branding?.nombreEmpresa), columnCount);

        await excel.downloadWorkbook(workbook, buildFileName("xlsx"));
    }

    window.VehiAmb = window.VehiAmb || {};
    window.VehiAmb.miViajeExport = { exportViajesPdf, exportViajesExcel };
})();
