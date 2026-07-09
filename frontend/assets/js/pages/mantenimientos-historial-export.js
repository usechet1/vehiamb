(function () {
    const APP_NAME = "VehiAmb";
    const LOGO_PATH = "img/membrete_logo.png";
    const MEMBRETE_FOOTER_PATH = "img/membrete_footer.png";
    const MEMBRETE_FOOTER_ASPECT = 2550 / 315;
    const MARGIN_X = 40;
    const ROW_HEIGHT = 18;
    const ROW_LINE_HEIGHT = 12;
    const FOOTER_TEXT = () => `Generado por ${APP_NAME} - Software propio de Ambientes Cerámicos - el ${new Date().toLocaleString("es-CO")}`;

    function safe(value, fallback = "No registrado") {
        if (value === null || value === undefined || value === "") return fallback;
        return String(value);
    }

    function buildFileName() {
        const fecha = new Date().toISOString().slice(0, 10);
        return `Historial_Mantenimientos_${fecha}.pdf`;
    }

    function describeFiltros(filtros) {
        const partes = [];
        if (filtros.placa) partes.push(`Placa: ${filtros.placa}`);
        if (filtros.tipo) partes.push(`Tipo: ${tiposMantenimiento[filtros.tipo] || filtros.tipo}`);
        if (filtros.fecha_desde) partes.push(`Desde: ${window.VehiAmb.pdfExport.formatDateForPdf(filtros.fecha_desde)}`);
        if (filtros.fecha_hasta) partes.push(`Hasta: ${window.VehiAmb.pdfExport.formatDateForPdf(filtros.fecha_hasta)}`);
        return partes.length ? partes.join("   |   ") : "Sin filtros aplicados (todos los registros)";
    }

    const COLUMN_WIDTHS = [
        { key: "fecha", label: "Fecha", width: 62 },
        { key: "placa", label: "Placa", width: 58 },
        { key: "vehiculo", label: "Vehículo", width: 118 },
        { key: "tipo", label: "Tipo", width: 105 },
        { key: "estado", label: "Estado", width: 112 },
        { key: "km", label: "Km", width: 58 },
        { key: "valor", label: "Gasto total", width: 95 },
        { key: "responsable", label: "Hecho por", width: 112 }
    ];

    function buildColumns(pageWidth) {
        let x = MARGIN_X;
        return COLUMN_WIDTHS.map((column) => {
            const positioned = { ...column, x };
            x += column.width;
            return positioned;
        });
    }

    async function addHeader(doc, layout, filtros, totalRegistros) {
        try {
            const logoDataUrl = await window.VehiAmb.pdfExport.loadAsDataUrl(LOGO_PATH);
            doc.addImage(logoDataUrl, "PNG", MARGIN_X, layout.y, 90, 47);
        } catch (error) {
            console.error("No se pudo cargar el logo para el PDF:", error);
        }

        doc.setFontSize(16);
        doc.setFont(undefined, "bold");
        doc.setTextColor(24, 32, 43);
        doc.text("Historial de mantenimientos", layout.pageWidth - MARGIN_X, layout.y + 18, { align: "right" });
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

    async function addFooter(doc) {
        const pageCount = doc.internal.getNumberOfPages();
        const generado = FOOTER_TEXT();
        const pageWidth = doc.internal.pageSize.getWidth();
        const bandHeight = pageWidth / MEMBRETE_FOOTER_ASPECT;

        let footerDataUrl = null;
        try {
            footerDataUrl = await window.VehiAmb.pdfExport.loadAsDataUrl(MEMBRETE_FOOTER_PATH);
        } catch (error) {
            console.error("No se pudo cargar el membrete de pie de página para el PDF:", error);
        }

        for (let page = 1; page <= pageCount; page += 1) {
            doc.setPage(page);
            const pageHeight = doc.internal.pageSize.getHeight();
            doc.setFontSize(8);
            doc.setTextColor(120, 128, 140);
            doc.text(generado, MARGIN_X, pageHeight - bandHeight - 10);
            doc.text(`Página ${page} de ${pageCount}`, pageWidth - MARGIN_X, pageHeight - bandHeight - 10, { align: "right" });

            if (footerDataUrl) {
                doc.addImage(footerDataUrl, "PNG", 0, pageHeight - bandHeight, pageWidth, bandHeight);
            }
        }
    }

    async function exportHistorialPdf(items, filtros = {}) {
        if (!items || !items.length) {
            throw new Error("No hay mantenimientos para exportar con los filtros actuales");
        }

        const doc = window.VehiAmb.pdfExport.createDocument({ orientation: "landscape" });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const bottomLimit = pageHeight - (pageWidth / MEMBRETE_FOOTER_ASPECT) - 30;

        let y = 40;
        const layout = {
            get y() { return y; },
            set y(value) { y = value; },
            pageWidth
        };

        const columns = buildColumns(pageWidth);

        await addHeader(doc, layout, filtros, items.length);
        addTableHeader(doc, layout, columns);

        items.forEach((item) => {
            if (layout.y > bottomLimit) {
                doc.addPage();
                layout.y = 40;
                addTableHeader(doc, layout, columns);
            }

            const vehiculo = `${item.marca || ""} ${item.modelo || ""}`.trim();
            const fila = {
                fecha: window.VehiAmb.pdfExport.formatDateForPdf(item.fecha),
                placa: safe(item.placa),
                vehiculo: safe(vehiculo),
                tipo: safe(tiposMantenimiento[item.tipo] || item.tipo),
                estado: safe(estadosMantenimiento[item.estado] || item.estado, "Completado"),
                km: item.kilometraje !== null && item.kilometraje !== undefined
                    ? `${Number(item.kilometraje).toLocaleString("es-CO")} km`
                    : "No registrado",
                valor: formatCurrency(item.valor),
                responsable: safe(item.hecho_por)
            };

            const columnLines = columns.map((column) => doc.splitTextToSize(String(fila[column.key]), column.width - 6));
            const maxLines = Math.max(1, ...columnLines.map((lines) => lines.length));
            const rowHeight = Math.max(ROW_HEIGHT, maxLines * ROW_LINE_HEIGHT + 6);

            columns.forEach((column, index) => {
                doc.text(columnLines[index], column.x, layout.y);
            });

            layout.y += rowHeight;
        });

        await addFooter(doc);

        doc.save(buildFileName());
    }

    function buildExcelFileName() {
        const fecha = new Date().toISOString().slice(0, 10);
        return `Historial_Mantenimientos_${fecha}.xlsx`;
    }

    async function exportHistorialExcel(items, filtros = {}) {
        if (!items || !items.length) {
            throw new Error("No hay mantenimientos para exportar con los filtros actuales");
        }

        const excel = window.VehiAmb.excelExport;
        const columnCount = COLUMN_WIDTHS.length;

        const workbook = excel.createWorkbook();
        const sheet = workbook.addWorksheet("Historial");
        excel.setColumnWidths(sheet, COLUMN_WIDTHS.map((column) => Math.round(column.width / 6)));

        excel.addTitleBar(sheet, {
            title: "Historial de mantenimientos",
            subtitle: APP_NAME,
            columnCount
        });

        excel.addLabelValueRow(sheet, "Filtros aplicados:", describeFiltros(filtros));
        excel.addLabelValueRow(sheet, "Total de registros:", items.length);
        sheet.addRow([]);

        const headerRow = excel.addTableHeaderRow(sheet, COLUMN_WIDTHS.map((column) => column.label));

        items.forEach((item, index) => {
            const vehiculo = `${item.marca || ""} ${item.modelo || ""}`.trim();

            const row = excel.addTableDataRow(
                sheet,
                [
                    excel.formatDateForExcel(item.fecha),
                    safe(item.placa),
                    safe(vehiculo),
                    safe(tiposMantenimiento[item.tipo] || item.tipo),
                    safe(estadosMantenimiento[item.estado] || item.estado, "Completado"),
                    item.kilometraje !== null && item.kilometraje !== undefined
                        ? Number(item.kilometraje)
                        : "No registrado",
                    Number(item.valor || 0),
                    safe(item.hecho_por)
                ],
                { band: index % 2 === 1 }
            );

            row.getCell(6).numFmt = "#,##0 \"km\"";
            row.getCell(7).numFmt = "$#,##0";
        });

        excel.addFooterRow(sheet, FOOTER_TEXT(), columnCount);
        sheet.views = [{ state: "frozen", ySplit: headerRow.number }];

        await excel.downloadWorkbook(workbook, buildExcelFileName());
    }

    window.VehiAmb = window.VehiAmb || {};
    window.VehiAmb.mantenimientos = window.VehiAmb.mantenimientos || {};
    window.VehiAmb.mantenimientos.exportHistorialPdf = exportHistorialPdf;
    window.VehiAmb.mantenimientos.exportHistorialExcel = exportHistorialExcel;
})();
