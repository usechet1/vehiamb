(function () {
    const APP_NAME = "VehiAmb";
    const MARGIN_X = 40;
    const PAGE_BOTTOM_LIMIT = 720;
    const ROW_LINE_HEIGHT = 12;
    const FOOTER_TEXT = (nombreEmpresa) => (nombreEmpresa ? `Generado por ${APP_NAME} para ${nombreEmpresa}` : `Generado por ${APP_NAME}`);

    function safe(value, fallback = "No registrado") {
        if (value === null || value === undefined || value === "") return fallback;
        return String(value);
    }

    function buildFileName(row, extension) {
        const placa = String(row.placa || "SINPLACA").replace(/\s+/g, "").toUpperCase();
        const fecha = new Date().toISOString().slice(0, 10);
        return `SIMIT_${placa}_${fecha}.${extension}`;
    }

    function makeLayout(doc) {
        const pageWidth = doc.internal.pageSize.getWidth();
        let y = 40;

        function ensureSpace(next) {
            if (y + next > PAGE_BOTTOM_LIMIT) {
                doc.addPage();
                y = 40;
            }
        }

        function sectionTitle(text) {
            ensureSpace(20);
            doc.setFontSize(12);
            doc.setFont(undefined, "bold");
            doc.setTextColor(178, 31, 45);
            doc.text(text, MARGIN_X, y);
            doc.setTextColor(24, 32, 43);
            y += 18;
        }

        function row(label, value) {
            // Medir con splitTextToSize antes de avanzar y, para que un
            // valor largo que se envuelve a varias lineas (ej. un mensaje de
            // error de SIMIT) no quede debajo del siguiente row.
            const maxWidth = pageWidth - MARGIN_X * 2 - 150;
            doc.setFontSize(10);
            const lines = doc.splitTextToSize(safe(value), maxWidth);
            const rowHeight = Math.max(16, lines.length * ROW_LINE_HEIGHT + 4);

            ensureSpace(rowHeight);
            doc.setFont(undefined, "bold");
            doc.text(`${label}:`, MARGIN_X, y);
            doc.setFont(undefined, "normal");
            doc.text(lines, MARGIN_X + 150, y);
            y += rowHeight;
        }

        function spacer(amount = 8) {
            y += amount;
        }

        return {
            get y() { return y; },
            set y(value) { y = value; },
            pageWidth,
            ensureSpace,
            sectionTitle,
            row,
            spacer
        };
    }

    async function addHeader(doc, layout, branding) {
        if (branding?.logo) {
            const maxWidth = 90;
            const maxHeight = 47;
            const scale = Math.min(maxWidth / branding.logo.width, maxHeight / branding.logo.height);
            doc.addImage(branding.logo.dataUrl, "JPEG", MARGIN_X, layout.y, branding.logo.width * scale, branding.logo.height * scale);
        }

        doc.setFontSize(16);
        doc.setFont(undefined, "bold");
        doc.setTextColor(24, 32, 43);
        doc.text("Reporte de comparendos SIMIT", layout.pageWidth - MARGIN_X, layout.y + 18, { align: "right" });
        doc.setFontSize(10);
        doc.setFont(undefined, "normal");
        doc.setTextColor(105, 115, 134);
        doc.text(APP_NAME, layout.pageWidth - MARGIN_X, layout.y + 34, { align: "right" });
        doc.setTextColor(24, 32, 43);

        layout.y += 64;
        doc.setDrawColor(220, 226, 234);
        doc.line(MARGIN_X, layout.y, layout.pageWidth - MARGIN_X, layout.y);
        layout.spacer(24);
    }

    function addComparendosTable(doc, layout, comparendos) {
        layout.ensureSpace(20);
        doc.setFontSize(10);
        doc.setFont(undefined, "bold");
        doc.text("Comparendos de la última consulta", MARGIN_X, layout.y);
        layout.spacer(14);

        if (!comparendos || !comparendos.length) {
            doc.setFont(undefined, "normal");
            doc.text("No hay comparendos registrados en esta consulta.", MARGIN_X, layout.y);
            layout.spacer(16);
            return;
        }

        const colX = [MARGIN_X, MARGIN_X + 65, MARGIN_X + 115, MARGIN_X + 225, MARGIN_X + 280, MARGIN_X + 335, MARGIN_X + 400];

        doc.setFont(undefined, "bold");
        doc.setFontSize(8);
        doc.text("Número", colX[0], layout.y);
        doc.text("Fecha", colX[1], layout.y);
        doc.text("Descripción", colX[2], layout.y);
        doc.text("Valor", colX[3], layout.y);
        doc.text("Estado", colX[4], layout.y);
        doc.text("Cédula infractor", colX[5], layout.y);
        doc.text("Nombre infractor", colX[6], layout.y);
        layout.spacer(6);
        doc.line(MARGIN_X, layout.y, layout.pageWidth - MARGIN_X, layout.y);
        layout.spacer(14);
        doc.setFont(undefined, "normal");

        comparendos.forEach((item) => {
            const numeroLines = doc.splitTextToSize(safe(item.numero_comparendo), 60);
            const descripcionLines = doc.splitTextToSize(safe(item.descripcion, "Sin descripción"), 105);
            const nombreLines = doc.splitTextToSize(safe(item.nombre_infractor, "—"), 110);
            const maxLines = Math.max(1, numeroLines.length, descripcionLines.length, nombreLines.length);
            const rowHeight = maxLines * ROW_LINE_HEIGHT + 4;

            layout.ensureSpace(rowHeight);
            doc.text(numeroLines, colX[0], layout.y);
            doc.text(item.fecha_infraccion ? window.VehiAmb.pdfExport.formatDateForPdf(item.fecha_infraccion) : "Sin fecha", colX[1], layout.y);
            doc.text(descripcionLines, colX[2], layout.y);
            doc.text(formatCurrency(item.valor), colX[3], layout.y);
            doc.text(safe(item.estado), colX[4], layout.y);
            doc.text(safe(item.cedula_infractor, "—"), colX[5], layout.y);
            doc.text(nombreLines, colX[6], layout.y);
            layout.spacer(rowHeight);
        });

        doc.setFontSize(10);
    }

    function addHistorialTable(doc, layout, historial) {
        layout.spacer(4);
        layout.ensureSpace(20);
        doc.setFontSize(10);
        doc.setFont(undefined, "bold");
        doc.text("Historial de consultas", MARGIN_X, layout.y);
        layout.spacer(14);

        if (!historial || !historial.length) {
            doc.setFont(undefined, "normal");
            doc.text("Este vehículo aún no tiene consultas SIMIT registradas.", MARGIN_X, layout.y);
            layout.spacer(16);
            return;
        }

        const colX = [MARGIN_X, MARGIN_X + 110, MARGIN_X + 190, MARGIN_X + 260, MARGIN_X + 360, MARGIN_X + 440];

        doc.setFont(undefined, "bold");
        doc.text("Fecha", colX[0], layout.y);
        doc.text("Origen", colX[1], layout.y);
        doc.text("Resultado", colX[2], layout.y);
        doc.text("Estado cartera", colX[3], layout.y);
        doc.text("Comparendos", colX[4], layout.y);
        doc.text("Valor total", colX[5], layout.y);
        layout.spacer(6);
        doc.line(MARGIN_X, layout.y, layout.pageWidth - MARGIN_X, layout.y);
        layout.spacer(14);
        doc.setFont(undefined, "normal");

        historial.forEach((item) => {
            layout.ensureSpace(16);
            const estadoConsultaOk = item.estado_consulta === "ok";
            doc.text(formatDateTime(item.fecha_consulta), colX[0], layout.y);
            doc.text(item.origen === "masivo" ? "Actualización flota" : "Manual", colX[1], layout.y);
            doc.text(estadoConsultaOk ? "OK" : safe(item.estado_consulta), colX[2], layout.y);
            doc.text(estadoLabel(estadoConsultaOk ? item.estado_cartera : "desconocido"), colX[3], layout.y);
            doc.text(String(item.total_comparendos ?? 0), colX[4], layout.y);
            doc.text(formatCurrency(item.valor_total), colX[5], layout.y);
            layout.spacer(16);
        });
    }

    async function addFooter(doc, branding) {
        const pageCount = doc.internal.getNumberOfPages();
        const generadoEl = FOOTER_TEXT(branding?.nombreEmpresa);
        const membrete = await window.VehiAmb.pdfExport.getMembreteFooterImage();

        for (let page = 1; page <= pageCount; page += 1) {
            doc.setPage(page);
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            doc.setFontSize(8);
            doc.setTextColor(120, 128, 140);

            if (membrete) {
                const imgWidth = pageWidth - MARGIN_X * 2;
                const imgHeight = imgWidth / (membrete.width / membrete.height);
                doc.text(generadoEl, MARGIN_X, pageHeight - imgHeight - 10);
                doc.addImage(membrete.dataUrl, "JPEG", MARGIN_X, pageHeight - imgHeight, imgWidth, imgHeight);
            } else {
                doc.text(generadoEl, MARGIN_X, pageHeight - 20);
            }
        }
    }

    async function exportComparendosPdf({ row, historial, detalle, estado }) {
        if (!row) {
            throw new Error("No hay un vehículo seleccionado para exportar");
        }

        const doc = window.VehiAmb.pdfExport.createDocument();
        const layout = makeLayout(doc);
        const branding = await window.VehiAmb.pdfExport.getEmpresaBranding();
        const vehicleName = `${row.marca || ""} ${row.modelo || ""}`.trim();

        await addHeader(doc, layout, branding);

        layout.sectionTitle("Información general");
        layout.row("Vehículo", vehicleName);
        layout.row("Placa", row.placa);
        layout.row("Estado actual", estadoLabel(estado));
        layout.row("Comparendos vigentes", row.total_comparendos ?? 0);
        layout.row("Valor total", formatCurrency(row.valor_total));
        layout.row("Última consulta", formatDateTime(row.fecha_consulta));
        if (row.mensaje_error) layout.row("Último error", row.mensaje_error);

        layout.spacer();
        addComparendosTable(doc, layout, detalle?.comparendos);

        layout.spacer(4);
        addHistorialTable(doc, layout, historial);

        await addFooter(doc, branding);

        doc.save(buildFileName(row, "pdf"));
    }

    const EXCEL_COLUMN_COUNT = 7;

    async function exportComparendosExcel({ row, historial, detalle, estado }) {
        if (!row) {
            throw new Error("No hay un vehículo seleccionado para exportar");
        }

        const excel = window.VehiAmb.excelExport;
        const branding = await window.VehiAmb.pdfExport.getEmpresaBranding();
        const vehicleName = `${row.marca || ""} ${row.modelo || ""}`.trim();
        const comparendos = detalle?.comparendos || [];

        const workbook = excel.createWorkbook();
        const sheet = workbook.addWorksheet("Comparendos SIMIT");
        excel.setColumnWidths(sheet, [22, 14, 32, 14, 14, 18, 24]);

        excel.addTitleBar(sheet, {
            title: "Reporte de comparendos SIMIT",
            subtitle: APP_NAME,
            columnCount: EXCEL_COLUMN_COUNT
        });

        excel.addSectionHeader(sheet, "Información general", EXCEL_COLUMN_COUNT);
        excel.addLabelValueRow(sheet, "Vehículo", safe(vehicleName));
        excel.addLabelValueRow(sheet, "Placa", safe(row.placa));
        excel.addLabelValueRow(sheet, "Estado actual", estadoLabel(estado));
        excel.addLabelValueRow(sheet, "Comparendos vigentes", row.total_comparendos ?? 0);
        const valorRow = excel.addLabelValueRow(sheet, "Valor total", Number(row.valor_total || 0));
        valorRow.getCell(2).numFmt = "$#,##0";
        excel.addLabelValueRow(sheet, "Última consulta", formatDateTime(row.fecha_consulta));
        if (row.mensaje_error) excel.addLabelValueRow(sheet, "Último error", safe(row.mensaje_error));
        sheet.addRow([]);

        excel.addSectionHeader(sheet, "Comparendos de la última consulta", EXCEL_COLUMN_COUNT);
        excel.addTableHeaderRow(sheet, ["Número", "Fecha", "Descripción", "Valor", "Estado", "Cédula infractor", "Nombre infractor"]);

        if (comparendos.length) {
            comparendos.forEach((item, index) => {
                const dataRow = excel.addTableDataRow(
                    sheet,
                    [
                        safe(item.numero_comparendo),
                        item.fecha_infraccion ? excel.formatDateForExcel(item.fecha_infraccion) : "Sin fecha",
                        safe(item.descripcion, "Sin descripción"),
                        Number(item.valor || 0),
                        safe(item.estado),
                        safe(item.cedula_infractor, "—"),
                        safe(item.nombre_infractor, "—")
                    ],
                    { band: index % 2 === 1 }
                );
                dataRow.getCell(4).numFmt = "$#,##0";
            });
        } else {
            excel.addTableDataRow(sheet, ["No hay comparendos registrados en esta consulta.", "", "", "", "", "", ""]);
        }

        sheet.addRow([]);
        excel.addSectionHeader(sheet, "Historial de consultas", EXCEL_COLUMN_COUNT);
        excel.addTableHeaderRow(sheet, ["Fecha", "Origen", "Resultado", "Estado cartera", "Comparendos", "Valor total", ""]);

        if (historial && historial.length) {
            historial.forEach((item, index) => {
                const estadoConsultaOk = item.estado_consulta === "ok";
                const dataRow = excel.addTableDataRow(
                    sheet,
                    [
                        formatDateTime(item.fecha_consulta),
                        item.origen === "masivo" ? "Actualización flota" : "Manual",
                        estadoConsultaOk ? "OK" : safe(item.estado_consulta),
                        estadoLabel(estadoConsultaOk ? item.estado_cartera : "desconocido"),
                        Number(item.total_comparendos ?? 0),
                        Number(item.valor_total || 0),
                        ""
                    ],
                    { band: index % 2 === 1 }
                );
                dataRow.getCell(6).numFmt = "$#,##0";
            });
        } else {
            excel.addTableDataRow(sheet, ["Este vehículo aún no tiene consultas SIMIT registradas.", "", "", "", "", "", ""]);
        }

        excel.addFooterRow(sheet, FOOTER_TEXT(branding?.nombreEmpresa), EXCEL_COLUMN_COUNT);

        await excel.downloadWorkbook(workbook, buildFileName(row, "xlsx"));
    }

    window.VehiAmb = window.VehiAmb || {};
    window.VehiAmb.simit = window.VehiAmb.simit || {};
    window.VehiAmb.simit.exportComparendosPdf = exportComparendosPdf;
    window.VehiAmb.simit.exportComparendosExcel = exportComparendosExcel;
})();
