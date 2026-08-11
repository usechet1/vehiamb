window.VehiAmb = window.VehiAmb || {};

const EXCELJS_CDN_URL = "https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js";

const BRAND_RED = "FFB21F2D";
const BRAND_RED_LIGHT = "FFFCE9EB";
const BRAND_INK = "FF18202B";
const BRAND_MUTED = "FF697386";
const ROW_BAND = "FFF8FAFC";
const BORDER_COLOR = "FFDCE2EA";

const THIN_BORDER = { style: "thin", color: { argb: BORDER_COLOR } };
const CELL_BORDER = { top: THIN_BORDER, left: THIN_BORDER, bottom: THIN_BORDER, right: THIN_BORDER };

async function createWorkbook() {
    if (!window.ExcelJS) {
        await window.VehiAmb.loadScript(EXCELJS_CDN_URL);
    }
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Vehiamb";
    workbook.created = new Date();
    return workbook;
}

// Aproximacion estandar de Excel para convertir un ancho de columna en
// "caracteres" (el mismo numero que usa setColumnWidths) a pixeles, para
// Calibri 11 a 96dpi (la fuente/tamano por defecto de un workbook nuevo).
// No hace falta que sea exacta al pixel -- solo sirve para centrar el logo
// dentro de las columnas combinadas, un ajuste visual.
function pixelesDeAnchoColumna(caracteres) {
    return Math.round((caracteres || 8.43) * 7 + 5);
}

// Calcula el "tl.col" (columna + fraccion, 0-based) donde debe empezar la
// imagen para quedar centrada dentro de las primeras "columnas" columnas del
// worksheet, dado el ancho ya renderizado de la imagen en pixeles.
function colOffsetCentrado(worksheet, columnas, anchoImagenPx) {
    const anchosPx = [];
    for (let i = 1; i <= columnas; i += 1) {
        anchosPx.push(pixelesDeAnchoColumna(worksheet.getColumn(i).width));
    }
    const anchoTotalPx = anchosPx.reduce((total, ancho) => total + ancho, 0);
    let offsetPx = Math.max(0, (anchoTotalPx - anchoImagenPx) / 2);

    let colIndex = 0;
    while (colIndex < anchosPx.length - 1 && offsetPx >= anchosPx[colIndex]) {
        offsetPx -= anchosPx[colIndex];
        colIndex += 1;
    }

    return colIndex + offsetPx / anchosPx[colIndex];
}

/**
 * Barra de titulo roja de marca, igual al encabezado de los reportes PDF.
 * Si se pasa "logo" (el mismo objeto { dataUrl, width, height } que ya
 * arma getEmpresaBranding() para el PDF, ver pdf-export.js), lo incrusta en
 * un recuadro blanco a la izquierda del titulo -- igual disposicion que el
 * encabezado del PDF: logo + banda roja al lado, no una encima de otra.
 */
