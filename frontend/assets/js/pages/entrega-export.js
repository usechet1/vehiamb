(function () {
    const APP_NAME = "Vehiamb";
    const MARGIN_X = 40;
    const PAGE_BOTTOM_LIMIT = 720;
    const FOOTER_TEXT = (nombreEmpresa) => (nombreEmpresa ? `Generado por ${APP_NAME} para ${nombreEmpresa}` : `Generado por ${APP_NAME}`);
    const ROW_LINE_HEIGHT = 12;

    const MOTIVO_LABEL = {
        cambio_conductor: "Cambio de conductor",
        vacaciones: "Vacaciones",
        retiro: "Retiro definitivo",
        otro: "Otro"
    };

    function safe(value, fallback = "No registrado") {
        if (value === null || value === undefined || value === "") return fallback;
        return String(value);
    }

    function formatDateTime(value) {
        if (!value) return "No registrado";
        return new Date(value).toLocaleString("es-CO", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
    }

    function formatKm(value) {
        if (value === null || value === undefined) return "No registrado";
        return `${Number(value).toLocaleString("es-CO", { maximumFractionDigits: 2 })} km`;
    }

    // Mismo helper de tabla con wrap de texto que usa vehiculo-export.js, para
    // que el checklist de la acta se vea consistente con las demas tablas de
    // los PDF de la plataforma (mantenimientos, vencimientos, comparendos).
    function drawTableRow(doc, layout, columns, values) {
        const wrapped = columns.map((column, index) => doc.splitTextToSize(String(values[index] ?? ""), column.width));
        const maxLines = Math.max(1, ...wrapped.map((lines) => lines.length));

        layout.ensureSpace(maxLines * ROW_LINE_HEIGHT + 6);

        columns.forEach((column, index) => {
            doc.text(wrapped[index], column.x, layout.y);
        });

        layout.y += maxLines * ROW_LINE_HEIGHT + 6;
    }

    function buildFileName(vehiculo, entrega) {
        const placa = String(vehiculo?.placa || "SINPLACA").replace(/\s+/g, "").toUpperCase();
        const fecha = String(entrega.fecha || "").slice(0, 10) || new Date().toISOString().slice(0, 10);
        return `Acta_vehiculo_${placa}_${fecha}.pdf`;
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

    async function addHeader(doc, layout, vehiculo, branding) {
        if (branding?.logo) {
            const maxWidth = 90;
            const maxHeight = 47;
            const scale = Math.min(maxWidth / branding.logo.width, maxHeight / branding.logo.height);
            doc.addImage(branding.logo.dataUrl, "JPEG", MARGIN_X, layout.y, branding.logo.width * scale, branding.logo.height * scale);
        }

        const vehicleName = `${vehiculo?.marca || ""} ${vehiculo?.modelo || ""}`.trim();

        doc.setFontSize(16);
        doc.setFont(undefined, "bold");
        doc.setTextColor(24, 32, 43);
        doc.text("Acta de vehículo", layout.pageWidth - MARGIN_X, layout.y + 18, { align: "right" });
        doc.setFontSize(10);
        doc.setFont(undefined, "normal");
        doc.setTextColor(105, 115, 134);
        doc.text(`${vehicleName || "Vehículo"} · ${safe(vehiculo?.placa, "SIN PLACA")}`, layout.pageWidth - MARGIN_X, layout.y + 34, { align: "right" });
        doc.setTextColor(24, 32, 43);

        layout.y += 64;
        doc.setDrawColor(220, 226, 234);
        doc.line(MARGIN_X, layout.y, layout.pageWidth - MARGIN_X, layout.y);
        layout.spacer(24);
    }

    function addChecklistTable(doc, layout, items) {
        layout.sectionTitle("Checklist del vehículo");

        if (!items || !items.length) {
            doc.setFontSize(10);
            doc.setFont(undefined, "normal");
            doc.text("Esta acta no tiene ítems registrados.", MARGIN_X, layout.y);
            layout.spacer(20);
            return;
        }

        const columns = [
            { key: "item", label: "Ítem", x: MARGIN_X, width: 170 },
            { key: "estado", label: "Estado", x: MARGIN_X + 180, width: 80 },
            { key: "comentario", label: "Comentario", x: MARGIN_X + 270, width: 245 }
        ];

        doc.setFontSize(10);
        doc.setFont(undefined, "bold");
        columns.forEach((column) => doc.text(column.label, column.x, layout.y));
        layout.spacer(6);
        doc.line(MARGIN_X, layout.y, layout.pageWidth - MARGIN_X, layout.y);
        layout.spacer(14);
        doc.setFont(undefined, "normal");

        items.forEach((item) => {
            drawTableRow(doc, layout, columns, [
                safe(item.item_label),
                item.estado === "mal" ? "Con novedad" : "Sin novedad",
                safe(item.comentario, "--")
            ]);
        });

        layout.spacer(8);
    }

    async function addFirmaImage(doc, url, { x, y, maxWidth, maxHeight }) {
        if (!url) return 0;

        try {
            const absoluteUrl = window.VehiAmb.api.getAssetUrl(url);
            const { dataUrl, width, height } = await window.VehiAmb.pdfExport.loadImageAsJpegDataUrl(absoluteUrl);
            const scale = Math.min(maxWidth / width, maxHeight / height, 1);
            const renderWidth = width * scale;
            const renderHeight = height * scale;

            doc.addImage(dataUrl, "JPEG", x, y, renderWidth, renderHeight);
            return renderHeight;
        } catch (error) {
            console.error("No se pudo incluir una firma en el PDF:", error);
            return 0;
        }
    }

    // Reutiliza addFirmaImage (misma carga/escala de imagen) para las fotos
    // generales del vehiculo, en una grilla de 2 columnas -- a diferencia de
    // las firmas (siempre 2, posiciones fijas), aqui puede haber 0 a N fotos,
    // asi que hay que ir calculando fila por fila y pidiendo espacio nuevo.
    async function addFotosGeneralesSection(doc, layout, fotos) {
        if (!fotos || !fotos.length) return;

        layout.sectionTitle("Fotos generales del vehículo");

        const colWidth = (layout.pageWidth - MARGIN_X * 2 - 20) / 2;
        const fotoMaxHeight = 140;

        for (let i = 0; i < fotos.length; i += 2) {
            layout.ensureSpace(fotoMaxHeight + 20);
            const startY = layout.y;
            const par = fotos.slice(i, i + 2);

            const alturas = await Promise.all(
                par.map((foto, indice) =>
                    addFirmaImage(doc, foto.url, {
                        x: MARGIN_X + indice * (colWidth + 20),
                        y: startY,
                        maxWidth: colWidth,
                        maxHeight: fotoMaxHeight
                    })
                )
            );

            layout.y = startY + Math.max(...alturas, 40) + 16;
        }

        layout.spacer(8);
    }

    async function addFirmasSection(doc, layout, entrega) {
        layout.sectionTitle("Firmas");
        layout.ensureSpace(140);

        const colWidth = (layout.pageWidth - MARGIN_X * 2 - 20) / 2;
        const firmaMaxHeight = 90;
        const startY = layout.y;

        const [alturaEntrega, alturaRecibe] = await Promise.all([
            addFirmaImage(doc, entrega.firma_entrega_url, { x: MARGIN_X, y: startY, maxWidth: colWidth, maxHeight: firmaMaxHeight }),
            addFirmaImage(doc, entrega.firma_recibe_url, { x: MARGIN_X + colWidth + 20, y: startY, maxWidth: colWidth, maxHeight: firmaMaxHeight })
        ]);

        const firmasAltura = Math.max(alturaEntrega, alturaRecibe, 40);
        layout.y = startY + firmasAltura + 10;

        doc.setDrawColor(220, 226, 234);
        doc.line(MARGIN_X, layout.y, MARGIN_X + colWidth, layout.y);
        doc.line(MARGIN_X + colWidth + 20, layout.y, layout.pageWidth - MARGIN_X, layout.y);
        layout.spacer(14);

        doc.setFontSize(10);
        doc.setFont(undefined, "bold");
        doc.text("Quien entrega", MARGIN_X, layout.y);
        doc.text("Quien recibe", MARGIN_X + colWidth + 20, layout.y);
        layout.spacer(14);

        doc.setFont(undefined, "normal");
        const entregaNombre = `${safe(entrega.usuario_entrega?.nombre, "Sin registrar")}${entrega.usuario_entrega?.email ? ` · ${entrega.usuario_entrega.email}` : ""}`;
        const recibeNombre = `${safe(entrega.usuario_recibe?.nombre, "Sin registrar")}${entrega.usuario_recibe?.email ? ` · ${entrega.usuario_recibe.email}` : ""}`;
        doc.text(doc.splitTextToSize(entregaNombre, colWidth), MARGIN_X, layout.y);
        doc.text(doc.splitTextToSize(recibeNombre, colWidth), MARGIN_X + colWidth + 20, layout.y);
        layout.spacer(24);
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

    async function exportEntregaPdf({ vehiculo, entrega }) {
        if (!entrega) {
            throw new Error("No hay un acta cargada para exportar");
        }

        const doc = await window.VehiAmb.pdfExport.createDocument();
        const layout = makeLayout(doc);
        const branding = await window.VehiAmb.pdfExport.getEmpresaBranding();

        await addHeader(doc, layout, vehiculo, branding);

        layout.sectionTitle("Información general");
        layout.row("Motivo", MOTIVO_LABEL[entrega.motivo] || entrega.motivo);
        layout.row("Fecha", formatDateTime(entrega.fecha));
        layout.row("Kilometraje", formatKm(entrega.kilometraje));
        layout.row("Quien entrega", entrega.usuario_entrega?.nombre);
        layout.row("Quien recibe", entrega.usuario_recibe?.nombre);
        layout.row("Registrado por", entrega.usuario_nombre);
        if (entrega.observaciones) {
            layout.row("Observaciones", entrega.observaciones);
        }
        layout.spacer();

        addChecklistTable(doc, layout, entrega.items);
        await addFotosGeneralesSection(doc, layout, entrega.fotos_generales);
        await addFirmasSection(doc, layout, entrega);

        await addFooter(doc, branding);

        doc.save(buildFileName(vehiculo, entrega));
    }

    window.VehiAmb = window.VehiAmb || {};
    window.VehiAmb.entregaExport = { exportEntregaPdf };
})();
