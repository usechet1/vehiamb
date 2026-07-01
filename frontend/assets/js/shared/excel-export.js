window.VehiAmb = window.VehiAmb || {};

const BRAND_RED = "FFB21F2D";
const BRAND_RED_LIGHT = "FFFCE9EB";
const BRAND_INK = "FF18202B";
const BRAND_MUTED = "FF697386";
const ROW_BAND = "FFF8FAFC";
const BORDER_COLOR = "FFDCE2EA";

const THIN_BORDER = { style: "thin", color: { argb: BORDER_COLOR } };
const CELL_BORDER = { top: THIN_BORDER, left: THIN_BORDER, bottom: THIN_BORDER, right: THIN_BORDER };

function createWorkbook() {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "VehiAmb";
    workbook.created = new Date();
    return workbook;
}

/**
 * Barra de titulo roja de marca, igual al encabezado de los reportes PDF.
 */
function addTitleBar(worksheet, { title, subtitle, columnCount }) {
    const row = worksheet.addRow([title]);
    worksheet.mergeCells(row.number, 1, row.number, columnCount);
    row.height = 26;
    row.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_RED } };
    row.getCell(1).font = { bold: true, size: 13, color: { argb: "FFFFFFFF" } };
    row.getCell(1).alignment = { vertical: "middle", horizontal: "left", indent: 1 };

    if (subtitle) {
        const subRow = worksheet.addRow([subtitle]);
        worksheet.mergeCells(subRow.number, 1, subRow.number, columnCount);
        subRow.getCell(1).font = { italic: true, size: 9, color: { argb: BRAND_MUTED } };
        subRow.getCell(1).alignment = { indent: 1 };
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
    downloadWorkbook,
    formatDateForExcel
};
