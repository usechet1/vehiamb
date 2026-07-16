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

    function buildFileName(item) {
        const placa = String(item.placa || "SINPLACA").replace(/\s+/g, "").toUpperCase();
        const fecha = String(item.fecha || "").slice(0, 10) || "sin-fecha";
        return `Mantenimiento_${placa}_${fecha}.pdf`;
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
            // El valor puede envolverse a varias lineas (maxWidth); avanzar
            // siempre 16pt fijo hacia el siguiente row hacia solapaba el
            // texto envuelto con la fila siguiente. Se mide con
            // splitTextToSize (mismo patron que drawTableRow) para avanzar
            // segun la altura real ocupada.
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
        doc.text("Reporte de mantenimiento", layout.pageWidth - MARGIN_X, layout.y + 18, { align: "right" });
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

    function addRepuestosTable(doc, layout, repuestos) {
        layout.ensureSpace(20);
        doc.setFontSize(10);
        doc.setFont(undefined, "bold");
        doc.text("Repuestos utilizados", MARGIN_X, layout.y);
        layout.spacer(14);

        if (!repuestos.length) {
            doc.setFont(undefined, "normal");
            doc.text("No registrado", MARGIN_X, layout.y);
            layout.spacer(16);
            return;
        }

        const colX = [MARGIN_X, MARGIN_X + 150, MARGIN_X + 260, MARGIN_X + 330];

        doc.setFont(undefined, "bold");
        doc.text("Repuesto", colX[0], layout.y);
        doc.text("Proveedor", colX[1], layout.y);
        doc.text("Valor", colX[2], layout.y);
        doc.text("Notas", colX[3], layout.y);
        layout.spacer(6);
        doc.line(MARGIN_X, layout.y, layout.pageWidth - MARGIN_X, layout.y);
        layout.spacer(14);
        doc.setFont(undefined, "normal");

        repuestos.forEach((repuesto) => {
            const notasWidth = layout.pageWidth - MARGIN_X - colX[3];
            const repuestoLines = doc.splitTextToSize(safe(repuesto.repuesto), 140);
            const proveedorLines = doc.splitTextToSize(safe(repuesto.proveedor, "Sin proveedor"), 100);
            const notasLines = doc.splitTextToSize(safe(repuesto.notas, "Sin notas"), notasWidth);
            const maxLines = Math.max(1, repuestoLines.length, proveedorLines.length, notasLines.length);
            const rowHeight = maxLines * ROW_LINE_HEIGHT + 4;

            layout.ensureSpace(rowHeight);
            doc.text(repuestoLines, colX[0], layout.y);
            doc.text(proveedorLines, colX[1], layout.y);
            doc.text(repuesto.valor ? formatCurrency(repuesto.valor) : "No registrado", colX[2], layout.y);
            doc.text(notasLines, colX[3], layout.y);
            layout.spacer(rowHeight);
        });
    }

    async function addSoportePreview(doc, layout, item) {
        if (!item.soporte_url || !item.soporte_mime) return;

        const esImagen = String(item.soporte_mime).startsWith("image/");
        if (!esImagen) return;

        const MAX_WIDTH = 220;
        const MAX_HEIGHT = 160;

        try {
            const imageUrl = window.VehiAmb.api.getAssetUrl(item.soporte_url);
            const { dataUrl, width, height } = await window.VehiAmb.pdfExport.loadImageAsJpegDataUrl(imageUrl);

            const scale = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height, 1);
            const renderWidth = width * scale;
            const renderHeight = height * scale;

            layout.ensureSpace(renderHeight + 20);
            doc.setFontSize(10);
            doc.setFont(undefined, "bold");
            doc.text("Vista previa del soporte:", MARGIN_X, layout.y);
            layout.spacer(10);
            doc.addImage(dataUrl, "JPEG", MARGIN_X, layout.y, renderWidth, renderHeight);
            layout.spacer(renderHeight + 10);
        } catch (error) {
            console.error("No se pudo incluir la vista previa del soporte en el PDF:", error);
        }
    }

    function addFooter(doc, branding) {
        const pageCount = doc.internal.getNumberOfPages();
        const generadoEl = FOOTER_TEXT(branding?.nombreEmpresa);

        for (let page = 1; page <= pageCount; page += 1) {
            doc.setPage(page);
            const pageHeight = doc.internal.pageSize.getHeight();
            doc.setFontSize(8);
            doc.setTextColor(120, 128, 140);
            doc.text(generadoEl, MARGIN_X, pageHeight - 20);
        }
    }

    async function exportMantenimientoPdf(item) {
        if (!item) {
            throw new Error("No hay un mantenimiento seleccionado para exportar");
        }

        const doc = window.VehiAmb.pdfExport.createDocument();
        const layout = makeLayout(doc);
        const branding = await window.VehiAmb.pdfExport.getEmpresaBranding();
        const vehicleName = `${item.marca || ""} ${item.modelo || ""}`.trim();
        const repuestos = parseRepuestos(item.repuestos);
        const totalRepuestos = repuestos.reduce((sum, repuesto) => sum + Number(repuesto.valor || 0), 0);

        await addHeader(doc, layout, branding);

        layout.sectionTitle("Información general");
        layout.row("Vehículo", vehicleName);
        layout.row("Placa", item.placa);
        layout.row("Fecha", window.VehiAmb.pdfExport.formatDateForPdf(item.fecha));
        layout.row("Tipo de mantenimiento", tiposMantenimiento[item.tipo] || item.tipo);
        layout.row("Estado del vehículo", item.vehiculo_varado ? "Varado / en taller" : "Disponible");

        layout.spacer();
        layout.sectionTitle("Detalle del mantenimiento");
        layout.row("Descripción", item.descripcion);
        layout.row(
            "Kilometraje registrado",
            item.kilometraje !== null && item.kilometraje !== undefined
                ? `${Number(item.kilometraje).toLocaleString("es-CO")} km`
                : null
        );
        layout.row("Responsable", item.hecho_por);
        layout.row("Autorizado por", item.autorizado_por);

        layout.spacer();
        layout.sectionTitle("Gastos");
        layout.row("Mano de obra", formatCurrency(item.valor_mano_obra));
        layout.spacer(2);
        addRepuestosTable(doc, layout, repuestos);
        layout.spacer(2);
        layout.row("Total de repuestos", formatCurrency(totalRepuestos));

        doc.setFont(undefined, "bold");
        layout.row("Gasto total del mantenimiento", formatCurrency(item.valor));
        doc.setFont(undefined, "normal");

        layout.spacer();
        layout.sectionTitle("Archivos");
        layout.row("Archivo de soporte", item.soporte_nombre);
        await addSoportePreview(doc, layout, item);

        addFooter(doc, branding);

        doc.save(buildFileName(item));
    }

    function buildExcelFileName(item) {
        const placa = String(item.placa || "SINPLACA").replace(/\s+/g, "").toUpperCase();
        const fecha = String(item.fecha || "").slice(0, 10) || "sin-fecha";
        return `Mantenimiento_${placa}_${fecha}.xlsx`;
    }

    const EXCEL_COLUMN_COUNT = 4;

    async function exportMantenimientoExcel(item) {
        if (!item) {
            throw new Error("No hay un mantenimiento seleccionado para exportar");
        }

        const excel = window.VehiAmb.excelExport;
        const branding = await window.VehiAmb.pdfExport.getEmpresaBranding();
        const vehicleName = `${item.marca || ""} ${item.modelo || ""}`.trim();
        const repuestos = parseRepuestos(item.repuestos);
        const totalRepuestos = repuestos.reduce((sum, repuesto) => sum + Number(repuesto.valor || 0), 0);

        const workbook = excel.createWorkbook();
        const sheet = workbook.addWorksheet("Mantenimiento");
        excel.setColumnWidths(sheet, [26, 24, 16, 30]);

        excel.addTitleBar(sheet, {
            title: "Reporte de mantenimiento",
            subtitle: APP_NAME,
            columnCount: EXCEL_COLUMN_COUNT
        });

        excel.addSectionHeader(sheet, "Información general", EXCEL_COLUMN_COUNT);
        excel.addLabelValueRow(sheet, "Vehículo", safe(vehicleName));
        excel.addLabelValueRow(sheet, "Placa", safe(item.placa));
        excel.addLabelValueRow(sheet, "Fecha", excel.formatDateForExcel(item.fecha));
        excel.addLabelValueRow(sheet, "Tipo de mantenimiento", safe(tiposMantenimiento[item.tipo] || item.tipo));
        excel.addLabelValueRow(sheet, "Estado del vehículo", item.vehiculo_varado ? "Varado / en taller" : "Disponible");
        sheet.addRow([]);

        excel.addSectionHeader(sheet, "Detalle del mantenimiento", EXCEL_COLUMN_COUNT);
        excel.addLabelValueRow(sheet, "Descripción", safe(item.descripcion));
        excel.addLabelValueRow(
            sheet,
            "Kilometraje registrado",
            item.kilometraje !== null && item.kilometraje !== undefined
                ? `${Number(item.kilometraje).toLocaleString("es-CO")} km`
                : "No registrado"
        );
        excel.addLabelValueRow(sheet, "Responsable", safe(item.hecho_por));
        excel.addLabelValueRow(sheet, "Autorizado por", safe(item.autorizado_por));
        sheet.addRow([]);

        excel.addSectionHeader(sheet, "Gastos", EXCEL_COLUMN_COUNT);
        const manoObraRow = excel.addLabelValueRow(sheet, "Mano de obra", Number(item.valor_mano_obra || 0));
        manoObraRow.getCell(2).numFmt = "$#,##0";
        sheet.addRow([]);

        excel.addSectionHeader(sheet, "Repuestos utilizados", EXCEL_COLUMN_COUNT);
        excel.addTableHeaderRow(sheet, ["Repuesto", "Proveedor", "Valor", "Notas"]);

        if (repuestos.length) {
            repuestos.forEach((repuesto, index) => {
                const row = excel.addTableDataRow(
                    sheet,
                    [
                        safe(repuesto.repuesto),
                        safe(repuesto.proveedor, "Sin proveedor"),
                        Number(repuesto.valor || 0),
                        safe(repuesto.notas, "Sin notas")
                    ],
                    { band: index % 2 === 1 }
                );
                row.getCell(3).numFmt = "$#,##0";
            });
        } else {
            excel.addTableDataRow(sheet, ["No registrado", "", "", ""]);
        }

        sheet.addRow([]);
        const totalRepuestosRow = excel.addLabelValueRow(sheet, "Total de repuestos", totalRepuestos);
        totalRepuestosRow.getCell(2).numFmt = "$#,##0";
        const totalRow = excel.addLabelValueRow(sheet, "Gasto total del mantenimiento", Number(item.valor || 0));
        totalRow.getCell(2).numFmt = "$#,##0";
        totalRow.eachCell((cell) => {
            cell.font = { bold: true, color: { argb: "FFB21F2D" } };
        });
        sheet.addRow([]);

        excel.addSectionHeader(sheet, "Archivos", EXCEL_COLUMN_COUNT);
        excel.addLabelValueRow(sheet, "Archivo de soporte", safe(item.soporte_nombre));

        excel.addFooterRow(sheet, FOOTER_TEXT(branding?.nombreEmpresa), EXCEL_COLUMN_COUNT);

        await excel.downloadWorkbook(workbook, buildExcelFileName(item));
    }

    window.VehiAmb = window.VehiAmb || {};
    window.VehiAmb.mantenimientos = window.VehiAmb.mantenimientos || {};
    window.VehiAmb.mantenimientos.exportPdf = exportMantenimientoPdf;
    window.VehiAmb.mantenimientos.exportExcel = exportMantenimientoExcel;
})();