function addTitleBar(worksheet, { title, subtitle, columnCount, logo, size = 13, align = "left", logoColumnSpan = 1, logoRowHeight, logoMaxWidthPx = 90 }) {
    const usaLogo = Boolean(logo);
    const colInicioTitulo = usaLogo ? logoColumnSpan + 1 : 1;
    // 46pt de alto (vs. 26pt sin logo) para que el logo entre con margen --
    // el banner del PDF mide 60pt, pero una fila de Excel tan alta se ve
    // desproporcionada al lado del resto de filas del reporte.
    // Con un tamano de letra mayor al default, la fila necesita ese mismo
    // extra de alto o el texto queda apretado contra el borde. logoRowHeight
    // permite pedir una fila (y por lo tanto un logo) mas grande solo en el
    // reporte que lo necesite, sin afectar el resto (ver asignaciones-export.js).
    const alturaFila = Math.max(logoRowHeight || (usaLogo ? 46 : 26), size * 2);

    if (usaLogo && logoColumnSpan === 1) {
        // La columna 1 del reporte (ej. "#") suele ser mas angosta que el
        // logo -- una imagen flotante no la ensancha sola, asi que si hace
        // falta se agranda un poco para que el logo no se monte sobre el
        // titulo de la columna siguiente. Si el caller combina varias
        // columnas para el logo (logoColumnSpan > 1 -- ver
        // asignaciones-export.js, donde la columna "#" necesita quedar
        // angosta de verdad) esa combinacion ya da espacio de sobra y no
        // hace falta ensanchar ninguna columna.
        const columnaLogo = worksheet.getColumn(1);
        const anchoMinimo = 14;
        if (!columnaLogo.width || columnaLogo.width < anchoMinimo) {
            columnaLogo.width = anchoMinimo;
        }
    }

    const celdasLogo = usaLogo ? Array(logoColumnSpan).fill(null) : [];
    const row = worksheet.addRow(usaLogo ? [...celdasLogo, title] : [title]);
    row.height = alturaFila;

    if (usaLogo && logoColumnSpan > 1) {
        worksheet.mergeCells(row.number, 1, row.number, logoColumnSpan);
    }

    if (columnCount > colInicioTitulo) {
        worksheet.mergeCells(row.number, colInicioTitulo, row.number, columnCount);
    }

    const celdaTitulo = row.getCell(colInicioTitulo);
    celdaTitulo.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_RED } };
    celdaTitulo.font = { bold: true, size, color: { argb: "FFFFFFFF" } };
    // El indent solo tiene sentido alineado a la izquierda -- centrado no
    // necesita ese empujon y se ve descuadrado si se deja.
    celdaTitulo.alignment = align === "center"
        ? { vertical: "middle", horizontal: "center" }
        : { vertical: "middle", horizontal: "left", indent: 1 };

    if (usaLogo) {
        for (let col = 1; col <= logoColumnSpan; col += 1) {
            row.getCell(col).border = CELL_BORDER;
        }

        // ExcelJS solo acepta la parte base64 pura (sin el prefijo
        // "data:image/jpeg;base64,"), a diferencia de jsPDF que sí recibe el
        // data URL completo.
        const base64 = logo.dataUrl.split(",")[1] || logo.dataUrl;
        const imageId = worksheet.workbook.addImage({ base64, extension: "jpeg" });

        // Mismo criterio de escala-a-caber que el logo del PDF
        // (getEmpresaBranding/addEncabezado en cada *-export.js): se respeta
        // la proporcion real del logo en vez de estirarlo a un cuadrado.
        const alturaFilaPx = alturaFila * (96 / 72);
        const anchoMaximoPx = logoMaxWidthPx;
        const altoMaximoPx = alturaFilaPx - 8;
        const escala = Math.min(anchoMaximoPx / logo.width, altoMaximoPx / logo.height, 1);
        const anchoImagenPx = logo.width * escala;
        const altoImagenPx = logo.height * escala;

        // Con una sola columna angosta el logo apenas cabe, asi que se deja
        // pegado a la izquierda con un margen chico (comportamiento de
        // siempre). Con varias columnas combinadas (logoColumnSpan > 1) sí
        // sobra espacio de verdad, y ahi el logo se centra tanto horizontal
        // como verticalmente dentro de esa area.
        const colOffset = logoColumnSpan > 1 ? colOffsetCentrado(worksheet, logoColumnSpan, anchoImagenPx) : 0.15;
        const rowOffset = logoColumnSpan > 1 ? Math.max(0, (alturaFilaPx - altoImagenPx) / 2) / alturaFilaPx : 0.1;

        worksheet.addImage(imageId, {
            tl: { col: colOffset, row: row.number - 1 + rowOffset },
            ext: { width: anchoImagenPx, height: altoImagenPx }
        });
    }

    if (subtitle) {
        const subRow = worksheet.addRow(usaLogo ? [...celdasLogo, subtitle] : [subtitle]);
        if (usaLogo && logoColumnSpan > 1) {
            worksheet.mergeCells(subRow.number, 1, subRow.number, logoColumnSpan);
        }
        worksheet.mergeCells(subRow.number, colInicioTitulo, subRow.number, columnCount);
        subRow.getCell(colInicioTitulo).font = { italic: true, size: 9, color: { argb: BRAND_MUTED } };
        subRow.getCell(colInicioTitulo).alignment = align === "center"
            ? { horizontal: "center" }
            : { indent: 1 };
    }

    worksheet.addRow([]);
}

function addSectionHeader(worksheet, text, columnCount) {
    const row = worksheet.addRow([text]);
    worksheet.mergeCells(row.number, 1, row.number, columnCount);
    row.getCell(1).font = { bold: true, size: 11, color: { argb: BRAND_RED } };
    row.getCell(1).border = { bottom: THIN_BORDER };
    row.height = 20;
    return row;
}

function addLabelValueRow(worksheet, label, value) {
    const row = worksheet.addRow([label, value]);
    row.getCell(1).font = { bold: true, color: { argb: BRAND_INK } };
    row.getCell(2).font = { color: { argb: BRAND_INK } };
    return row;
}

function addTableHeaderRow(worksheet, labels) {
    const row = worksheet.addRow(labels);
    row.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_RED } };
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.border = CELL_BORDER;
        cell.alignment = { vertical: "middle" };
    });
    row.height = 18;
    return row;
}

function addTableDataRow(worksheet, values, { band = false } = {}) {
    const row = worksheet.addRow(values);
    row.eachCell((cell) => {
        cell.border = CELL_BORDER;
        if (band) {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ROW_BAND } };
        }
    });
    return row;
}

function addFooterRow(worksheet, text, columnCount) {
    worksheet.addRow([]);
    const row = worksheet.addRow([text]);
    worksheet.mergeCells(row.number, 1, row.number, columnCount);
    row.getCell(1).font = { italic: true, size: 8, color: { argb: BRAND_MUTED } };
    return row;
}

function setColumnWidths(worksheet, widths) {
    widths.forEach((width, index) => {
        worksheet.getColumn(index + 1).width = width;
    });
}

/**
 * Convierte un indice de columna 1-based ("A" = 1) a su letra de Excel, para
 * armar referencias de formula (ej. "G5-H5") sin escribirlas a mano.
 */
function columnLetter(index) {
    let letra = "";
    let n = index;
    while (n > 0) {
        const resto = (n - 1) % 26;
        letra = String.fromCharCode(65 + resto) + letra;
        n = Math.floor((n - 1) / 26);
    }
    return letra;
}

async function downloadWorkbook(workbook, fileName) {
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

/**
 * Formato de fecha exclusivo para los reportes Excel (dd/mm/aaaa),
 * en paralelo a formatDateForPdf pero como texto plano de celda.
 */
function formatDateForExcel(value) {
    if (!value) return "No registrado";

    const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
    if (Number.isNaN(date.getTime())) return "No registrado";

    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();

    return `${day}/${month}/${year}`;
}

window.VehiAmb.excelExport = {
    createWorkbook,
    addTitleBar,
    addSectionHeader,
    addLabelValueRow,
    addTableHeaderRow,
    addTableDataRow,
    addFooterRow,
    setColumnWidths,
    columnLetter,
    downloadWorkbook,
    formatDateForExcel
};
