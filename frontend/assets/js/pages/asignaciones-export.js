(function () {
    const APP_NAME = "Vehiamb";
    const MARGIN_X = 40;
    const FOOTER_TEXT = (nombreEmpresa) => (nombreEmpresa ? `Generado por ${APP_NAME} para ${nombreEmpresa}` : `Generado por ${APP_NAME}`);
    const ROJO_BANNER = [200, 22, 30];
    const GRIS_FECHA = [230, 232, 235];
    const NARANJA_ENCABEZADO = [244, 199, 165];
    const NARANJA_FILA = [253, 235, 222];
    const ROW_HEIGHT = 20;

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

    async function addEncabezado(doc, branding, fechaISO) {
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

        return fechaY + 28;
    }

    function addTabla(doc, startY, asignaciones) {
        const pageWidth = doc.internal.pageSize.getWidth();
        const columns = [
            { label: "", x: MARGIN_X, width: 25, align: "left" },
            { label: "NOMBRE", x: MARGIN_X + 25, width: 175, align: "left" },
            { label: "RUTA", x: MARGIN_X + 200, width: 165, align: "left" },
            { label: "TELEFONO", x: MARGIN_X + 365, width: 75, align: "left" },
            { label: "PLACA", x: MARGIN_X + 440, width: pageWidth - MARGIN_X - (MARGIN_X + 440), align: "left" }
        ];
        const tableWidth = pageWidth - MARGIN_X * 2;

        let y = startY;

        doc.setFillColor(...NARANJA_ENCABEZADO);
        doc.rect(MARGIN_X, y, tableWidth, ROW_HEIGHT, "F");
        doc.setDrawColor(190, 190, 190);
        doc.rect(MARGIN_X, y, tableWidth, ROW_HEIGHT);
        doc.setTextColor(24, 32, 43);
        doc.setFont(undefined, "bold");
        doc.setFontSize(10);
        columns.forEach((column) => doc.text(column.label, column.x + 4, y + ROW_HEIGHT / 2 + 3));
        y += ROW_HEIGHT;

        doc.setFont(undefined, "normal");
        asignaciones.forEach((item, indice) => {
            if (y + ROW_HEIGHT > doc.internal.pageSize.getHeight() - 90) {
                doc.addPage();
                y = 40;
            }

            doc.setFillColor(...NARANJA_FILA);
            doc.rect(MARGIN_X, y, tableWidth, ROW_HEIGHT, "F");
            doc.setDrawColor(220, 220, 220);
            doc.rect(MARGIN_X, y, tableWidth, ROW_HEIGHT);

            const valores = [
                String(indice + 1),
                safe(item.conductor_nombre, "Sin conductor"),
                safe(item.ruta_nombre),
                safe(item.telefono),
                safe(item.vehiculo_placa, "Sin vehículo")
            ];

            columns.forEach((column, colIndex) => {
                const texto = doc.splitTextToSize(valores[colIndex], column.width - 8);
                doc.text(texto[0] || "", column.x + 4, y + ROW_HEIGHT / 2 + 3);
            });

            y += ROW_HEIGHT;
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

        const startY = await addEncabezado(doc, branding, fecha);
        addTabla(doc, startY, asignaciones);
        await addFooter(doc, branding);

        doc.save(`Reporte_vehiculos_${fecha}.pdf`);
    }

    window.VehiAmb = window.VehiAmb || {};
    window.VehiAmb.asignacionesExport = { exportReportePdf };
})();
