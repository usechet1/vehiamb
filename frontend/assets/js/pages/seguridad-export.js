(function () {
    const APP_NAME = "Vehiamb";
    const MARGIN_X = 40;
    const FOOTER_TEXT = (nombreEmpresa) => (nombreEmpresa ? `Generado por ${APP_NAME} para ${nombreEmpresa}` : `Generado por ${APP_NAME}`);
    const ROJO_BANNER = [200, 22, 30];
    const GRIS_CAMPO = [230, 232, 235];
    const ROJO_CLARO_ENCABEZADO = [235, 162, 170];
    const BLANCO_FILA = [255, 255, 255];
    const GRIS_FILA = [246, 248, 250];
    const ROJO_TEXTO_MALO = [178, 31, 45];
    const ROJO_FONDO_MALO = [252, 233, 235];
    const ROW_HEIGHT = 20;
    const ROW_LINE_HEIGHT = 12;
    const ROW_PADDING = 8;

    function formatFecha(valor) {
        if (!valor) return "--";
        const fecha = new Date(`${String(valor).slice(0, 10)}T00:00:00`);
        if (Number.isNaN(fecha.getTime())) return "--";
        return `${String(fecha.getDate()).padStart(2, "0")}/${String(fecha.getMonth() + 1).padStart(2, "0")}/${fecha.getFullYear()}`;
    }

    function safe(value, fallback = "--") {
        if (value === null || value === undefined || value === "") return fallback;
        return String(value);
    }

    function nombreCompleto(nombres, apellidos) {
        return `${nombres || ""} ${apellidos || ""}`.trim();
    }

    async function addEncabezado(doc, branding, inspeccion, tituloLinea1, tituloLinea2) {
        const pageWidth = doc.internal.pageSize.getWidth();
        const bannerX = MARGIN_X + 120;
        const bannerHeight = 60;
        const bannerY = 30;

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
        doc.setFontSize(14);
        doc.text(tituloLinea1, bannerX + (pageWidth - MARGIN_X - bannerX) / 2, bannerY + bannerHeight / 2 - 2, { align: "center" });
        doc.setFontSize(11);
        doc.text(tituloLinea2, bannerX + (pageWidth - MARGIN_X - bannerX) / 2, bannerY + bannerHeight / 2 + 14, { align: "center" });

        // Bloque de datos de la cabecera del formato, en dos columnas.
        let y = bannerY + bannerHeight + 16;
        const anchoCampo = (pageWidth - MARGIN_X * 2) / 2;
        const campos = [
            ["FECHA DE LA INSPECCIÓN", formatFecha(inspeccion.fecha)],
            ["VEHÍCULO", `${safe(inspeccion.placa)} ${`${inspeccion.marca || ""} ${inspeccion.modelo || ""}`.trim()}`.trim()],
            ["INSPECCIONADO POR", safe(nombreCompleto(inspeccion.inspeccionado_por_nombres, inspeccion.inspeccionado_por_apellidos))],
            ["CARGO", safe(inspeccion.inspeccionado_por_cargo)]
        ];

        doc.setTextColor(24, 32, 43);
        doc.setFontSize(9);

        campos.forEach(([label, valor], indice) => {
            const columna = indice % 2;
            const x = MARGIN_X + columna * anchoCampo;
            if (columna === 0 && indice > 0) y += 22;

            doc.setFillColor(...GRIS_CAMPO);
            doc.rect(x, y, anchoCampo, 22, "F");
            doc.setDrawColor(200, 200, 200);
            doc.rect(x, y, anchoCampo, 22);

            doc.setFont(undefined, "bold");
            doc.text(`${label}:`, x + 5, y + 14);
            doc.setFont(undefined, "normal");
            doc.text(doc.splitTextToSize(valor, anchoCampo - 130)[0] || "--", x + 125, y + 14);
        });

        return y + 34;
    }

    function addTablaHeader(doc, y, columns, tableWidth) {
        doc.setFillColor(...ROJO_CLARO_ENCABEZADO);
        doc.rect(MARGIN_X, y, tableWidth, ROW_HEIGHT, "F");
        doc.setDrawColor(190, 190, 190);
        doc.rect(MARGIN_X, y, tableWidth, ROW_HEIGHT);
        doc.setTextColor(24, 32, 43);
        doc.setFont(undefined, "bold");
        doc.setFontSize(9);
        columns.forEach((column) => doc.text(column.label, column.x + 4, y + ROW_HEIGHT / 2 + 3));
        doc.setFont(undefined, "normal");
        return y + ROW_HEIGHT;
    }

    function addTablaItems(doc, startY, items, columnaContenidoLabel, columnaExtra) {
        const pageWidth = doc.internal.pageSize.getWidth();
        const bottomLimit = doc.internal.pageSize.getHeight() - 90;
        const tableWidth = pageWidth - MARGIN_X * 2;

        const anchoEstado = 70;
        const anchoCantidad = 70;
        const anchoExtra = 90;
        const anchoContenido = tableWidth - (anchoEstado + anchoCantidad + anchoExtra);

        const columns = [
            { label: columnaContenidoLabel, x: MARGIN_X, width: anchoContenido },
            { label: "ESTADO", x: MARGIN_X + anchoContenido, width: anchoEstado },
            { label: "CANTIDAD", x: MARGIN_X + anchoContenido + anchoEstado, width: anchoCantidad },
            { label: columnaExtra.label, x: MARGIN_X + anchoContenido + anchoEstado + anchoCantidad, width: anchoExtra }
        ];

        let y = addTablaHeader(doc, startY, columns, tableWidth);
        doc.setFontSize(9);

        items.forEach((item, indice) => {
            const esMalo = item.estado === "malo";
            const valores = [
                safe(item.item_label),
                esMalo ? "MALO" : "BUENO",
                item.cantidad !== null && item.cantidad !== undefined ? String(item.cantidad) : "--",
                columnaExtra.getValor(item)
            ];

            const columnLines = columns.map((column, colIndex) => doc.splitTextToSize(valores[colIndex], column.width - 8));
            const maxLines = Math.max(1, ...columnLines.map((lines) => lines.length));
            const rowHeight = Math.max(ROW_HEIGHT, maxLines * ROW_LINE_HEIGHT + ROW_PADDING);

            if (y + rowHeight > bottomLimit) {
                doc.addPage();
                y = addTablaHeader(doc, 40, columns, tableWidth);
                doc.setFontSize(9);
            }

            // Los insumos en mal estado se resaltan: son la razon por la que
            // se hace la inspeccion, y en el formato en papel se marcan a mano.
            doc.setFillColor(...(esMalo ? ROJO_FONDO_MALO : indice % 2 === 0 ? BLANCO_FILA : GRIS_FILA));
            doc.rect(MARGIN_X, y, tableWidth, rowHeight, "F");
            doc.setDrawColor(220, 220, 220);
            doc.rect(MARGIN_X, y, tableWidth, rowHeight);

            columns.forEach((column, colIndex) => {
                if (esMalo) {
                    doc.setTextColor(...ROJO_TEXTO_MALO);
                    doc.setFont(undefined, "bold");
                } else {
                    doc.setTextColor(24, 32, 43);
                    doc.setFont(undefined, "normal");
                }
                doc.text(columnLines[colIndex], column.x + 4, y + 13);
            });

            doc.setTextColor(24, 32, 43);
            doc.setFont(undefined, "normal");
            y += rowHeight;
        });

        return y;
    }

    function addCierre(doc, y, inspeccion) {
        const pageWidth = doc.internal.pageSize.getWidth();
        const bottomLimit = doc.internal.pageSize.getHeight() - 90;
        const anchoTotal = pageWidth - MARGIN_X * 2;

        // El bloque de cierre (revisado por + observaciones) no se debe partir
        // a la mitad entre dos paginas.
        const observaciones = doc.splitTextToSize(safe(inspeccion.observaciones, "Sin observaciones"), anchoTotal - 10);
        const altoBloque = 22 + 22 + observaciones.length * ROW_LINE_HEIGHT + 20;

        if (y + altoBloque > bottomLimit) {
            doc.addPage();
            y = 40;
        } else {
            y += 14;
        }

        const revisor = nombreCompleto(inspeccion.revisado_por_nombres, inspeccion.revisado_por_apellidos);

        doc.setFontSize(9);
        doc.setFillColor(...GRIS_CAMPO);
        doc.rect(MARGIN_X, y, anchoTotal, 22, "F");
        doc.setDrawColor(200, 200, 200);
        doc.rect(MARGIN_X, y, anchoTotal, 22);
        doc.setFont(undefined, "bold");
        doc.text("REVISADO POR:", MARGIN_X + 5, y + 14);
        doc.setFont(undefined, "normal");
        doc.text(doc.splitTextToSize(safe(revisor), anchoTotal - 100)[0] || "--", MARGIN_X + 95, y + 14);

        y += 22;

        doc.setFillColor(...GRIS_CAMPO);
        doc.rect(MARGIN_X, y, anchoTotal, 22, "F");
        doc.setDrawColor(200, 200, 200);
        doc.rect(MARGIN_X, y, anchoTotal, 22);
        doc.setFont(undefined, "bold");
        doc.text("OBSERVACIONES GENERALES:", MARGIN_X + 5, y + 14);
        doc.setFont(undefined, "normal");

        y += 22;
        doc.rect(MARGIN_X, y, anchoTotal, observaciones.length * ROW_LINE_HEIGHT + 10);
        doc.text(observaciones, MARGIN_X + 5, y + 14);

        return y + observaciones.length * ROW_LINE_HEIGHT + 10;
    }

    // Membrete institucional al pie, en todas las paginas -- convencion de
    // todos los exportables de la app.
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

    // Compartida entre botiquin y kit de herramientas: el dibujo del PDF es
    // identico en los dos (mismo encabezado con logo, misma tabla de items,
    // mismo cierre con revisado-por/observaciones), solo cambia el titulo
    // del banner, el encabezado de la columna de contenido, la cuarta
    // columna (vencimiento en botiquin, codigo en herramientas -- estas no
    // vencen) y el nombre del archivo. Mismo criterio de reuso que
    // normalizarItemsChecklist en seguridad.service.js.
    async function exportInspeccionChecklistPdf(inspeccion, { tituloLinea1, tituloLinea2, columnaContenidoLabel, columnaExtra, filePrefix }) {
        if (!inspeccion || !inspeccion.items?.length) {
            throw new Error("La inspección no tiene ítems para exportar");
        }

        const doc = await window.VehiAmb.pdfExport.createDocument();
        const branding = await window.VehiAmb.pdfExport.getEmpresaBranding();

        const startY = await addEncabezado(doc, branding, inspeccion, tituloLinea1, tituloLinea2);
        const tablaY = addTablaItems(doc, startY, inspeccion.items, columnaContenidoLabel, columnaExtra);
        addCierre(doc, tablaY, inspeccion);
        await addFooter(doc, branding);

        doc.save(`${filePrefix}-${inspeccion.placa || "vehiculo"}-${String(inspeccion.fecha).slice(0, 10)}.pdf`);
    }

    function exportInspeccionBotiquinPdf(inspeccion) {
        return exportInspeccionChecklistPdf(inspeccion, {
            tituloLinea1: "FORMATO INSPECCIÓN DE BOTIQUINES",
            tituloLinea2: "VEHÍCULOS",
            columnaContenidoLabel: "CONTENIDO BOTIQUÍN PRIMEROS AUXILIOS",
            columnaExtra: {
                label: "VENCIMIENTO",
                getValor: (item) => (item.fecha_vencimiento ? formatFecha(item.fecha_vencimiento) : "--")
            },
            filePrefix: "inspeccion-botiquin"
        });
    }

    function exportInspeccionHerramientasPdf(inspeccion) {
        return exportInspeccionChecklistPdf(inspeccion, {
            tituloLinea1: "FORMATO INSPECCIÓN DE KIT DE",
            tituloLinea2: "HERRAMIENTAS VEHÍCULOS",
            columnaContenidoLabel: "CONTENIDO KIT DE HERRAMIENTAS",
            columnaExtra: {
                label: "CÓDIGO",
                getValor: (item) => safe(item.codigo)
            },
            filePrefix: "inspeccion-herramientas"
        });
    }

    window.VehiAmb = window.VehiAmb || {};
    window.VehiAmb.seguridadExport = { exportInspeccionBotiquinPdf, exportInspeccionHerramientasPdf };
})();
