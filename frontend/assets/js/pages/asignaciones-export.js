(function () {
    const APP_NAME = "Vehiamb";
    const MARGIN_X = 40;
    const FOOTER_TEXT = (nombreEmpresa) => (nombreEmpresa ? `Generado por ${APP_NAME} para ${nombreEmpresa}` : `Generado por ${APP_NAME}`);
    const ROJO_BANNER = [200, 22, 30];
    const GRIS_FECHA = [230, 232, 235];
    const ROJO_CLARO_ENCABEZADO = [235, 162, 170];
    const ROJO_CLARO_FILA = [243, 206, 210];
    const BLANCO_FILA = [255, 255, 255];
    const ROW_HEIGHT = 20;
    const ROW_LINE_HEIGHT = 12;
    const ROW_PADDING = 8;

    const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
    const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

    // Formato largo en español ("sábado, 01 de agosto de 2026"), igual al
    // reporte que ya se hacía por fuera de la app (ver captura del pedido) --
    // se arma a mano en vez de toLocaleDateString porque el orden/coma que
    // usa cada motor de Intl varia entre navegadores.
    function formatFechaLarga(fechaISO) {
        const fecha = new Date(`${String(fechaISO).slice(0, 10)}T00:00:00`);
        if (Number.isNaN(fecha.getTime())) return fechaISO;
        const dia = String(fecha.getDate()).padStart(2, "0");
        return `${DIAS[fecha.getDay()]}, ${dia} de ${MESES[fecha.getMonth()]} de ${fecha.getFullYear()}`;
    }

    function safe(value, fallback = "--") {
        if (value === null || value === undefined || value === "") return fallback;
        return String(value);
    }

    async function addEncabezado(doc, branding, fechaISO, totalRegistros) {
        const pageWidth = doc.internal.pageSize.getWidth();
        const bannerX = MARGIN_X + 120;
        const bannerHeight = 60;
        const bannerY = 30;

        // Logo de la empresa a la izquierda, mismo criterio que
        // entrega-export.js/vehiculo-export.js (getEmpresaBranding): cada
        // empresa lleva su propio logo, sin membrete generico de plataforma.
        doc.setDrawColor(200, 200, 200);
        doc.rect(MARGIN_X, bannerY, 110, bannerHeight);
        if (branding?.logo) {
            const maxWidth = 100;
            const maxHeight = bannerHeight - 10;
            const scale = Math.min(maxWidth / branding.logo.width, maxHeight / branding.logo.height);
            const w = branding.logo.width * scale;
            const h = branding.logo.height * scale;
            doc.addImage(branding.logo.dataUrl, "JPEG", MARGIN_X + (110 - w) / 2, bannerY + (bannerHeight - h) / 2, w, h);
        }

        doc.setFillColor(...ROJO_BANNER);
        doc.rect(bannerX, bannerY, pageWidth - MARGIN_X - bannerX, bannerHeight, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont(undefined, "bold");
        doc.setFontSize(20);
        doc.text("REPORTE DE VEHÍCULOS", bannerX + (pageWidth - MARGIN_X - bannerX) / 2, bannerY + bannerHeight / 2 + 7, { align: "center" });

        const fechaY = bannerY + bannerHeight + 18;
        doc.setFillColor(...GRIS_FECHA);
        doc.rect(MARGIN_X, fechaY - 14, pageWidth - MARGIN_X * 2, 22, "F");
        doc.setTextColor(24, 32, 43);
        doc.setFontSize(11);
        doc.text(`FECHA: ${formatFechaLarga(fechaISO)}`, pageWidth / 2, fechaY + 1, { align: "center" });

        const totalY = fechaY + 28;
        doc.setFontSize(10);
        doc.setFont(undefined, "bold");
        doc.text(`Total de vehículos: ${totalRegistros}`, MARGIN_X, totalY);
        doc.setFont(undefined, "normal");

        return totalY + 16;
    }

    // Dibuja la fila de encabezado de la tabla -- se repite en cada pagina
    // nueva (antes solo salia en la primera, y una tabla larga perdia el
    // significado de las columnas al pasar de pagina).
    function addTablaHeader(doc, y, columns, tableWidth) {
        doc.setFillColor(...ROJO_CLARO_ENCABEZADO);
        doc.rect(MARGIN_X, y, tableWidth, ROW_HEIGHT, "F");
        doc.setDrawColor(190, 190, 190);
        doc.rect(MARGIN_X, y, tableWidth, ROW_HEIGHT);
        doc.setTextColor(24, 32, 43);
        doc.setFont(undefined, "bold");
        doc.setFontSize(10);
        columns.forEach((column) => doc.text(column.label, column.x + 4, y + ROW_HEIGHT / 2 + 3));
        doc.setFont(undefined, "normal");
        return y + ROW_HEIGHT;
    }

    function addTabla(doc, startY, asignaciones) {
        const pageWidth = doc.internal.pageSize.getWidth();
        const bottomLimit = doc.internal.pageSize.getHeight() - 90;

        const tableWidth = pageWidth - MARGIN_X * 2;

        // RUTA es la columna de texto libre que mas necesita espacio (las
        // rutas con varios destinos pueden ser mucho mas largas que un
        // nombre corto), asi que se queda con el ancho sobrante para que la
        // suma cierre exacta contra el ancho de la tabla con cualquier
        // tamano de pagina. OBSERVACIONES no sale en este reporte -- queda
        // solo en el Excel (ver exportReporteExcel).
        const anchoNumero = 30;
        const anchoNombre = 150;
        const anchoTelefono = 80;
        const anchoPlaca = 75;
        const anchoRuta = tableWidth - (anchoNumero + anchoNombre + anchoTelefono + anchoPlaca);

        let x = MARGIN_X;
        const columns = [
            ["#", anchoNumero],
            ["NOMBRE", anchoNombre],
            ["RUTA", anchoRuta],
            ["TELEFONO", anchoTelefono],
            ["PLACA", anchoPlaca]
        ].map(([label, width]) => {
            const columna = { label, x, width, align: "left" };
            x += width;
            return columna;
        });

        let y = addTablaHeader(doc, startY, columns, tableWidth);

        asignaciones.forEach((item, indice) => {
            const valores = [
                String(indice + 1),
                safe(item.conductor_nombre, "Sin conductor"),
                safe(item.ruta_nombre),
                safe(item.telefono),
                safe(item.vehiculo_placa, "Sin vehículo")
            ];

            // Las rutas con varios destinos (ver Asignacion de rutas) pueden
            // ser mucho mas largas que un nombre corto -- se envuelven en
            // varias lineas en vez de cortarse en la primera, ajustando el
            // alto de toda la fila a la columna que mas lineas necesite.
            const columnLines = columns.map((column, colIndex) => doc.splitTextToSize(valores[colIndex], column.width - 8));
            const maxLines = Math.max(1, ...columnLines.map((lines) => lines.length));
            const rowHeight = Math.max(ROW_HEIGHT, maxLines * ROW_LINE_HEIGHT + ROW_PADDING);

            if (y + rowHeight > bottomLimit) {
                doc.addPage();
                y = addTablaHeader(doc, 40, columns, tableWidth);
            }

            doc.setFillColor(...(indice % 2 === 0 ? BLANCO_FILA : ROJO_CLARO_FILA));
            doc.rect(MARGIN_X, y, tableWidth, rowHeight, "F");
            doc.setDrawColor(220, 220, 220);
            doc.rect(MARGIN_X, y, tableWidth, rowHeight);

            columns.forEach((column, colIndex) => {
                doc.text(columnLines[colIndex], column.x + 4, y + 13);
            });

            y += rowHeight;
        });

        return y;
    }

    async function addFooter(doc, branding) {
        const pageCount = doc.internal.getNumberOfPages();
        const generado = FOOTER_TEXT(branding?.nombreEmpresa);
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
                doc.text(generado, MARGIN_X, pageHeight - imgHeight - 10);
                doc.addImage(membrete.dataUrl, "JPEG", MARGIN_X, pageHeight - imgHeight, imgWidth, imgHeight);
            } else {
                doc.text(generado, MARGIN_X, pageHeight - 20);
            }
        }
    }

    async function exportReportePdf({ fecha, asignaciones }) {
        if (!asignaciones || !asignaciones.length) {
            throw new Error("No hay asignaciones registradas para esta fecha");
        }

        const doc = await window.VehiAmb.pdfExport.createDocument({ orientation: "landscape" });
        const branding = await window.VehiAmb.pdfExport.getEmpresaBranding();

        const startY = await addEncabezado(doc, branding, fecha, asignaciones.length);
        addTabla(doc, startY, asignaciones);
        await addFooter(doc, branding);

        doc.save(`Reporte_vehiculos_${fecha}.pdf`);
    }

    const EXCEL_COLUMN_WIDTHS = [
        { label: "#", width: 2.5 },
        { label: "NOMBRE", width: 37 },
        { label: "RUTA", width: 45 },
        { label: "TELEFONO", width: 16 },
        { label: "PLACA", width: 14 },
        { label: "OBSERVACIONES", width: 40 },
        { label: "ANTICIPO", width: 14 },
        { label: "GASTO", width: 14 },
        { label: "CAMBIO", width: 14 },
        { label: "RUTERO", width: 10 }
    ];

    // Anticipo/Gasto/Rutero se dejan en blanco a proposito: son datos que el
    // despachador llena a mano sobre el Excel ya generado, no algo que la
    // app registre. Cambio si sale calculado (formula de Excel = Anticipo -
    // Gasto de esa misma fila), para que se recalcule solo al llenar las
    // otras dos celdas. Estas 4 columnas son exclusivas del Excel -- no
    // existen en la app ni en el PDF (ver ITEMS_HERRAMIENTAS/kit de
    // herramientas para el mismo criterio de "esto no se duplica").
    const COLUMNA_TELEFONO = 4;
    const COLUMNA_ANTICIPO = 7;
    const COLUMNA_GASTO = 8;
    const COLUMNA_CAMBIO = 9;

    function centrarFila(row) {
        row.eachCell({ includeEmpty: true }, (cell) => {
            cell.alignment = { horizontal: "center", vertical: "middle" };
        });
    }

    async function exportReporteExcel({ fecha, asignaciones }) {
        if (!asignaciones || !asignaciones.length) {
            throw new Error("No hay asignaciones registradas para esta fecha");
        }

        const excel = window.VehiAmb.excelExport;
        const branding = await window.VehiAmb.pdfExport.getEmpresaBranding();
        const columnCount = EXCEL_COLUMN_WIDTHS.length;

        const workbook = await excel.createWorkbook();
        const sheet = workbook.addWorksheet("Asignaciones");
        excel.setColumnWidths(sheet, EXCEL_COLUMN_WIDTHS.map((column) => column.width));

        excel.addTitleBar(sheet, {
            title: "REPORTE DE VEHÍCULOS",
            subtitle: `Fecha: ${formatFechaLarga(fecha)}`,
            columnCount,
            logo: branding?.logo,
            size: 18,
            align: "center",
            // La columna "#" (A) queda angosta a proposito (ver
            // EXCEL_COLUMN_WIDTHS), asi que el logo no cabe solo en esa
            // columna -- se combina con la B (mucho mas ancha) solo en esta
            // fila de titulo para darle espacio, sin ensanchar la columna A
            // para el resto de la tabla.
            logoColumnSpan: 2
        });

        const headerRow = excel.addTableHeaderRow(sheet, EXCEL_COLUMN_WIDTHS.map((column) => column.label));
        centrarFila(headerRow);

        asignaciones.forEach((item, indice) => {
            const filaExcel = headerRow.number + 1 + indice;
            const row = excel.addTableDataRow(
                sheet,
                [
                    indice + 1,
                    safe(item.conductor_nombre, "Sin conductor"),
                    safe(item.ruta_nombre),
                    safe(item.telefono),
                    safe(item.vehiculo_placa, "Sin vehículo"),
                    safe(item.observaciones, ""),
                    "",
                    "",
                    { formula: `${excel.columnLetter(COLUMNA_ANTICIPO)}${filaExcel}-${excel.columnLetter(COLUMNA_GASTO)}${filaExcel}`, result: 0 },
                    ""
                ],
                { band: indice % 2 === 1 }
            );

            centrarFila(row);

            // Telefono como columna de texto (no numero) para que Excel no
            // marque el numero como "guardado como texto" -- el telefono
            // nunca se usa en calculos, mostrar el error ahi es ruido.
            row.getCell(COLUMNA_TELEFONO).numFmt = "@";
            row.getCell(COLUMNA_ANTICIPO).numFmt = "$#,##0";
            row.getCell(COLUMNA_GASTO).numFmt = "$#,##0";
            row.getCell(COLUMNA_CAMBIO).numFmt = "$#,##0";
        });

        excel.addFooterRow(sheet, FOOTER_TEXT(branding?.nombreEmpresa), columnCount);

        await excel.downloadWorkbook(workbook, `Reporte_vehiculos_${fecha}.xlsx`);
    }

    window.VehiAmb = window.VehiAmb || {};
    window.VehiAmb.asignacionesExport = { exportReportePdf, exportReporteExcel };
})();
