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

    // El PDF se reemplazo por una imagen JPG (ver exportReporteImagen mas
    // abajo): mismo layout, dibujado con Canvas 2D en vez del API de jsPDF,
    // asi que ninguna de estas funciones necesita cargar jsPDF por CDN.
    const PAGE_WIDTH_IMAGEN = 842; // misma proporcion que el A4 horizontal que usaba el PDF
    const CANVAS_SCALE = 2; // resolucion mas nitida sin generar un archivo enorme
    const CANVAS_FUENTE = "Helvetica, Arial, sans-serif";

    function fuenteCanvas(size, bold) {
        return `${bold ? "bold " : ""}${size}px ${CANVAS_FUENTE}`;
    }

    function loadImageElement(dataUrl) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error("No se pudo cargar la imagen"));
            img.src = dataUrl;
        });
    }

    // Equivalente a doc.splitTextToSize de jsPDF, pero contra measureText de
    // Canvas -- Canvas no envuelve texto largo solo, hay que partirlo a mano.
    function wrapTextCanvas(ctx, text, maxWidth) {
        const palabras = String(text).split(" ");
        const lineas = [];
        let lineaActual = "";

        palabras.forEach((palabra) => {
            const intento = lineaActual ? `${lineaActual} ${palabra}` : palabra;
            if (lineaActual && ctx.measureText(intento).width > maxWidth) {
                lineas.push(lineaActual);
                lineaActual = palabra;
            } else {
                lineaActual = intento;
            }
        });

        if (lineaActual) lineas.push(lineaActual);
        return lineas.length ? lineas : [""];
    }

    // Recorta con "…" en vez de envolver -- usado en NOMBRE, que se quiere
    // siempre en una sola linea aunque el nombre sea muy largo (a diferencia
    // de RUTA, que si envuelve con wrapTextCanvas).
    function truncarTextoCanvas(ctx, text, maxWidth) {
        const texto = String(text);
        if (ctx.measureText(texto).width <= maxWidth) return texto;

        let recortado = texto;
        while (recortado.length > 1 && ctx.measureText(`${recortado}…`).width > maxWidth) {
            recortado = recortado.slice(0, -1);
        }
        return `${recortado}…`;
    }

    function calcularColumnasImagen(tableWidth) {
        // RUTA es la columna de texto libre que mas necesita espacio (las
        // rutas con varios destinos pueden ser mucho mas largas que un
        // nombre), pero NOMBRE nunca se envuelve (ver medirFilasImagen) y no
        // se quiere que se trunque con "..." en el uso normal -- por eso
        // lleva mas ancho del minimo, a costa del sobrante que se queda RUTA.
        const anchoNumero = 30;
        const anchoNombre = 220;
        const anchoTelefono = 80;
        const anchoPlaca = 75;
        const anchoRuta = tableWidth - (anchoNumero + anchoNombre + anchoTelefono + anchoPlaca);

        let x = MARGIN_X;
        return [
            ["#", anchoNumero],
            ["NOMBRE", anchoNombre],
            ["RUTA", anchoRuta],
            ["TELEFONO", anchoTelefono],
            ["PLACA", anchoPlaca]
        ].map(([label, width]) => {
            const columna = { label, x, width };
            x += width;
            return columna;
        });
    }

    // Mide de una vez el alto de cada fila (segun cuantas lineas necesite
    // envolver la columna mas larga) para poder calcular el alto total de la
    // imagen ANTES de crear el canvas final -- a diferencia del PDF, una
    // imagen no tiene paginas: se dibuja completa de una sola vez.
    function medirFilasImagen(ctxMedicion, asignaciones, columns) {
        ctxMedicion.font = fuenteCanvas(10, false);
        return asignaciones.map((item, indice) => {
            const valores = [
                String(indice + 1),
                safe(item.conductor_nombre, "Sin conductor"),
                safe(item.ruta_nombre),
                safe(item.telefono),
                safe(item.vehiculo_placa, "Sin vehículo")
            ];
            // NOMBRE (columna 1) nunca se envuelve -- se quiere en una sola
            // linea aunque sea larga, a diferencia de RUTA que si necesita
            // envolver cuando trae varios destinos. Si no cabe se recorta
            // con "…" en vez de desbordarse sobre las columnas vecinas.
            const columnLines = columns.map((column, colIndex) => (
                colIndex === 1
                    ? [truncarTextoCanvas(ctxMedicion, valores[colIndex], column.width - 8)]
                    : wrapTextCanvas(ctxMedicion, valores[colIndex], column.width - 8)
            ));
            const maxLines = Math.max(1, ...columnLines.map((lines) => lines.length));
            const altura = Math.max(ROW_HEIGHT, maxLines * ROW_LINE_HEIGHT + ROW_PADDING);
            return { columnLines, altura };
        });
    }

    async function dibujarEncabezadoImagen(ctx, branding, fechaISO, totalRegistros) {
        const bannerX = MARGIN_X + 120;
        const bannerHeight = 60;
        const bannerY = 30;

        // Logo de la empresa a la izquierda, mismo criterio que
        // entrega-export.js/vehiculo-export.js (getEmpresaBranding): cada
        // empresa lleva su propio logo, sin membrete generico de plataforma.
        ctx.strokeStyle = "rgb(200, 200, 200)";
        ctx.strokeRect(MARGIN_X, bannerY, 110, bannerHeight);
        if (branding?.logo) {
            const logoImg = await loadImageElement(branding.logo.dataUrl);
            const maxWidth = 100;
            const maxHeight = bannerHeight - 10;
            const scale = Math.min(maxWidth / branding.logo.width, maxHeight / branding.logo.height);
            const w = branding.logo.width * scale;
            const h = branding.logo.height * scale;
            ctx.drawImage(logoImg, MARGIN_X + (110 - w) / 2, bannerY + (bannerHeight - h) / 2, w, h);
        }

        ctx.fillStyle = `rgb(${ROJO_BANNER.join(", ")})`;
        ctx.fillRect(bannerX, bannerY, PAGE_WIDTH_IMAGEN - MARGIN_X - bannerX, bannerHeight);
        ctx.fillStyle = "#ffffff";
        ctx.font = fuenteCanvas(20, true);
        ctx.textAlign = "center";
        ctx.fillText("REPORTE DE VEHÍCULOS", bannerX + (PAGE_WIDTH_IMAGEN - MARGIN_X - bannerX) / 2, bannerY + bannerHeight / 2 + 7);

        const fechaY = bannerY + bannerHeight + 18;
        ctx.fillStyle = `rgb(${GRIS_FECHA.join(", ")})`;
        ctx.fillRect(MARGIN_X, fechaY - 14, PAGE_WIDTH_IMAGEN - MARGIN_X * 2, 22);
        ctx.fillStyle = "rgb(24, 32, 43)";
        ctx.font = fuenteCanvas(11, false);
        ctx.fillText(`FECHA: ${formatFechaLarga(fechaISO)}`, PAGE_WIDTH_IMAGEN / 2, fechaY + 1);

        const totalY = fechaY + 28;
        ctx.font = fuenteCanvas(10, true);
        ctx.textAlign = "left";
        ctx.fillText(`Total de vehículos: ${totalRegistros}`, MARGIN_X, totalY);

        return totalY + 16;
    }

    function dibujarTablaHeaderImagen(ctx, y, columns, tableWidth) {
        ctx.fillStyle = `rgb(${ROJO_CLARO_ENCABEZADO.join(", ")})`;
        ctx.fillRect(MARGIN_X, y, tableWidth, ROW_HEIGHT);
        ctx.strokeStyle = "rgb(190, 190, 190)";
        ctx.strokeRect(MARGIN_X, y, tableWidth, ROW_HEIGHT);
        ctx.fillStyle = "rgb(24, 32, 43)";
        ctx.font = fuenteCanvas(10, true);
        ctx.textAlign = "center";
        columns.forEach((column) => ctx.fillText(column.label, column.x + column.width / 2, y + ROW_HEIGHT / 2 + 3));
        return y + ROW_HEIGHT;
    }

    function dibujarTablaImagen(ctx, startY, columns, filasMedidas, tableWidth) {
        let y = dibujarTablaHeaderImagen(ctx, startY, columns, tableWidth);
        ctx.font = fuenteCanvas(10, false);
        ctx.textAlign = "center";

        filasMedidas.forEach((fila, indice) => {
            ctx.fillStyle = `rgb(${(indice % 2 === 0 ? BLANCO_FILA : ROJO_CLARO_FILA).join(", ")})`;
            ctx.fillRect(MARGIN_X, y, tableWidth, fila.altura);
            ctx.strokeStyle = "rgb(220, 220, 220)";
            ctx.strokeRect(MARGIN_X, y, tableWidth, fila.altura);

            ctx.fillStyle = "rgb(24, 32, 43)";
            columns.forEach((column, colIndex) => {
                const lineas = fila.columnLines[colIndex];
                const inicioY = y + fila.altura / 2 - ((lineas.length - 1) * ROW_LINE_HEIGHT) / 2 + 3;
                lineas.forEach((linea, lineaIndex) => {
                    ctx.fillText(linea, column.x + column.width / 2, inicioY + lineaIndex * ROW_LINE_HEIGHT);
                });
            });

            y += fila.altura;
        });

        return y;
    }

    async function dibujarFooterImagen(ctx, startY, branding, membrete) {
        const generado = FOOTER_TEXT(branding?.nombreEmpresa);
        const y = startY + 20;

        ctx.font = fuenteCanvas(8, false);
        ctx.fillStyle = "rgb(120, 128, 140)";
        ctx.textAlign = "left";
        ctx.fillText(generado, MARGIN_X, y);

        if (!membrete) return y + 20;

        const imgWidth = PAGE_WIDTH_IMAGEN - MARGIN_X * 2;
        const imgHeight = imgWidth / (membrete.width / membrete.height);
        const membreteImg = await loadImageElement(membrete.dataUrl);
        ctx.drawImage(membreteImg, MARGIN_X, y + 10, imgWidth, imgHeight);
        return y + 10 + imgHeight + 10;
    }

    function calcularAlturaFooter(membrete) {
        if (!membrete) return 40;
        const imgWidth = PAGE_WIDTH_IMAGEN - MARGIN_X * 2;
        const imgHeight = imgWidth / (membrete.width / membrete.height);
        return 30 + imgHeight;
    }

    // Igual patron que downloadWorkbook en excel-export.js: un Blob +
    // URL.createObjectURL, no una data: URI directa en el href. Las data:
    // URI de este tamano (canvas.toDataURL) no disparan la descarga de forma
    // confiable en la PWA instalada -- el navegador normal si las acepta,
    // pero el contenedor de la PWA las trata como navegacion/vista en vez de
    // descarga.
    function canvasToBlob(canvas, calidad) {
        return new Promise((resolve, reject) => {
            canvas.toBlob((blob) => {
                if (blob) resolve(blob);
                else reject(new Error("No se pudo generar la imagen"));
            }, "image/jpeg", calidad);
        });
    }

    function descargarBlob(blob, fileName) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    }

    async function exportReporteImagen({ fecha, asignaciones }) {
        if (!asignaciones || !asignaciones.length) {
            throw new Error("No hay asignaciones registradas para esta fecha");
        }

        const branding = await window.VehiAmb.pdfExport.getEmpresaBranding();
        const membrete = await window.VehiAmb.pdfExport.getMembreteFooterImage();

        const tableWidth = PAGE_WIDTH_IMAGEN - MARGIN_X * 2;
        const columns = calcularColumnasImagen(tableWidth);

        // Canvas descartable, solo para medir texto con measureText antes de
        // saber el alto final -- no se dibuja nada en el.
        const ctxMedicion = document.createElement("canvas").getContext("2d");
        const filasMedidas = medirFilasImagen(ctxMedicion, asignaciones, columns);

        const alturaEncabezado = 30 + 60 + 18 + 22 + 28 + 16; // igual al valor que devuelve dibujarEncabezadoImagen
        const alturaTabla = ROW_HEIGHT + filasMedidas.reduce((total, fila) => total + fila.altura, 0);
        const alturaFooter = calcularAlturaFooter(membrete);
        const alturaTotal = alturaEncabezado + alturaTabla + alturaFooter;

        const canvas = document.createElement("canvas");
        canvas.width = PAGE_WIDTH_IMAGEN * CANVAS_SCALE;
        canvas.height = alturaTotal * CANVAS_SCALE;
        const ctx = canvas.getContext("2d");
        ctx.scale(CANVAS_SCALE, CANVAS_SCALE);

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, PAGE_WIDTH_IMAGEN, alturaTotal);

        const startY = await dibujarEncabezadoImagen(ctx, branding, fecha, asignaciones.length);
        const tablaY = dibujarTablaImagen(ctx, startY, columns, filasMedidas, tableWidth);
        await dibujarFooterImagen(ctx, tablaY, branding, membrete);

        const blob = await canvasToBlob(canvas, 0.92);
        descargarBlob(blob, `Reporte_vehiculos_${fecha}.jpg`);
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

    // Las 5 primeras columnas (#, NOMBRE, RUTA, TELEFONO, PLACA) son la
    // informacion de la ruta en si; las 5 siguientes (OBSERVACIONES en
    // adelante) son el seguimiento manual de dinero que solo tiene sentido
    // para quien despacha. La hoja "sin valores" (ver exportReporteExcel)
    // reusa exactamente las 5 primeras para un reporte limpio, pensado para
    // compartir con el conductor/otras personas sin exponer esos datos.
    const COLUMNAS_RUTA = EXCEL_COLUMN_WIDTHS.slice(0, 5);

    function centrarFila(row) {
        row.eachCell({ includeEmpty: true }, (cell) => {
            cell.alignment = { horizontal: "center", vertical: "middle" };
        });
    }

    function construirHojaReporte(workbook, { nombreHoja, fecha, asignaciones, branding, conValores }) {
        const excel = window.VehiAmb.excelExport;
        const columnas = conValores ? EXCEL_COLUMN_WIDTHS : COLUMNAS_RUTA;
        const columnCount = columnas.length;

        const sheet = workbook.addWorksheet(nombreHoja);
        excel.setColumnWidths(sheet, columnas.map((column) => column.width));

        excel.addTitleBar(sheet, {
            title: "REPORTE DE VEHÍCULOS",
            subtitle: `Fecha: ${formatFechaLarga(fecha)}`,
            columnCount,
            logo: branding?.logo,
            size: 28,
            align: "center",
            // La columna "#" (A) queda angosta a proposito (ver
            // EXCEL_COLUMN_WIDTHS), asi que el logo no cabe solo en esa
            // columna -- se combina con la B (mucho mas ancha) solo en esta
            // fila de titulo para darle espacio, sin ensanchar la columna A
            // para el resto de la tabla.
            logoColumnSpan: 2,
            // El area combinada A1:B1 sobra de ancho, asi que el logo se
            // ve mas grande que el resto de reportes (que lo dejan en una
            // sola columna angosta).
            logoRowHeight: 72,
            logoMaxWidthPx: 170
        });

        const headerRow = excel.addTableHeaderRow(sheet, columnas.map((column) => column.label));
        centrarFila(headerRow);

        asignaciones.forEach((item, indice) => {
            const filaExcel = headerRow.number + 1 + indice;
            const valoresRuta = [
                indice + 1,
                safe(item.conductor_nombre, "Sin conductor"),
                safe(item.ruta_nombre),
                safe(item.telefono),
                safe(item.vehiculo_placa, "Sin vehículo")
            ];
            const valores = conValores
                ? [
                    ...valoresRuta,
                    safe(item.observaciones, ""),
                    "",
                    "",
                    { formula: `${excel.columnLetter(COLUMNA_ANTICIPO)}${filaExcel}-${excel.columnLetter(COLUMNA_GASTO)}${filaExcel}`, result: 0 },
                    ""
                ]
                : valoresRuta;

            const row = excel.addTableDataRow(sheet, valores, { band: indice % 2 === 1 });
            centrarFila(row);

            // Telefono como columna de texto (no numero) para que Excel no
            // marque el numero como "guardado como texto" -- el telefono
            // nunca se usa en calculos, mostrar el error ahi es ruido.
            row.getCell(COLUMNA_TELEFONO).numFmt = "@";

            if (conValores) {
                row.getCell(COLUMNA_ANTICIPO).numFmt = "$#,##0";
                row.getCell(COLUMNA_GASTO).numFmt = "$#,##0";
                row.getCell(COLUMNA_CAMBIO).numFmt = "$#,##0";
            }
        });

        excel.addFooterRow(sheet, FOOTER_TEXT(branding?.nombreEmpresa), columnCount);
    }

    async function exportReporteExcel({ fecha, asignaciones }) {
        if (!asignaciones || !asignaciones.length) {
            throw new Error("No hay asignaciones registradas para esta fecha");
        }

        const excel = window.VehiAmb.excelExport;
        const branding = await window.VehiAmb.pdfExport.getEmpresaBranding();

        const workbook = await excel.createWorkbook();
        construirHojaReporte(workbook, { nombreHoja: "Asignaciones", fecha, asignaciones, branding, conValores: true });
        construirHojaReporte(workbook, { nombreHoja: "Asignaciones sin valores", fecha, asignaciones, branding, conValores: false });

        await excel.downloadWorkbook(workbook, `Reporte_vehiculos_${fecha}.xlsx`);
    }

    window.VehiAmb = window.VehiAmb || {};
    window.VehiAmb.asignacionesExport = { exportReporteImagen, exportReporteExcel };
})();
