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
        if (filtros.conductor_nombre) partes.push(`Conductor: ${filtros.conductor_nombre}`);
        if (filtros.placa) partes.push(`Placa: ${filtros.placa}`);
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
    // "observacionesGenerales" es el comentario libre que el conductor deja
    // al final del formulario (distinto del comentario por item, que ya va
    // en la mini-tabla) -- antes no se traia del backend y se perdia.
    function addSeccion(doc, layout, bottomLimit, { titulo, color, fechaRegistro, filas, observacionesGenerales }) {
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
        addObservacionesGenerales(doc, layout, bottomLimit, observacionesGenerales);
    }

    function addObservacionesGenerales(doc, layout, bottomLimit, observaciones) {
        if (!observaciones) return;

        const maxWidth = layout.pageWidth - MARGIN_X * 2 - 10;
        const lineasLabel = doc.splitTextToSize(`Observaciones del conductor: ${observaciones}`, maxWidth);
        const alto = lineasLabel.length * ROW_LINE_HEIGHT + 8;

        if (layout.y + alto > bottomLimit) {
            doc.addPage();
            layout.y = 40;
        }

        doc.setFontSize(8.5);
        doc.setFont(undefined, "bold");
        doc.setTextColor(24, 32, 43);
        doc.text("Observaciones del conductor:", MARGIN_X + 10, layout.y);
        doc.setFont(undefined, "normal");
        doc.setTextColor(105, 115, 134);
        const lineasTexto = doc.splitTextToSize(observaciones, maxWidth - 140);
        doc.text(lineasTexto, MARGIN_X + 150, layout.y);
        doc.setTextColor(24, 32, 43);
        layout.y += Math.max(14, lineasTexto.length * ROW_LINE_HEIGHT) + 8;
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
                })),
                observacionesGenerales: item.inspeccion_observaciones
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
                })),
                observacionesGenerales: item.preoperacional_observaciones
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

    // ── PDF del "Resumen del dia" (panel de mi-viaje.js) ──────────────────
    // Mismo encabezado (logo de la empresa + filtros) y mismo pie con el
    // membrete que el reporte de viajes. Los textos que dependen de la fecha
    // (titulo, subtitulo, comparacion) llegan ya armados desde mi-viaje.js
    // para no duplicar aqui el formateo del panel.
    const AMBAR_ATENCION = [161, 92, 9];
    const AMBAR_FONDO = [255, 243, 218];
    const GRIS_TEXTO = [105, 115, 134];
    const TINTA = [24, 32, 43];

    function colorSeveridad(severidad) {
        return severidad === "critica" ? ROJO_MAL : AMBAR_ATENCION;
    }

    function addMetricasResumen(doc, layout, metricas) {
        const gap = 10;
        const alto = 56;
        const ancho = (layout.pageWidth - MARGIN_X * 2 - gap * (metricas.length - 1)) / metricas.length;

        metricas.forEach((metrica, index) => {
            const x = MARGIN_X + index * (ancho + gap);
            const fondo = metrica.tono === "critica" ? ROJO_MAL_FONDO : metrica.tono === "atencion" ? AMBAR_FONDO : [248, 250, 252];
            doc.setFillColor(...fondo);
            doc.setDrawColor(220, 226, 234);
            doc.rect(x, layout.y, ancho, alto, metrica.tono ? "F" : "FD");

            doc.setFontSize(8.5);
            doc.setFont(undefined, "normal");
            doc.setTextColor(...TINTA);
            doc.text(metrica.etiqueta, x + 8, layout.y + 14);
            doc.setFontSize(16);
            doc.setFont(undefined, "bold");
            doc.setTextColor(...(metrica.tono ? colorSeveridad(metrica.tono) : TINTA));
            doc.text(metrica.valor, x + 8, layout.y + 34);
            doc.setFontSize(8);
            doc.setFont(undefined, "normal");
            doc.setTextColor(...GRIS_TEXTO);
            doc.text(doc.splitTextToSize(metrica.nota, ancho - 16)[0] || "", x + 8, layout.y + 48);
        });

        doc.setTextColor(...TINTA);
        layout.y += alto + 24;
    }

    // Tabla simple con cifras alineadas a la derecha (align: "right" por
    // columna) y color por severidad en la celda que se indique.
    function addTablaResumen(doc, layout, bottomLimit, columnas, filas) {
        let x = MARGIN_X;
        const posicionadas = columnas.map((columna) => {
            const positioned = { ...columna, x };
            x += columna.width;
            return positioned;
        });

        const textoEnColumna = (lineas, columna) => {
            if (columna.align === "right") {
                doc.text(lineas, columna.x + columna.width - 6, layout.y, { align: "right" });
            } else {
                doc.text(lineas, columna.x + 6, layout.y);
            }
        };

        const encabezado = () => {
            doc.setFontSize(8.5);
            doc.setFont(undefined, "bold");
            doc.setFillColor(248, 250, 252);
            doc.rect(MARGIN_X, layout.y - 12, layout.pageWidth - MARGIN_X * 2, ROW_HEIGHT, "F");
            posicionadas.forEach((columna) => textoEnColumna(columna.label, columna));
            layout.y += 18;
            doc.setFont(undefined, "normal");
        };

        encabezado();

        filas.forEach((fila) => {
            const lineas = posicionadas.map((columna, index) => doc.splitTextToSize(String(fila.celdas[index]), columna.width - 12));
            const maxLines = Math.max(1, ...lineas.map((linea) => linea.length));
            const rowHeight = Math.max(16, maxLines * ROW_LINE_HEIGHT + 4);

            if (layout.y + rowHeight > bottomLimit) {
                doc.addPage();
                layout.y = 40;
                encabezado();
            }

            doc.setFontSize(8.5);
            posicionadas.forEach((columna, index) => {
                const conColor = fila.severidad && index === fila.celdaSeveridad;
                doc.setTextColor(...(conColor ? colorSeveridad(fila.severidad) : TINTA));
                doc.setFont(undefined, conColor ? "bold" : "normal");
                textoEnColumna(lineas[index], columna);
            });
            doc.setFont(undefined, "normal");
            doc.setTextColor(...TINTA);

            doc.setDrawColor(236, 240, 245);
            doc.line(MARGIN_X, layout.y + rowHeight - 12, layout.pageWidth - MARGIN_X, layout.y + rowHeight - 12);
            layout.y += rowHeight;
        });

        layout.y += 12;
    }

    function addLineaTexto(doc, layout, bottomLimit, texto, { color = GRIS_TEXTO, bold = false } = {}) {
        const lineas = doc.splitTextToSize(texto, layout.pageWidth - MARGIN_X * 2);
        if (layout.y + lineas.length * ROW_LINE_HEIGHT > bottomLimit) {
            doc.addPage();
            layout.y = 40;
        }
        doc.setFontSize(9);
        doc.setFont(undefined, bold ? "bold" : "normal");
        doc.setTextColor(...color);
        doc.text(lineas, MARGIN_X, layout.y);
        doc.setFont(undefined, "normal");
        doc.setTextColor(...TINTA);
        layout.y += lineas.length * ROW_LINE_HEIGHT + 8;
    }

    // Cumplimiento por conductor (rutas asignadas vs inspecciones y
    // preoperacionales hechos) + el detalle de cada ruta incompleta. Las
    // filas llegan ya formateadas desde mi-viaje.js (cumplimientoParaExportar).
    function addCumplimientoPdf(doc, layout, bottomLimit, cumplimiento) {
        const { totales, conductores, pendientes } = cumplimiento;
        const ancho = layout.pageWidth - MARGIN_X * 2;

        addSeccionTitulo(doc, layout, bottomLimit, {
            titulo: "Cumplimiento por conductor",
            color: [238, 241, 245],
            subtitulo: `Inspecciones ${totales.inspecciones}/${totales.asignadas} · Preoperacionales ${totales.preoperacionales}/${totales.asignadas}`
        });
        addTablaResumen(doc, layout, bottomLimit, [
            { label: "Conductor", width: ancho - 300 },
            { label: "Rutas", width: 60, align: "right" },
            { label: "Inspecciones", width: 80, align: "right" },
            { label: "Preoperacionales", width: 95, align: "right" },
            { label: "Incompletas", width: 65, align: "right" }
        ], conductores.map((conductor) => ({
            celdas: [
                conductor.nombre,
                conductor.asignadas,
                `${conductor.inspecciones}/${conductor.asignadas}`,
                `${conductor.preoperacionales}/${conductor.asignadas}`,
                conductor.incompletas || "Al día"
            ],
            severidad: conductor.incompletas ? "atencion" : null,
            celdaSeveridad: 4
        })));

        if (!pendientes.length) return;

        addSeccionTitulo(doc, layout, bottomLimit, {
            titulo: "Rutas con inspección o preoperacional pendiente",
            color: [238, 241, 245],
            subtitulo: `${pendientes.length} ${pendientes.length === 1 ? "ruta" : "rutas"}`
        });
        addTablaResumen(doc, layout, bottomLimit, [
            { label: "Fecha", width: 70 },
            { label: "Conductor", width: ancho - 355 },
            { label: "Placa", width: 65 },
            { label: "Ruta", width: 95 },
            { label: "Pendiente", width: 125 }
        ], pendientes.map((pendiente) => ({
            celdas: [pendiente.fecha, pendiente.conductor, pendiente.placa, pendiente.ruta, pendiente.falta],
            severidad: "atencion",
            celdaSeveridad: 4
        })));
    }

    // Excel de cumplimiento: hoja "Por conductor" y hoja "Pendientes" (una
    // fila por ruta asignada donde falto la inspeccion o el preoperacional).
    async function exportCumplimientoExcel(cumplimiento, filtros = {}, rango = {}) {
        if (!cumplimiento || !cumplimiento.conductores.length) {
            throw new Error("No hay rutas asignadas en este período para medir el cumplimiento");
        }

        const excel = window.VehiAmb.excelExport;
        const branding = await window.VehiAmb.pdfExport.getEmpresaBranding();
        const { totales, conductores, pendientes } = cumplimiento;

        const workbook = await excel.createWorkbook();
        const hoja = workbook.addWorksheet("Por conductor");
        const columnas = ["Conductor", "Rutas asignadas", "Inspecciones hechas", "Preoperacionales hechos", "Rutas incompletas"];
        excel.setColumnWidths(hoja, [34, 16, 20, 24, 18]);
        excel.addTitleBar(hoja, {
            title: "Cumplimiento de inspecciones y preoperacionales",
            subtitle: APP_NAME,
            columnCount: columnas.length,
            logo: branding?.logo
        });
        excel.addLabelValueRow(hoja, "Filtros aplicados:", describeFiltros(filtros));
        excel.addLabelValueRow(hoja, "Inspecciones:", `${totales.inspecciones} de ${totales.asignadas} rutas asignadas`);
        excel.addLabelValueRow(hoja, "Preoperacionales:", `${totales.preoperacionales} de ${totales.asignadas} rutas asignadas`);
        hoja.addRow([]);
        excel.addTableHeaderRow(hoja, columnas);
        conductores.forEach((conductor, indice) => {
            excel.addTableDataRow(
                hoja,
                [conductor.nombre, conductor.asignadas, conductor.inspecciones, conductor.preoperacionales, conductor.incompletas],
                { band: indice % 2 === 1 }
            );
        });
        excel.addFooterRow(hoja, FOOTER_TEXT(branding?.nombreEmpresa), columnas.length);

        const hojaPendientes = workbook.addWorksheet("Pendientes");
        const columnasPendientes = ["Fecha", "Conductor", "Placa", "Ruta", "Pendiente"];
        excel.setColumnWidths(hojaPendientes, [14, 34, 12, 26, 34]);
        excel.addTitleBar(hojaPendientes, {
            title: "Rutas con inspección o preoperacional pendiente",
            subtitle: `${pendientes.length} ${pendientes.length === 1 ? "ruta" : "rutas"}`,
            columnCount: columnasPendientes.length
        });
        excel.addTableHeaderRow(hojaPendientes, columnasPendientes);
        if (pendientes.length) {
            pendientes.forEach((pendiente, indice) => {
                excel.addTableDataRow(
                    hojaPendientes,
                    [pendiente.fecha, pendiente.conductor, pendiente.placa, pendiente.ruta, pendiente.falta],
                    { band: indice % 2 === 1 }
                );
            });
        } else {
            excel.addTableDataRow(hojaPendientes, ["Todos los conductores cumplieron en este período", "", "", "", ""]);
        }
        excel.addFooterRow(hojaPendientes, FOOTER_TEXT(branding?.nombreEmpresa), columnasPendientes.length);

        const sufijoRango = rango.desde && rango.hasta && rango.desde !== rango.hasta ? `${rango.desde}_a_${rango.hasta}` : (rango.desde || "");
        await excel.downloadWorkbook(workbook, `Cumplimiento_conductores_${sufijoRango}.xlsx`);
    }

    async function exportResumenDiaPdf(resumen, filtros, textos) {
        if (!resumen || !resumen.totales?.viajes) {
            throw new Error("No hay viajes registrados en este período");
        }

        const doc = await window.VehiAmb.pdfExport.createDocument({ orientation: "portrait" });
        const pageWidth = doc.internal.pageSize.getWidth();
        const bottomLimit = doc.internal.pageSize.getHeight() - 130;
        const branding = await window.VehiAmb.pdfExport.getEmpresaBranding();

        let y = 40;
        const layout = {
            get y() { return y; },
            set y(value) { y = value; },
            pageWidth
        };

        await addHeader(doc, layout, filtros, resumen.totales.viajes, branding, textos.titulo);
        addLineaTexto(doc, layout, bottomLimit, textos.subtitulo, { color: TINTA, bold: true });
        layout.y += 4;
        addMetricasResumen(doc, layout, textos.metricas);

        if (textos.notaSinRegistro) {
            addLineaTexto(doc, layout, bottomLimit, textos.notaSinRegistro);
        }

        if (textos.cumplimiento) {
            addCumplimientoPdf(doc, layout, bottomLimit, textos.cumplimiento);
        }

        if (resumen.hallazgosPorTipo.length) {
            addSeccionTitulo(doc, layout, bottomLimit, { titulo: "Qué se está repitiendo", color: [238, 241, 245], subtitulo: "Agrupado por tipo de hallazgo" });
            addTablaResumen(doc, layout, bottomLimit, [
                { label: "Tipo de hallazgo", width: 245 },
                { label: "Severidad", width: 120 },
                { label: "Vehículos", width: 75, align: "right" },
                { label: "Hallazgos", width: pageWidth - MARGIN_X * 2 - 440, align: "right" }
            ], resumen.hallazgosPorTipo.map((tipo) => ({
                celdas: [tipo.tipo, tipo.severidad === "critica" ? "Impide operar" : "Requiere atención", tipo.vehiculos, tipo.hallazgos],
                severidad: tipo.severidad,
                celdaSeveridad: 1
            })));

            addSeccionTitulo(doc, layout, bottomLimit, { titulo: "Vehículos que requieren atención", color: [238, 241, 245], subtitulo: "De mayor a menor cantidad de hallazgos" });
            addTablaResumen(doc, layout, bottomLimit, [
                { label: "Placa", width: 80 },
                { label: "Tipos de hallazgo", width: pageWidth - MARGIN_X * 2 - 160 },
                { label: "Hallazgos", width: 80, align: "right" }
            ], resumen.vehiculosAfectados.map((vehiculo) => ({
                celdas: [safe(vehiculo.placa, "Sin placa"), vehiculo.tipos.join(", "), vehiculo.total],
                severidad: vehiculo.severidad,
                celdaSeveridad: 2
            })));
        } else {
            addLineaTexto(doc, layout, bottomLimit, textos.mensajeSinHallazgos, { color: [20, 122, 69], bold: true });
        }

        addLineaTexto(doc, layout, bottomLimit, textos.comparacion);

        await addFooter(doc, branding);

        doc.save(`Resumen_viajes_${resumen.rango.desde}${resumen.rango.hasta !== resumen.rango.desde ? `_a_${resumen.rango.hasta}` : ""}.pdf`);
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

            // Comentario libre del conductor (distinto de la observacion por
            // item de arriba) -- se agrega como fila aparte, una por tipo,
            // solo cuando el conductor la diligencio.
            if (item.preoperacional_observaciones) {
                excel.addTableDataRow(
                    detalleSheet,
                    [fecha, placa, conductor, "Preoperacional", "(Observación general)", "", item.preoperacional_observaciones],
                    { band: bandaDetalle }
                );
                bandaDetalle = !bandaDetalle;
            }

            (item.inspeccion_items || []).forEach((detalleItem) => {
                excel.addTableDataRow(
                    detalleSheet,
                    [fecha, placa, conductor, "Inspección", detalleItem.item_label, detalleItem.estado === "mal" ? "Mal estado" : "Bien", safe(detalleItem.comentario, "")],
                    { band: bandaDetalle }
                );
                bandaDetalle = !bandaDetalle;
            });

            if (item.inspeccion_observaciones) {
                excel.addTableDataRow(
                    detalleSheet,
                    [fecha, placa, conductor, "Inspección", "(Observación general)", "", item.inspeccion_observaciones],
                    { band: bandaDetalle }
                );
                bandaDetalle = !bandaDetalle;
            }
        });

        excel.addFooterRow(detalleSheet, FOOTER_TEXT(branding?.nombreEmpresa), detalleColumnas.length);

        await excel.downloadWorkbook(workbook, buildFileName("xlsx"));
    }

    window.VehiAmb = window.VehiAmb || {};
    window.VehiAmb.miViajeExport = { exportViajesPdf, exportViajesExcel, exportResumenDiaPdf, exportCumplimientoExcel };
})();
