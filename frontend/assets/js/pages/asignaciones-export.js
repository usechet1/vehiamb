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
        const columns = [
            { label: "#", x: MARGIN_X, width: 25, align: "left" },
            { label: "NOMBRE", x: MARGIN_X + 25, width: 150, align: "left" },
            { label: "RUTA", x: MARGIN_X + 175, width: 190, align: "left" },
            { label: "TELEFONO", x: MARGIN_X + 365, width: 75, align: "left" },
            { label: "PLACA", x: MARGIN_X + 440, width: pageWidth - MARGIN_X - (MARGIN_X + 440), align: "left" }
        ];
        const tableWidth = pageWidth - MARGIN_X * 2;

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

        const doc = window.VehiAmb.pdfExport.createDocument();
        const branding = await window.VehiAmb.pdfExport.getEmpresaBranding();

        const startY = await addEncabezado(doc, branding, fecha, asignaciones.length);
        addTabla(doc, startY, asignaciones);
        await addFooter(doc, branding);

        doc.save(`Reporte_vehiculos_${fecha}.pdf`);
    }

    window.VehiAmb = window.VehiAmb || {};
    window.VehiAmb.asignacionesExport = { exportReportePdf };
})();
